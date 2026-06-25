// Hard-Coded Memory Validator (Anti-Injection Shield)
// Verifies that extracted memories do NOT contain sensitive data or prompt injections.

export class MemoryValidator {
  /**
   * Evaluates a string and throws an error if it contains forbidden patterns.
   * Returns true if safe.
   */
  public static validate(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    // 1. Check for Private Key patterns (64 char hex string, with or without 0x)
    const privateKeyRegex = /(?:0x)?[a-fA-F0-9]{64}\b/g;
    if (privateKeyRegex.test(text)) {
      throw new Error('SECURITY VIOLATION: Potential Private Key detected in memory extraction.');
    }

    // Removed overly aggressive 12-word mnemonic check to avoid false positives in conversational languages

    // 3. Check for API/Bot Tokens (e.g., Telegram token format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
    const telegramTokenRegex = /\b\d{8,10}:[a-zA-Z0-9_-]{35}\b/g;
    if (telegramTokenRegex.test(text)) {
      throw new Error('SECURITY VIOLATION: Potential Telegram Bot Token detected in memory extraction.');
    }

    // OpenAI Key / general API keys
    const openAIKeyRegex = /\bsk-[a-zA-Z0-9]{32,}\b/g;
    if (openAIKeyRegex.test(text)) {
      throw new Error('SECURITY VIOLATION: Potential OpenAI/API Key detected in memory extraction.');
    }

    // 4. Prompt Injection / System Override Keywords
    const injectionKeywords = [
      'system override',
      'ignore previous instructions',
      'ignore all previous',
      'you are now',
      'override memory',
      'bypass security',
      'system prompt'
    ];

    const lowerText = text.toLowerCase();
    for (const keyword of injectionKeywords) {
      if (lowerText.includes(keyword)) {
        throw new Error(`SECURITY VIOLATION: Prompt Injection pattern detected: '${keyword}'`);
      }
    }

    return true;
  }

  /**
   * Sanitizes text to just strip out minor bad things, but mainly relies on validate() to reject completely.
   */
  public static sanitize(text: string): string {
    return text.trim().replace(/[<>]/g, ''); // Basic XSS prevention if rendered in dashboard
  }
}
