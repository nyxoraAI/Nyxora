import fs from 'fs';
import path from 'path';

export function readLocalFile(filePath: string, startLine?: number, endLine?: number): string {
  try {
    let absolutePath = path.resolve(filePath);
    
    if (fs.existsSync(absolutePath)) {
      // Path Canonicalization to defeat symlink/traversal bypasses
      absolutePath = fs.realpathSync(absolutePath);
    }

    // 1. Smart Directory Blacklist (Case-insensitive matching for full paths)
    const blockedDirectories = [
      /(?:\/.+)?\/\.ssh(?:\/.*)?/i,
      /(?:\/.+)?\/\.gnupg(?:\/.*)?/i,
      /(?:\/.+)?\/\.aws(?:\/.*)?/i,
      /(?:\/.+)?\/\.config\/solana(?:\/.*)?/i,
      /(?:\/.+)?\/\.ethereum(?:\/.*)?/i,
      /(?:\/.+)?\/\.foundry(?:\/.*)?/i,
      /(?:\/.+)?\/\.wallets(?:\/.*)?/i,
      /(?:\/.+)?\/\.nyxora\/(?:auth|config|run)(?:\/.*)?/i,
      /vault\.key/i,
      /passwd/i
    ];

    for (const pattern of blockedDirectories) {
      if (pattern.test(absolutePath)) {
         return `Error: Permission Denied. Access to ${absolutePath} is strictly blocked by the system security policy.`;
      }
    }

    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found at ${absolutePath}`;
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    
    // Pagination logic
    if (startLine !== undefined && endLine !== undefined) {
      const lines = content.split('\n');
      // Convert 1-based index to 0-based for array slicing
      const startIdx = Math.max(0, startLine - 1);
      const endIdx = Math.min(lines.length, endLine);
      const slicedLines = lines.slice(startIdx, endIdx);
      
      // Prefix with line numbers
      let result = `--- Showing lines ${startIdx + 1} to ${endIdx} of ${lines.length} ---\n`;
      slicedLines.forEach((line, idx) => {
        result += `${startIdx + idx + 1}: ${line}\n`;
      });
      return result;
    }
    
    return content;
  } catch (error: any) {
    return `Failed to read file: ${error.message}`;
  }
}

export const readLocalFileToolDefinition = {
  type: "function",
  function: {
    name: "read_local_file",
    description: "Reads the content of a local file. Supports pagination to prevent reading giant files at once.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path to the file.",
        },
        startLine: {
          type: "number",
          description: "Optional. 1-indexed starting line number.",
        },
        endLine: {
          type: "number",
          description: "Optional. 1-indexed ending line number.",
        }
      },
      required: ["filePath"],
    },
  },
};
