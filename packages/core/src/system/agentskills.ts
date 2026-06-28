import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { getPath } from '../config/paths';

export interface SkillParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface SkillManifest {
  name: string;
  description: string;
  parameters?: Record<string, SkillParameter>;
  required?: string[];
  version?: string;
  author?: string;
  main?: string; // e.g. "scripts/execute.ts"
}

export class AgentSkills {
  private skillsDir: string;
  private activeSkills: Map<string, SkillManifest> = new Map();
  private openAiSchemas: any[] = [];

  constructor() {
    this.skillsDir = getPath('skills');
    this.ensureSkillsDirectory();
  }

  private ensureSkillsDirectory(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }
    
    // Auto-seed default skills for new users
    const defaultSkillsDir = path.join(__dirname, '..', '..', 'default_skills');
    if (fs.existsSync(defaultSkillsDir)) {
      const defaultSkills = fs.readdirSync(defaultSkillsDir, { withFileTypes: true });
      for (const entry of defaultSkills) {
        if (entry.isDirectory()) {
          const targetPath = path.join(this.skillsDir, entry.name);
          if (!fs.existsSync(targetPath)) {
            fs.cpSync(path.join(defaultSkillsDir, entry.name), targetPath, { recursive: true });
            console.log(`[AgentSkills] Seeded default skill: ${entry.name}`);
          }
        }
      }
    }
  }

  /**
   * Scans the ~/.nyxora/skills/ directory and parses all SKILL.md files.
   * Caches the active skills and generates OpenAI Tool Schemas.
   */
  public async discoverSkills(disabledSkills: string[] = []): Promise<void> {
    this.activeSkills.clear();
    this.openAiSchemas = [];

    if (!fs.existsSync(this.skillsDir)) return;

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillName = entry.name;
      
      // Skip if explicitly disabled
      if (disabledSkills.includes(skillName)) continue;

      const skillMdPath = path.join(this.skillsDir, skillName, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const manifest = this.parseFrontmatter(skillMdPath);
        if (manifest && manifest.name) {
          // If the skill doesn't declare a main script, fallback to scripts/execute.ts
          if (!manifest.main) {
            manifest.main = 'scripts/execute.ts';
          }
          this.activeSkills.set(manifest.name, manifest);
          this.openAiSchemas.push(this.manifestToOpenAiSchema(manifest));
        }
      } catch (err) {
        console.error(`[AgentSkills] Error parsing SKILL.md for ${skillName}:`, err);
      }
    }
  }

  /**
   * Extracts and parses YAML frontmatter from a SKILL.md file
   */
  private parseFrontmatter(filePath: string): SkillManifest | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const yamlRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(yamlRegex);
    
    if (match && match[1]) {
      return yaml.parse(match[1]) as SkillManifest;
    }
    return null;
  }

  /**
   * Translates a standard SKILL.md manifest into an OpenAI Tool JSON Schema
   */
  private manifestToOpenAiSchema(manifest: SkillManifest): any {
    const properties: Record<string, any> = {};
    
    if (manifest.parameters) {
      for (const [key, val] of Object.entries(manifest.parameters)) {
        properties[key] = {
          type: val.type,
          description: val.description,
          ...(val.enum ? { enum: val.enum } : {})
        };
      }
    }

    return {
      type: 'function',
      function: {
        name: manifest.name,
        description: manifest.description,
        parameters: {
          type: 'object',
          properties: properties,
          required: manifest.required || []
        }
      }
    };
  }

  public getToolSchemas(): any[] {
    return this.openAiSchemas;
  }

  public getSkillManifest(name: string): SkillManifest | undefined {
    return this.activeSkills.get(name);
  }

  /**
   * Dynamically loads and executes the skill's code script.
   */
  public async executeSkill(name: string, args: any): Promise<string> {
    const manifest = this.activeSkills.get(name);
    if (!manifest) {
      throw new Error(`Skill '${name}' is not loaded or does not exist.`);
    }

    const scriptPath = path.join(this.skillsDir, name, manifest.main || 'scripts/execute.ts');
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Execution script not found for skill '${name}' at path: ${scriptPath}`);
    }

    try {
      // Dynamic import of the TS/JS module
      const module = await import(scriptPath);
      
      // We expect every skill module to export a default function or an 'execute' function
      if (module.execute && typeof module.execute === 'function') {
        return await module.execute(args);
      } else if (module.default && typeof module.default === 'function') {
        return await module.default(args);
      } else {
        throw new Error(`Skill module '${name}' must export an 'execute' or 'default' function.`);
      }
    } catch (err: any) {
      console.error(`[AgentSkills] Error executing skill '${name}':`, err);
      return `Failed to execute skill '${name}': ${err.message}`;
    }
  }
}
