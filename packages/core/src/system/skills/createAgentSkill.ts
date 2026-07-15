import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { getPath } from '../../config/paths';

export const createAgentSkillToolDefinition = {
  type: "function",
  function: {
    name: "create_agent_skill",
    description: "Create a new programmatic external skill for the Nyxora Agent. This will automatically generate a SKILL.md with correct YAML frontmatter and an execute.ts script in the ~/.nyxora/skills/ folder.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the skill (snake_case, e.g., 'binance_trading')."
        },
        description: {
          type: "string",
          description: "A detailed description of what the skill does, which tools/actions it provides, and what environment variables it requires."
        },
        parameters: {
          type: "object",
          description: "The JSON Schema representing the tool's parameters (e.g., { action: { type: 'string' } })."
        },
        required: {
          type: "array",
          items: { type: "string" },
          description: "An array of required parameter names."
        },
        scriptContent: {
          type: "string",
          description: "The complete TypeScript source code for scripts/execute.ts. Must export an 'execute' function."
        }
      },
      required: ["name", "description", "parameters", "required", "scriptContent"]
    }
  }
};

export async function createAgentSkill(name: string, description: string, parameters: any, required: string[], scriptContent: string): Promise<string> {
  try {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!safeName) throw new Error("Invalid skill name.");

    const skillsDir = getPath('skills');
    const targetDir = path.join(skillsDir, safeName);
    const scriptsDir = path.join(targetDir, 'scripts');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // 1. Generate YAML Frontmatter
    let finalParameters = parameters;
    if (parameters && parameters.type === 'object' && parameters.properties) {
      finalParameters = parameters.properties;
    }

    const frontmatterObj = {
      name: safeName,
      description: description,
      version: '1.0.0',
      author: 'NyxoraAI',
      main: 'scripts/execute.ts',
      parameters: finalParameters,
      required: required
    };

    const frontmatterYaml = yaml.stringify(frontmatterObj);
    const skillMdContent = `---\n${frontmatterYaml}---\n\n# ${safeName}\n\n${description}\n`;
    
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMdContent, 'utf8');

    // 2. Write the execute.ts script
    fs.writeFileSync(path.join(scriptsDir, 'execute.ts'), scriptContent, 'utf8');

    return `[Success] Programmatic Skill '${safeName}' has been successfully created. The SKILL.md file has been formatted with the correct YAML frontmatter and the execution script was saved to scripts/execute.ts. The skill is now ready to be loaded by Nyxora's AgentSkills scanner.`;
  } catch (error: any) {
    return `[Error] Failed to create programmatic skill: ${error.message}`;
  }
}
