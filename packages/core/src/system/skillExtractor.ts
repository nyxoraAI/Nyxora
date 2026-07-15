import fs from 'fs';
import path from 'path';
import { getPath } from '../config/paths';
import { executeWithRetry } from '../utils/llmUtils';
import { loadConfig } from '../config/parser';
import pc from 'picocolors';

export class SkillExtractor {
  
  /**
   * Generates a fully compliant agentskills.io skill from a natural language request or chat trace.
   */
  public async generateSkill(skillName: string, description: string, userIntent: string, historyTraces: string[] = []): Promise<boolean> {
    const config = loadConfig();
    const safeName = skillName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const skillDir = getPath(`skills/${safeName}`);
    
    if (fs.existsSync(skillDir)) {
      console.error(pc.red(`[SkillExtractor] Skill '${safeName}' already exists.`));
      return false;
    }
    
    console.log(pc.cyan(`[SkillExtractor] Synthesizing new skill: ${safeName}...`));
    
    // 1. Generate SKILL.md
    const promptMd = `Generate the agentskills.io SKILL.md file for a new skill called '${safeName}'.
Description: ${description}
User Intent / Logic: ${userIntent}
Chat Traces (if any):
${historyTraces.join('\n')}

The SKILL.md must contain a YAML frontmatter block exactly following this structure:
---
name: ${safeName}
version: 1.0.0
description: <Your generated description>
parameters:
  type: object
  properties:
    param1:
      type: string
      description: ...
  required:
    - param1
---

CRITICAL: The 'required' array MUST be indented exactly inside the 'parameters' block as shown above. Do NOT put 'required' at the root level of the YAML.

Do NOT write anything outside the frontmatter except an optional markdown description below it.
Output ONLY the raw SKILL.md content.`;

    // 2. Generate script.ts
    const promptTs = `Generate the TypeScript execution logic for a new skill called '${safeName}'.
Description: ${description}
User Intent / Logic: ${userIntent}

Requirements:
- Must export a default async function that takes 'args' (matching the parameters) and an optional 'context'.
- Do NOT use python. Must be 100% Node.js / TypeScript.
- Return a string result.
- Handle basic errors.
- You can import typical node modules (fs, path, axios/fetch if needed).
Output ONLY the raw TypeScript code, no markdown code blocks formatting if possible, just the raw code.`;

    try {
      const [resMd, resTs] = await Promise.all([
        executeWithRetry(async (client) => {
          return await client.chat({
            model: config.llm.model,
            messages: [{ role: 'system', content: promptMd }],
            temperature: 0.1
          });
        }),
        executeWithRetry(async (client) => {
          return await client.chat({
            model: config.llm.model,
            messages: [{ role: 'system', content: promptTs }],
            temperature: 0.1
          });
        })
      ]);
      
      let mdContent = resMd.message.content || '';
      let tsContent = resTs.message.content || '';
      
      // Clean markdown fences
      mdContent = mdContent.replace(/\`\`\`markdown/g, '').replace(/\`\`\`yaml/g, '').replace(/\`\`\`/g, '').trim();
      tsContent = tsContent.replace(/\`\`\`typescript/g, '').replace(/\`\`\`ts/g, '').replace(/\`\`\`/g, '').trim();
      
      fs.mkdirSync(skillDir, { recursive: true });
      fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
      
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), mdContent);
      fs.writeFileSync(path.join(skillDir, 'scripts', 'execute.ts'), tsContent);
      
      console.log(pc.green(`[SkillExtractor] Successfully synthesized skill '${safeName}'.`));
      
      // Hot-reload skills
      const { pluginManager } = require('../plugin/registry');
      if (pluginManager && pluginManager.agentSkills) {
        await pluginManager.agentSkills.discoverSkills();
      }
      
      return true;
    } catch (err: any) {
      console.error(pc.red(`[SkillExtractor] Failed to generate skill: ${err.message}`));
      return false;
    }
  }
}

export const skillExtractor = new SkillExtractor();
