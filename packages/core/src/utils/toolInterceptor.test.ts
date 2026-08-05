import { describe, it, expect } from 'vitest';
import { StreamingToolInterceptor } from './toolInterceptor';

describe('StreamingToolInterceptor', () => {

  it('Test 1: Normal text passthrough', () => {
    const ti = new StreamingToolInterceptor();
    expect(ti.feed('hello world')).toBe('hello world');
  });

  it('Test 2: Simple tool block extraction', () => {
    const ti = new StreamingToolInterceptor();
    const out = ti.feed('prefix <execute_tool>{"tool_name":"bash","tool_params":{"cmd":"ls"}}</execute_tool> suffix');
    expect(out).toBe('prefix  suffix');
    const tools = ti.getExtractedTools();
    expect(tools[0]?.function?.name).toBe('bash');
    expect(tools[0]?.function?.arguments).toBe('{"cmd":"ls"}');
  });

  it('Test 3: Streamed in pieces (partial tags)', () => {
    const ti = new StreamingToolInterceptor();
    const r1 = ti.feed('hi <exec');
    const r2 = ti.feed('ute_tool>');
    ti.feed('{"tool_name":"cat","tool_params":{}}');
    ti.feed('</execute_tool>');
    expect(r1 + r2).toBe('hi ');
    const tools = ti.getExtractedTools();
    expect(tools[0]?.function?.name).toBe('cat');
  });

  it('Test 4: flush() when stream ends mid-tool-block — no raw JSON leak (BUG FIX #1)', () => {
    const ti = new StreamingToolInterceptor();
    ti.feed('<execute_tool>{"tool_name":"bash","tool_params":{"cmd":"pwd"}}');
    const flushed = ti.flush();
    expect(flushed).toBe('');
    const tools = ti.getExtractedTools();
    expect(tools[0]?.function?.name).toBe('bash');
  });

  it('Test 5: Overflow inside tool block does not leak JSON (BUG FIX #2)', () => {
    const ti = new StreamingToolInterceptor();
    ti.feed('<execute_tool>');
    const result = ti.feed('x'.repeat(100000));
    expect(result).toBe('');
  });

  it('Test 6: tool_params as pre-serialized JSON string (BUG FIX #3)', () => {
    const ti = new StreamingToolInterceptor();
    ti.feed('<execute_tool>{"tool_name":"bash","tool_params":"{\\"cmd\\":\\"echo hi\\"}"}</execute_tool>');
    const tools = ti.getExtractedTools();
    expect(() => JSON.parse(tools[0]?.function?.arguments)).not.toThrow();
  });

  it('Test 7: tool_params as null normalizes to {} (BUG FIX #3)', () => {
    const ti = new StreamingToolInterceptor();
    ti.feed('<execute_tool>{"tool_name":"ping","tool_params":null}</execute_tool>');
    const tools = ti.getExtractedTools();
    expect(tools[0]?.function?.arguments).toBe('{}');
  });

  it('Test 8: flush() outside tool block returns buffered partial tag', () => {
    const ti = new StreamingToolInterceptor();
    const emitted = ti.feed('partial <exec');
    const flushed = ti.flush();
    expect(emitted).toBe('partial ');
    expect(flushed).toBe('<exec');
  });

  it('Test 9: Multiple tool calls in one stream', () => {
    const ti = new StreamingToolInterceptor();
    ti.feed('a <execute_tool>{"tool_name":"t1","tool_params":{}}</execute_tool> b <execute_tool>{"tool_name":"t2","tool_params":{}}</execute_tool> c');
    const tools = ti.getExtractedTools();
    expect(tools[0]?.function?.name).toBe('t1');
    expect(tools[1]?.function?.name).toBe('t2');
  });

  it('Test 10: Empty feed returns empty string (BUG FIX #4)', () => {
    const ti = new StreamingToolInterceptor();
    expect(ti.feed('')).toBe('');
  });

});
