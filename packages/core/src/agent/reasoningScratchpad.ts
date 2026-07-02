/**
 * ReasoningScratchpad — P1: Persistent Reasoning Memory
 *
 * Captures <think> blocks from LLM responses and makes the distilled
 * reasoning available as context for subsequent turns within the same request.
 * This mirrors how Claude/Gemini maintain internal chain-of-thought continuity.
 */
export class ReasoningScratchpad {
  private entries: { turn: number; summary: string }[] = [];

  /**
   * Extract and store the think block from a raw LLM response.
   * Returns the cleaned response (think tags removed) for display.
   */
  public capture(rawContent: string, turn: number): string {
    const thinkRegex = /<(think|thought|thinking|reasoning|analysis|reflection)>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = thinkRegex.exec(rawContent)) !== null) {
      const thinkText = match[2].trim();
      if (thinkText.length > 20) {
        // Distil to first 600 chars to avoid bloating the next prompt
        this.entries.push({ turn, summary: thinkText.slice(0, 600) });
      }
    }
    // Return content with think blocks stripped
    return rawContent
      .replace(/<(think|thought|thinking|reasoning|analysis|reflection)>[\s\S]*?<\/\1>\n?/gi, '')
      .trim();
  }

  /**
   * Build an injection string for the next turn's system prompt.
   * Only surfaces the last 2 think blocks to keep token usage lean.
   */
  public getInjection(): string {
    if (this.entries.length === 0) return '';
    const recent = this.entries.slice(-2);
    const lines = recent.map(e => `[Turn ${e.turn}] ${e.summary}`).join('\n');
    return `\n\n--- 🧠 REASONING CONTINUITY (your prior internal thoughts) ---\n${lines}\nUse these prior conclusions to avoid re-deriving the same logic.\n`;
  }

  public isEmpty(): boolean {
    return this.entries.length === 0;
  }
}
