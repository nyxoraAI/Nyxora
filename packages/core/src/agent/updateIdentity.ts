import fs from 'fs';
import { getPath } from '../config/paths';
import { loadConfig, saveConfig } from '../config/parser';

export function updateIdentity(content: string, mode: 'append' | 'replace', agentName?: string): string {
  try {
    const identityMdPath = getPath('IDENTITY.md');
    
    if (mode === 'replace') {
      fs.writeFileSync(identityMdPath, content, 'utf8');
      
      let msg = "Identity replaced successfully. New IDENTITY.md has been saved.";
      if (agentName) {
        const config = loadConfig();
        config.agent.name = agentName;
        saveConfig(config);
        msg += ` Agent Name updated to '${agentName}' in config.`;
      }
      return msg;
    } else {
      let existingContent = "";
      if (fs.existsSync(identityMdPath)) {
        existingContent = fs.readFileSync(identityMdPath, 'utf8');
      }
      
      const newContent = existingContent + "\n" + content;
      fs.writeFileSync(identityMdPath, newContent, 'utf8');
      
      let msg = "Identity appended successfully. New instructions added to IDENTITY.md.";
      if (agentName) {
        const config = loadConfig();
        config.agent.name = agentName;
        saveConfig(config);
        msg += ` Agent Name updated to '${agentName}' in config.`;
      }
      return msg;
    }
  } catch (error: any) {
    return `Failed to update identity: ${error.message}`;
  }
}

export const updateIdentityToolDefinition = {
  type: "function",
  function: {
    name: "update_identity",
    description: "Updates or rewrites the IDENTITY.md file. Use this when the user sets or changes your AI name, persona, or core character instructions.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to write or append to IDENTITY.md",
        },
        mode: {
          type: "string",
          enum: ["append", "replace"],
          description: "Whether to append the content to the existing file or replace the entire file.",
        },
        agentName: {
          type: "string",
          description: "The short display name of the AI agent (e.g. Hinata, Nyxora). MUST be provided if the user assigns you a new name.",
        }
      },
      required: ["content", "mode"],
    },
  },
};
