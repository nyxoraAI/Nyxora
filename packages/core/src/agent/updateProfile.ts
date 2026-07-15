import { episodicDB } from '../memory/episodic';
import { PromotionEngine } from '../memory/promotionEngine';

export async function updateProfile(content: string, mode: 'append' | 'replace'): Promise<string> {
  try {
    if (mode === 'replace') {
      episodicDB.clearAllMemories();
    }
    
    const lines = content.split('\n').filter(l => l.trim() !== '');
    for (const line of lines) {
       let cleanLine = line.trim();
       if (cleanLine.startsWith('- ')) cleanLine = cleanLine.substring(2);
       if (cleanLine) {
         episodicDB.addCandidateFact(cleanLine, 1.0, 'general', 'permanent');
       }
    }
    
    await PromotionEngine.runPromotionAndDecay();

    return "Profile updated successfully in Episodic DB and synchronized to user.md.";
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
