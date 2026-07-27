import { describe, it, expect } from 'vitest';
import { PromptBuilder } from './promptBuilder';

describe('PromptBuilder', () => {
  it('should include desktop thinking card hints when platform is desktop', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'desktop',
    });

    expect(prompt).toContain('MARKDOWN & PLATFORM GUIDANCE (DESKTOP)');
    expect(prompt).toContain('REASONING BLOCKS ALLOWED: You may include <think>...</think> tags for your internal reasoning; the Dashboard and Desktop UI renders them as collapsible thinking cards.');
  });

  it('should include CLI formatting hints when platform is cli', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('MARKDOWN & PLATFORM GUIDANCE (CLI)');
    expect(prompt).toContain('REASONING IN VISIBLE OUTPUT: Do not emit raw <think>...</think> tags in your final conversational response; present only your polished, structured answer.');
  });

  it('should include Response Quality guidelines in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('# Response Quality');
    expect(prompt).toContain('Always produce clear, natural, and grammatically correct English.');
    expect(prompt).toContain('The user must only receive the fully validated final response.');
  });

  it('should include Markdown Formatting guidelines in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('# Markdown Formatting');
    expect(prompt).toContain('When generating Markdown files, always produce clean, valid, and well-formatted Markdown.');
    expect(prompt).toContain('Markdown output must render correctly on GitHub Markdown, VS Code Preview, Obsidian, and common Markdown parsers.');
  });

  it('should include Content Quality, Table Quality, and Explain Instead of Listing guidelines in system prompt', async () => {
    const pb = new PromptBuilder();
    const prompt = await pb.buildSystemPrompt({
      agentType: 'general',
      userInput: 'hello',
      config: {},
      platform: 'cli',
    });

    expect(prompt).toContain('# Content Quality (CRITICAL)');
    expect(prompt).toContain('Do not generate shallow documentation.');
    expect(prompt).toContain('# Table Quality');
    expect(prompt).toContain('Tables are for summarizing information, not replacing explanations.');
    expect(prompt).toContain('# Explain Instead of Listing');
    expect(prompt).toContain('The goal is to teach, not merely enumerate.');
  });
});
