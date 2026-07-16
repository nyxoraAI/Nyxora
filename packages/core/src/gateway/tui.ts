import blessed from 'blessed';
import fs from 'fs';
import { getPath } from '../config/paths';
import pc from 'picocolors';

export async function runTUI() {
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

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Nyxora TUI',
  });

  const chatBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '70%',
    height: '80%',
    border: { type: 'line' },
    label: ' Chat ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: ' ', track: { bg: 'cyan' }, style: { inverse: true } }
  });

  const toolsBox = blessed.box({
    parent: screen,
    top: 0,
    left: '70%',
    width: '30%',
    height: '50%',
    border: { type: 'line' },
    label: ' Active Tools ',
    content: 'Waiting for tools...'
  });

  const subagentsBox = blessed.box({
    parent: screen,
    top: '50%',
    left: '70%',
    width: '30%',
    height: '50%',
    border: { type: 'line' },
    label: ' Subagents ',
    content: 'No active subagents.'
  });

  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '70%',
    height: '20%',
    border: { type: 'line' },
    label: ' Input ',
    inputOnFocus: true,
  });

  screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

  chatBox.pushLine('{cyan-fg}Welcome to Nyxora Interactive TUI{/cyan-fg}');
  chatBox.pushLine('Type your message and press Enter. Press Esc or Ctrl-C to quit.\n');
  screen.render();

  inputBox.focus();

  inputBox.on('submit', async (text) => {
    inputBox.clearValue();
    screen.render();
    
    if (text.trim().toLowerCase() === 'exit') {
      process.exit(0);
    }
    if (!text.trim()) {
      inputBox.focus();
      return;
    }

    chatBox.pushLine(`{green-fg}You:{/green-fg} ${text}`);
    chatBox.pushLine(`{yellow-fg}Nyxora:{/yellow-fg} Thinking...`);
    screen.render();

    try {
      const params = new URLSearchParams({
        message: text,
        session_id: 'tui-chat',
        token,
      });

      const response = await fetch(`http://localhost:3000/api/chat/stream?${params}`, {
        headers: { 'x-nyxora-token': token },
      });

      if (!response.ok) {
        chatBox.pushLine(`{red-fg}Error: Gateway returned status ${response.status}{/red-fg}`);
        screen.render();
        inputBox.focus();
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentReply = '';

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
                toolsBox.setContent(data.progress);
                screen.render();
              }
              if (data.chunk) {
                if (data.chunk === '[CLEAR_STREAM]' || data.chunk === '[TOOL_CALL_FINISHED]') {
                  continue;
                }
                currentReply += data.chunk;
                
                // Replace the last line (which was "Thinking..." or the partial reply)
                chatBox.deleteLine(chatBox.getLines().length - 1);
                chatBox.pushLine(`{yellow-fg}Nyxora:{/yellow-fg} ${currentReply}`);
                screen.render();
              }
            } catch {}
          }
        }
      }
      chatBox.pushLine(''); // empty line after reply
    } catch (error) {
      chatBox.pushLine('{red-fg}Connection failed. Is the daemon running?{/red-fg}');
    }
    
    toolsBox.setContent('Idle');
    screen.render();
    inputBox.focus();
  });
}
