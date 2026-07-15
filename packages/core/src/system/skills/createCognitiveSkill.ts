import fs from 'fs';
import path from 'path';

export const createCognitiveSkillToolDefinition = {
  type: "function",
  function: {
    name: "create_cognitive_skill",
    description: "Create a new Cognitive Skill (Markdown SOP) for the Nyxora OS Agent to automatically load in future similar contexts.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "The sub-folder to place this skill in (e.g., 'software-development', 'research', 'autonomous', 'extras')."
        },
        skillName: {
          type: "string",
          description: "The name of the skill (kebab-case, e.g., 'angular-debugging')."
        },
        content: {
          type: "string",
          description: "The full markdown content containing the step-by-step Standard Operating Procedure (SOP) instructions."
        }
      },
      required: ["category", "skillName", "content"]
    }
  }
};

export async function createCognitiveSkill(category: string, skillName: string, content: string): Promise<string> {
  try {
    const safeCategory = category.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    let safeName = skillName.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (!safeName.endsWith('.md')) safeName += '.md';
    
    const rootPromptsDir = path.join(__dirname, '../../cognitive/prompts');
    const targetDir = path.join(rootPromptsDir, safeCategory);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const filePath = path.join(targetDir, safeName);
    fs.writeFileSync(filePath, content, 'utf8');
    
    return `[Success] Cognitive Skill '${safeName}' has been successfully created in the '${safeCategory}' category. Nyxora will now be able to load this skill dynamically. Reminder: You must also update cognitiveManager.ts skillMappings if you want it loaded automatically.`;
  } catch (error: any) {
    return `[Error] Failed to create cognitive skill: ${error.message}`;
  }
}
