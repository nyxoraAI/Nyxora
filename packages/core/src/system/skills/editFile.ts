import fs from 'fs';
import path from 'path';

export function editLocalFile(filePath: string, searchString: string, replacementString: string): string {
  try {
    const absolutePath = path.resolve(filePath);
    
    // Security Firewall: Block modification of core configuration files
    const basename = path.basename(absolutePath);
    if (['config.yaml', 'rpc_key.yaml', 'policy.yaml'].includes(basename)) {
      return `Error: Access Denied. You are strictly forbidden from modifying core configuration files directly. If you need to update your agent name, use the update_identity tool instead.`;
    }

    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found at ${absolutePath}`;
    }
    
    const content = fs.readFileSync(absolutePath, 'utf8');
    
    if (!content.includes(searchString)) {
      return `Error: The exact searchString was not found in the file. Make sure spaces and indentation match exactly.`;
    }
    
    // Check if there are multiple occurrences to prevent accidental replacements
    const count = content.split(searchString).length - 1;
    if (count > 1) {
      return `Error: Found ${count} occurrences of searchString. Please provide a more unique searchString (e.g., include surrounding lines) to avoid replacing the wrong block.`;
    }
    
    const newContent = content.replace(searchString, replacementString);
    fs.writeFileSync(absolutePath, newContent, 'utf8');
    
    return `Success: Replaced 1 occurrence of string in ${absolutePath}`;
  } catch (error: any) {
    return `Failed to edit file: ${error.message}`;
  }
}

export const editLocalFileToolDefinition = {
  type: "function",
  function: {
    name: "edit_local_file",
    description: "Edits a local file by finding an exact string match and replacing it. Best used for line-level precision editing instead of overwriting the whole file.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute path to the file. ALWAYS use absolute paths based on the user's environment or preferred working directory.",
        },
        searchString: {
          type: "string",
          description: "The exact string block to replace. Must be unique within the file.",
        },
        replacementString: {
          type: "string",
          description: "The new string block that will replace the searchString.",
        }
      },
      required: ["filePath", "searchString", "replacementString"],
    },
  },
};
