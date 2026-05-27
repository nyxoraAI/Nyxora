import fs from 'fs';
import { getPath } from '../config/paths';

export function updateProfile(content: string, mode: 'append' | 'replace'): string {
  try {
    const userMdPath = getPath('user.md');
    
    if (mode === 'replace') {
      fs.writeFileSync(userMdPath, content, 'utf8');
      return "Profile replaced successfully. New user.md has been saved.";
    } else {
      let existingContent = "";
      if (fs.existsSync(userMdPath)) {
        existingContent = fs.readFileSync(userMdPath, 'utf8');
      }
      
      const newContent = existingContent + "\n" + content;
      fs.writeFileSync(userMdPath, newContent, 'utf8');
      return "Profile appended successfully. New instructions added to user.md.";
    }
  } catch (error: any) {
    return `Failed to update profile: ${error.message}`;
  }
}

export const updateProfileToolDefinition = {
  type: "function",
  function: {
    name: "update_profile",
    description: "Updates or rewrites the user.md file. Use this when the user asks you to remember something about them, change their persona, or update your instructions.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to write or append to user.md",
        },
        mode: {
          type: "string",
          enum: ["append", "replace"],
          description: "Whether to append the content to the existing file or replace the entire file.",
        }
      },
      required: ["content", "mode"],
    },
  },
};
