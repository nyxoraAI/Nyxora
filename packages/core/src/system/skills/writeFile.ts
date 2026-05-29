import fs from 'fs';
import path from 'path';

export function writeLocalFile(filePath: string, content: string): string {
  try {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(absolutePath, content, 'utf8');
    return `Success: File written to ${absolutePath}`;
  } catch (error: any) {
    return `Failed to write file: ${error.message}`;
  }
}

export const writeLocalFileToolDefinition = {
  type: "function",
  function: {
    name: "write_local_file",
    description: "Writes or overwrites a local file on the user's computer with the provided content.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path to the file.",
        },
        content: {
          type: "string",
          description: "The string content to write to the file.",
        }
      },
      required: ["filePath", "content"],
    },
  },
};
