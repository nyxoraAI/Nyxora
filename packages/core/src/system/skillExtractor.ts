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
    const promptMd = `Generate the SKILL.md file for a new skill called '${safeName}'.
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

Below the frontmatter, write the step-by-step markdown instructions for how the AI should execute this skill using its native tools (like run_terminal_command, curl, python3). Provide the exact commands needed. Do NOT write any TypeScript or Node.js code. Make it an instruction-based playbook.
Output ONLY the raw SKILL.md content.`;

    try {
      const resMd = await executeWithRetry(async (client) => {
        return await client.chat({
          model: config.llm.model,
          messages: [{ role: 'system', content: promptMd }],
          temperature: 0.1
        });
      });
      
      let mdContent = resMd.message.content || '';
      
      // Clean markdown fences
      mdContent = mdContent.replace(/\`\`\`markdown/g, '').replace(/\`\`\`yaml/g, '').replace(/\`\`\`/g, '').trim();
      
      fs.mkdirSync(skillDir, { recursive: true });
      
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), mdContent);
      
      console.log(pc.green(`[SkillExtractor] Successfully synthesized instruction-based skill '${safeName}'.`));
      
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
