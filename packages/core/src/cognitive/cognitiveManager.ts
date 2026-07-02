import fs from 'fs';
import path from 'path';

export class CognitiveManager {
  private promptsPath: string;

  constructor() {
    this.promptsPath = path.join(__dirname, 'prompts');
  }

  public loadActiveCognitiveSkills(intent: string): string {
    const activeSOPs: string[] = [];
    const lowerIntent = intent.toLowerCase();

    // Mapping of keywords to SOP paths
    const skillMappings = [
      {
        keywords: ['debug', 'error', 'bug', 'fix', 'crash', 'fail', 'trace'],
        file: 'software-development/systematic-debugging.md'
      },
      {
        keywords: ['tdd', 'test', 'red green', 'unit test', 'jest', 'mocha'],
        file: 'software-development/test-driven-development.md'
      },
      {
        keywords: ['plan', 'architecture', 'design', 'structure', 'blueprint'],
        file: 'software-development/plan.md'
      },
    ];

    for (const mapping of skillMappings) {
      if (mapping.keywords.some(kw => lowerIntent.includes(kw))) {
        const fullPath = path.join(this.promptsPath, mapping.file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          activeSOPs.push(`--- COGNITIVE SKILL: ${path.basename(mapping.file, '.md').toUpperCase()} ---\n${content}`);
        }
      }
    }

    if (activeSOPs.length === 0) {
      return '';
    }

    return activeSOPs.join('\n\n');
  }
}

export const cognitiveManager = new CognitiveManager();
