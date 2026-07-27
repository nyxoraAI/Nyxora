import { describe, it, expect, beforeEach } from 'vitest';
import { stripThinkBlocks, StreamingThinkScrubber } from './thinkScrubber';

describe('thinkScrubber', () => {
  describe('stripThinkBlocks', () => {
    it('should remove complete <think>...</think> blocks from static string', () => {
      const input = '<think>some internal reasoning</think>Hello world!';
      expect(stripThinkBlocks(input)).toBe('Hello world!');
    });

    it('should remove <reasoning> blocks and orphan close tags', () => {
      const input = '<reasoning>checking files...</reasoning>Here is the file content.</reasoning>';
      expect(stripThinkBlocks(input)).toBe('Here is the file content.');
    });

    it('should leave normal text untouched', () => {
      const input = 'Here is your answer with no thinking tags.';
      expect(stripThinkBlocks(input)).toBe('Here is your answer with no thinking tags.');
    });
  });

  describe('StreamingThinkScrubber', () => {
    let scrubber: StreamingThinkScrubber;

    beforeEach(() => {
      scrubber = new StreamingThinkScrubber();
    });

    it('should handle a think block split across multiple deltas', () => {
      const chunk1 = '<thi';
      const chunk2 = 'nk>internal thoughts';
      const chunk3 = '</think>Hi there!';

      const out1 = scrubber.feed(chunk1);
      const out2 = scrubber.feed(chunk2);
      const out3 = scrubber.feed(chunk3);

      expect(out1).toBe('');
      expect(out2).toBe('');
      expect(out3).toBe('Hi there!');
    });

    it('should handle orphan partial tags when stream ends', () => {
      const chunk1 = 'Hello user! <thi';
      const out1 = scrubber.feed(chunk1);
      const tail = scrubber.flush();

      expect(out1).toBe('Hello user! ');
      expect(tail).toBe('<thi');
    });

    it('should scrub complete think blocks within a single chunk', () => {
      const chunk = '<think>hidden</think>Visible response';
      expect(scrubber.feed(chunk)).toBe('Visible response');
    });

    it('should preserve think blocks when platform is dashboard or desktop', () => {
      const input = '<think>some reasoning</think>Hello!';
      expect(stripThinkBlocks(input, 'dashboard')).toBe(input);
      expect(stripThinkBlocks(input, 'desktop')).toBe(input);

      const desktopScrubber = new StreamingThinkScrubber('desktop');
      expect(desktopScrubber.feed(input)).toBe(input);
    });
  });
});

