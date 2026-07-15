import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export async function computerUse(args: any): Promise<any> {
    try {
      const response = await fetch('http://127.0.0.1:8000/os/computer_use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        return `[ComputerUse Error] ${response.status} ${response.statusText}: ${errText}`;
      }

      const result = await response.json();
      const outputBlocks: any[] = [];
      
      // Text result
      if (result.text) {
        outputBlocks.push({ type: 'text', text: result.text });
      } else {
        outputBlocks.push({ type: 'text', text: `Action '${args.action}' executed.` });
      }
      
      // Screenshot / image result
      if (result.base64_image) {
        outputBlocks.push({ 
          type: 'image_url', 
          image_url: { url: `data:image/png;base64,${result.base64_image}` } 
        });
        
        // Persist screenshot to disk so the user can inspect it
        try {
          let filepath = '';
          if (args.save_path) {
            filepath = args.save_path;
            const dir = path.dirname(filepath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          } else {
            const dir = path.join(os.homedir(), '.nyxora', 'screenshots');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            filepath = path.join(dir, 'latest_computer_use.png');
          }
          fs.writeFileSync(filepath, Buffer.from(result.base64_image, 'base64'));
          outputBlocks.push({ type: 'text', text: `[Screenshot saved to: ${filepath}]` });
        } catch (err) {
          console.error('[ComputerUse] Failed to save screenshot', err);
        }
      }
      
      // Return plain string if there is no image (most tool calls)
      if (outputBlocks.length === 1 && outputBlocks[0].type === 'text') {
        return outputBlocks[0].text;
      }
      
      return outputBlocks;

    } catch (e: any) {
      return `[ComputerUse Error] Failed to reach ML engine: ${e.message}. Make sure 'nyxora start' is running.`;
    }
}

export const computerUseToolDefinition = {
  type: "function",
  function: {
    name: 'computer',
    description: [
      'Control the OS desktop in the background via the cua-driver MCP bridge.',
      '',
      'RECOMMENDED WORKFLOW FOR PRECISE GUI AUTOMATION:',
      '  1. action="list_windows"           → get all open apps with their pid and window_id',
      '  2. action="get_window_state"        → get accessibility element tree + screenshot for a specific window',
      '  3. action="left_click", element_index=N, pid=..., window_id=...  → click a specific UI element precisely',
      '',
      'DIRECT COORDINATE ACTIONS (when you already know the pixel position):',
      '  - left_click / right_click / middle_click / double_click with coordinate=[x,y]',
      '  - mouse_move with coordinate=[x,y]',
      '  - scroll with coordinate=[x,y], text="down"|"up"|"left"|"right", amount=3',
      '',
      'KEYBOARD:',
      '  - action="type", text="hello world"        → type text into focused field',
      '  - action="key", text="ctrl+c"              → press key combo (supports: ctrl, alt, shift, meta, enter, escape, tab, delete, etc.)',
      '',
      'INSPECTION:',
      '  - action="screenshot"                      → capture full desktop',
      '  - action="cursor_position"                 → get current mouse x,y',
      '',
      'STRICT RULES:',
      '  - NEVER use this tool to write or edit code/text files — use write_local_file or edit_local_file.',
      '  - NEVER use this tool to type terminal commands — use run_terminal_command or run_terminal_command_pty.',
      '  - ONLY use this tool for native GUI apps (File Manager, Browser, Discord, Figma, etc.) or visual verification.',
      '  - After every click or type, the tool auto-captures a screenshot so you can verify the result.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform.',
          enum: [
            'list_windows',
            'get_window_state',
            'screenshot',
            'cursor_position',
            'mouse_move',
            'left_click',
            'right_click',
            'middle_click',
            'double_click',
            'left_click_drag',
            'type',
            'key',
            'scroll',
          ]
        },
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          description: '[x, y] pixel coordinates. Required for mouse_move, scroll, and coordinate-based clicks. Not needed when using element_index.'
        },
        text: {
          type: 'string',
          description: 'For type: the text to type. For key: the key combo (e.g. "ctrl+c", "enter", "escape", "ctrl+shift+t"). For scroll: direction ("up", "down", "left", "right").'
        },
        amount: {
          type: 'integer',
          description: 'For scroll: number of scroll steps (default: 3).'
        },
        pid: {
          type: 'integer',
          description: 'Process ID. Required for get_window_state. Also used to improve accuracy of type, key, and coordinate-based clicks — supply it when you already have it from list_windows.'
        },
        window_id: {
          type: 'integer',
          description: 'Window ID. Required for get_window_state. Also used with pid for element-based clicks.'
        },
        element_index: {
          type: 'integer',
          description: 'Accessibility tree element index from get_window_state. Used with pid + window_id for the most precise click targeting.'
        },
        save_path: {
          type: 'string',
          description: 'Optional absolute path to save the screenshot PNG file (e.g. "/home/user/screenshots/result.png"). If omitted, saved to ~/.nyxora/screenshots/latest_computer_use.png.'
        }
      },
      required: ['action']
    }
  }
};
