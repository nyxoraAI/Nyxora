import fs from 'fs';
import path from 'path';

export function writeLocalFile(filePath: string, content: string): string {
  try {
    const absolutePath = path.resolve(filePath);
    
    // Security Firewall: Block modification of core configuration files
    const basename = path.basename(absolutePath);
    if (['config.yaml', 'rpc_key.yaml', 'policy.yaml'].includes(basename)) {
      return `Error: Access Denied. You are strictly forbidden from modifying core configuration files directly. If you need to update your agent name, use the update_identity tool instead.`;
    }

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
          description: "The absolute path to the file. ALWAYS use absolute paths based on the user's environment or preferred working directory.",
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
