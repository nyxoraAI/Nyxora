import { intro, text, spinner, isCancel, cancel } from '@clack/prompts';
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
    } catch (e) {}
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
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nyxora-token': token,
        },
        body: JSON.stringify({ message: messageStr, session_id: 'cli-chat' })
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

      const data = await response.json();
      s.stop(pc.green('Nyxora:'));
      
      let finalReply = data.response || '';
      // Strip <think> tags for clean UI
      finalReply = finalReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      
      console.log(finalReply + '\n');
    } catch (error) {
      s.stop(pc.red('Connection failed.'));
      console.log(pc.red(`Is the daemon running? (http://localhost:3000)`));
    }
  }
}
