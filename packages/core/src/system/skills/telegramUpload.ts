import { sendTelegramDocument } from '../../channels/telegram';

export const sendTelegramFileToolDefinition = {
  type: 'function',
  function: {
    name: 'send_telegram_file',
    description: 'Uploads a local file directly to the user via Telegram. Use this instead of generating download links when the user requests a file on Telegram.',
    parameters: {
      type: 'object',
      properties: {
        absolutePath: {
          type: 'string',
          description: 'The absolute path to the file on the local system (e.g., /home/user/document.pdf)'
        }
      },
      required: ['absolutePath']
    }
  }
};

export async function sendTelegramFile(absolutePath: string): Promise<string> {
  return await sendTelegramDocument(absolutePath);
}
