import * as fs from 'fs';
import * as path from 'path';

export class TrajectoryLogger {
  private static logFilePath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.nyxora', 'trajectories.jsonl');

  public static initialize() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public static logTurn(task: string, messages: any[], completed: boolean, apiCalls: number, metadata: any) {
    this.initialize();

    const trajectory: any[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'system') {
        trajectory.push({ from: 'system', value: msg.content });
      } else if (msg.role === 'user') {
        trajectory.push({ from: 'human', value: msg.content });
      } else if (msg.role === 'assistant') {
        let content = '';
        if (msg.content) {
          content += msg.content + '\n';
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          msg.tool_calls.forEach((tc: any) => {
            content += `<tool_call>\n${JSON.stringify({ name: tc.function.name, arguments: JSON.parse(tc.function.arguments || '{}') })}\n</tool_call>\n`;
          });
        }
        trajectory.push({ from: 'gpt', value: content.trim() });
      } else if (msg.role === 'tool') {
        const toolResponse = `<tool_response>\n${JSON.stringify({ name: msg.name, content: msg.content })}\n</tool_response>`;
        // Aggregate sequential tool messages if needed, but keeping it simple for now
        trajectory.push({ from: 'tool', value: toolResponse });
      }
    }

    const record = {
      task,
      conversations: trajectory,
      completed,
      api_calls: apiCalls,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    };

    fs.appendFileSync(this.logFilePath, JSON.stringify(record) + '\n', 'utf-8');
  }
}
