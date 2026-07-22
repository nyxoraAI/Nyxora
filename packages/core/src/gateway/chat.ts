import { intro, text, spinner, isCancel, cancel, confirm } from '@clack/prompts';
import pc from 'picocolors';
import fs from 'fs';
import { getPath } from '../config/paths';

export async function chatInteractive() {
  const tokenFile = getPath('auth.token');
  if (!fs.existsSync(tokenFile)) {
    console.log(pc.red('❌ Nyxora daemon is not running. Please start it with `nyxora start`.'));
    process.exit(1);
  }

  let token = fs.readFileSync(tokenFile, 'utf8').trim();
  if (token.startsWith('{')) {
    try {
      const parsed = JSON.parse(token);
      token = parsed.token;
    } catch {}
  }

  const logo = `
███╗   ██╗██╗   ██╗██╗  ██╗ ██████╗ ██████╗  █████╗ 
████╗  ██║╚██╗ ██╔╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗
██╔██╗ ██║ ╚████╔╝  ╚███╔╝ ██║   ██║██████╔╝███████║
██║╚██╗██║  ╚██╔╝   ██╔██╗ ██║   ██║██╔══██╗██╔══██║
██║ ╚████║   ██║   ██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║
╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  `;

  console.log(pc.cyan(logo));
  intro(pc.inverse(' Nyxora Interactive Shell '));
  console.log(pc.gray('Type your message and press Enter. Type "exit" or press Ctrl+C to quit.\n'));

  while (true) {
    const input = await text({
      message: pc.cyan('You:'),
      placeholder: 'Send a message...',
    });

    if (isCancel(input) || input.toString().trim().toLowerCase() === 'exit' || input.toString().trim().toLowerCase() === 'quit') {
      cancel('Chat session ended.');
      process.exit(0);
    }

    const messageStr = input.toString().trim();
    if (!messageStr) continue;

    const s = spinner();
    s.start('Thinking...');

    try {
      // Use SSE streaming endpoint for real-time token output
      const params = new URLSearchParams({
        message: messageStr,
        session_id: 'cli-chat',
        token,
      });

      const response = await fetch(`http://localhost:3000/api/chat/stream?${params}`, {
        headers: { 'x-nyxora-token': token },
      });

      if (!response.ok) {
        s.stop(pc.red('API Error.'));
        if (response.status === 401) {
          console.log(pc.red('Unauthorized: Token is invalid. Please restart the daemon.'));
          process.exit(1);
        } else {
          console.log(pc.red(`Gateway returned status ${response.status}`));
        }
        continue;
      }

      let firstChunk = true;
      let finalReply = '';

      // Read SSE stream line by line
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const data = JSON.parse(raw);
              if (data.progress) {
                // Show tool progress on same line, overwriting previous
                if (firstChunk) {
                  s.stop(pc.cyan('Nyxora:'));
                  firstChunk = false;
                }
                process.stdout.write(`\x1b[2K\r${pc.italic(pc.gray(data.progress))}`);
              }
              if (data.chunk) {
                if (data.chunk === '[CLEAR_STREAM]' || data.chunk === '[TOOL_CALL_FINISHED]') {
                  // Ignore control tokens in TUI, but clear the current line just in case
                  process.stdout.write('\x1b[2K\r');
                  continue;
                }
                if (firstChunk) {
                  s.stop(pc.green('Nyxora:'));
                  process.stdout.write('\n');
                  firstChunk = false;
                }
                // Clear the line once before writing the first chunk of text to erase any lingering progress
                if (finalReply === '') {
                  process.stdout.write('\x1b[2K\r');
                }
                finalReply += data.chunk;
                process.stdout.write(data.chunk);
              }
            } catch {}
          }
        }
      }

      // Newline after streaming completes
      if (!firstChunk) process.stdout.write('\n\n');



      // Check for pending transactions
      try {
        const txRes = await fetch('http://localhost:3000/api/transactions', {
          headers: { 'x-nyxora-token': token }
        });
        if (txRes.ok) {
          const txs = await txRes.json();
          for (const tx of txs) {
            const isApproved = await confirm({
              message: pc.yellow(`Approve Transaction [${tx.type.toUpperCase()}] on ${tx.chainName.toUpperCase()}?`),
            });
            
            if (isCancel(isApproved) || !isApproved) {
               await fetch(`http://localhost:3000/api/transactions/${tx.id}/reject`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'x-nyxora-token': token },
                 body: JSON.stringify({ nonce: tx.nonce, sessionId: 'cli-chat' })
               });
               console.log(pc.red(`Transaction rejected.\n`));
               continue;
            }

            const appRes = await fetch(`http://localhost:3000/api/transactions/${tx.id}/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-nyxora-token': token },
              body: JSON.stringify({ nonce: tx.nonce, sessionId: 'cli-chat' })
            });
            const appData = await appRes.json();
            if (appData.success) {
              console.log(pc.green(`Transaction approved! Processing in background...\n`));
            } else {
              console.log(pc.red(`Failed to approve: ${appData.error}\n`));
            }
          }
        }
      } catch {}
    } catch (error) {
      s.stop(pc.red('Connection failed.'));
      console.log(pc.red(`Is the daemon running? (http://localhost:3000)`));
    }
  }
}
