import fs from 'fs';
import path from 'path';

export function readLocalFile(filePath: string): string {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found at ${absolutePath}`;
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content;
  } catch (error: any) {
    return `Failed to read file: ${error.message}`;
  }
}

export const readLocalFileToolDefinition = {
  type: "function",
  function: {
    name: "read_local_file",
    description: "Reads the content of a local file on the user's computer.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path to the file.",
        }
      },
      required: ["filePath"],
    },
  },
};
