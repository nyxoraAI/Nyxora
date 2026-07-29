import { describe, it, expect } from 'vitest';
import { PromptBuilder } from './promptBuilder';

describe('PromptBuilder', () => {


  it('should include Communication & Identity guidelines in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('## 1. COMMUNICATION & IDENTITY (Zero-Fluff)');
    expect(prompt).toContain('NEVER use meta-phrases');
    expect(prompt).toContain('NEVER summarize unless explicitly requested.');
  });

  it('should include Markdown Layout Restrictions in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('MARKDOWN LAYOUT RESTRICTIONS (ABSOLUTE - HIGHEST PRIORITY)');
    expect(prompt).toContain('EVERY line MUST begin at column 0.');
    expect(prompt).toContain('ALWAYS use triple-backtick fenced code blocks.');
  });

  it('should include Security, JSON, and Web constraints in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('## 5. SECURITY & ETHICS (Ironclad Constraints)');
    expect(prompt).toContain('NEVER commit secrets or API keys');
    expect(prompt).toContain('## 10. JSON & DATA PARSING MASTERY');
    expect(prompt).toContain('NEVER leak raw JSON, technical details, or stack traces directly into the UI.');
    expect(prompt).toContain('## 7. BROWSER & UI AUTOMATION');
    expect(prompt).toContain('ALWAYS include the `tab_id` when operating browser tools.');
  });
});
