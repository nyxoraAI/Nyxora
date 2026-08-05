export class StreamingToolInterceptor {
  private buf: string = '';
  private extractedTools: any[] = [];
  private inToolBlock: boolean = false;
  private readonly MAX_PAYLOAD_BYTES = 100000;

  // We support multiple opening tags for future expansion (e.g., <function>, <execute>)
  private readonly OPEN_TAGS = ['<execute_tool>', '<execute>'];
  private readonly CLOSE_TAGS = ['</execute_tool>', '</execute>'];

  /**
   * Feeds a chunk of text from the LLM stream into the interceptor.
   * Returns text that is safe to be displayed to the user (i.e. not part of a tool call).
   */
  public feed(text: string): string {
    if (!text) return '';
    this.buf += text;

    // Prevent OOM / Infinite Hallucination Loop
    // BUG FIX: Previously, overflowing in the middle of a tool block would leak raw JSON
    // to the user. We now discard the buffer safely without exposing tool internals.
    if (this.buf.length > this.MAX_PAYLOAD_BYTES) {
      console.warn(`[StreamingToolInterceptor] Buffer exceeded ${this.MAX_PAYLOAD_BYTES} bytes. Forcing flush to prevent memory leak.`);
      if (this.inToolBlock) {
        // We are inside a tool block — discard the partial tool payload silently.
        // Do NOT return raw JSON to the user.
        this.buf = '';
        this.inToolBlock = false;
        return '';
      }
      const flushed = this.buf;
      this.buf = '';
      return flushed;
    }

    let outText = '';

    while (this.buf.length > 0) {
      if (this.inToolBlock) {
        // Look for the earliest closing tag
        const { index: closeIdx, length: closeLen } = this.findEarliestTag(this.buf, this.CLOSE_TAGS);

        if (closeIdx === -1) {
          // If not found, check if a partial close tag is at the end of the buffer
          const partial = this.findMaxPartialSuffix(this.buf, this.CLOSE_TAGS);
          if (partial > 0) {
            // Wait for more chunks to see if it completes the close tag
            return outText;
          }
          // We are still fully inside the block, just buffer it and return nothing.
          return outText;
        }

        // Found closing tag! Extract the tool call.
        const blockContent = this.buf.slice(0, closeIdx);
        this.extractTool(blockContent);

        // Remove the block and closing tag from buffer
        this.buf = this.buf.slice(closeIdx + closeLen);
        this.inToolBlock = false;
      } else {
        // We are NOT in a tool block. Look for the earliest opening tag.
        const { index: openIdx, length: openLen } = this.findEarliestTag(this.buf, this.OPEN_TAGS);

        if (openIdx !== -1) {
          // Found an open tag!
          // Everything BEFORE the open tag is safe text to emit.
          outText += this.buf.slice(0, openIdx);
          this.inToolBlock = true;
          // Trim the buffer to start right after the open tag
          this.buf = this.buf.slice(openIdx + openLen);
        } else {
          // No full open tag found.
          // Is there a partial open tag at the end of the buffer? (e.g. `<exe`)
          const partial = this.findMaxPartialSuffix(this.buf, this.OPEN_TAGS);
          if (partial > 0) {
            // Emit everything BEFORE the partial tag, keep the partial tag in buffer
            const safeLen = this.buf.length - partial;
            outText += this.buf.slice(0, safeLen);
            this.buf = this.buf.slice(safeLen);
            return outText;
          }

          // No partial tag. The entire buffer is safe to emit.
          outText += this.buf;
          this.buf = '';
          return outText;
        }
      }
    }

    return outText;
  }

  /**
   * Flushes any remaining text in the buffer. Call this when the stream ends.
   *
   * BUG FIX: Previously, if the stream ended mid-tool-block, the raw JSON payload
   * would be returned verbatim to the caller and displayed to the user.
   * Now, an incomplete tool block is attempted to be parsed (best-effort), and
   * any remaining content in inToolBlock state is discarded rather than leaked.
   */
  public flush(): string {
    const remaining = this.buf;
    this.buf = '';

    if (this.inToolBlock) {
      // Stream ended while inside a tool block — attempt best-effort extraction.
      // The JSON may be incomplete, but try anyway. If it fails, discard silently.
      if (remaining.trim()) {
        this.extractTool(remaining);
      }
      this.inToolBlock = false;
      // Do NOT return the raw partial JSON to the caller.
      return '';
    }

    this.inToolBlock = false;
    return remaining;
  }

  /**
   * Retrieves and clears the list of natively constructed tool calls parsed from the stream.
   */
  public getExtractedTools(): any[] {
    const tools = [...this.extractedTools];
    this.extractedTools = [];
    return tools;
  }

  private findEarliestTag(text: string, tags: string[]): { index: number, length: number } {
    const textLower = text.toLowerCase();
    let bestIdx = -1;
    let bestLen = 0;

    for (const tag of tags) {
      const idx = textLower.indexOf(tag.toLowerCase());
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        bestLen = tag.length;
      }
    }
    return { index: bestIdx, length: bestLen };
  }

  private findMaxPartialSuffix(text: string, tags: string[]): number {
    if (!text) return 0;
    const textLower = text.toLowerCase();
    // Max length to check is the longest tag minus 1
    const maxTagLen = Math.max(...tags.map(t => t.length));
    const maxCheck = Math.min(textLower.length, maxTagLen - 1);

    for (let i = maxCheck; i > 0; i--) {
      const suffix = textLower.slice(-i);
      for (const tag of tags) {
        if (tag.toLowerCase().startsWith(suffix)) {
          return i;
        }
      }
    }
    return 0;
  }

  private extractTool(jsonStr: string) {
    try {
      // The JSON might be wrapped in ```json ... ``` or similar.
      const cleaned = jsonStr.replace(/```json/gi, '').replace(/```/gi, '').trim();
      if (!cleaned) return;
      const parsed = JSON.parse(cleaned);
      if (parsed.tool_name) {
        // BUG FIX: tool_params may not always be a plain object (could be null, string, etc.).
        // Ensure arguments is always a valid JSON string of an object.
        let argsStr: string;
        const params = parsed.tool_params;
        if (params !== null && params !== undefined && typeof params === 'object' && !Array.isArray(params)) {
          argsStr = JSON.stringify(params);
        } else if (typeof params === 'string') {
          // Some models may send a pre-serialized JSON string — try to validate it.
          try {
            JSON.parse(params); // validate it is already valid JSON
            argsStr = params;
          } catch {
            argsStr = JSON.stringify({});
          }
        } else {
          argsStr = JSON.stringify({});
        }

        this.extractedTools.push({
          id: `call_${Math.random().toString(36).substring(7)}`,
          type: 'function',
          function: {
            name: parsed.tool_name,
            arguments: argsStr
          }
        });
      }
    } catch (e) {
      console.warn('[StreamingToolInterceptor] Failed to parse intercepted tool JSON payload', e);
    }
  }
}
