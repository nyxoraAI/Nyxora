import { StreamingToolInterceptor } from './toolInterceptor';

let pass = 0;
let fail = 0;

function assert(label: string, cond: boolean) {
  if (cond) { console.log('  ✅ PASS:', label); pass++; }
  else       { console.error('  ❌ FAIL:', label); fail++; }
}

// ── Test 1: Normal text passthrough
{
  const ti = new StreamingToolInterceptor();
  const out = ti.feed('hello world');
  assert('Normal text passthrough', out === 'hello world');
}

// ── Test 2: Simple tool block extraction
{
  const ti = new StreamingToolInterceptor();
  const out = ti.feed('prefix <execute_tool>{"tool_name":"bash","tool_params":{"cmd":"ls"}}</execute_tool> suffix');
  assert('Text before tool block emitted', out === 'prefix  suffix');
  const tools = ti.getExtractedTools();
  assert('Tool extracted: name', tools[0]?.function?.name === 'bash');
  assert('Tool extracted: args', tools[0]?.function?.arguments === '{"cmd":"ls"}');
}

// ── Test 3: Streamed in pieces (partial tags)
{
  const ti = new StreamingToolInterceptor();
  const r1 = ti.feed('hi <exec');
  const r2 = ti.feed('ute_tool>');
  ti.feed('{"tool_name":"cat","tool_params":{}}');
  ti.feed('</execute_tool>');
  assert('Chunked stream text before tag', (r1 + r2) === 'hi ');
  const tools = ti.getExtractedTools();
  assert('Chunked stream tool extracted', tools[0]?.function?.name === 'cat');
}

// ── Test 4: flush() when stream ends mid-tool-block (BUG FIX #1)
{
  const ti = new StreamingToolInterceptor();
  ti.feed('<execute_tool>{"tool_name":"bash","tool_params":{"cmd":"pwd"}}');
  const flushed = ti.flush();
  assert('flush() mid-block returns empty string (no raw JSON leak)', flushed === '');
  const tools = ti.getExtractedTools();
  assert('flush() mid-block extracts tool best-effort', tools[0]?.function?.name === 'bash');
}

// ── Test 5: Overflow inside tool block does not leak JSON (BUG FIX #2)
{
  const ti = new StreamingToolInterceptor();
  ti.feed('<execute_tool>');
  // Feed a huge chunk to trigger the overflow guard
  const result = ti.feed('x'.repeat(100000));
  assert('Overflow inside tool block returns empty (no raw JSON leak)', result === '');
}

// ── Test 6: tool_params as pre-serialized JSON string (BUG FIX #3)
{
  const ti = new StreamingToolInterceptor();
  ti.feed('<execute_tool>{"tool_name":"bash","tool_params":"{\\"cmd\\":\\"echo hi\\"}"}</execute_tool>');
  const tools = ti.getExtractedTools();
  assert('tool_params as pre-serialized string: valid JSON args', (() => {
    try { JSON.parse(tools[0]?.function?.arguments); return true; } catch { return false; }
  })());
}

// ── Test 7: tool_params as null (BUG FIX #3)
{
  const ti = new StreamingToolInterceptor();
  ti.feed('<execute_tool>{"tool_name":"ping","tool_params":null}</execute_tool>');
  const tools = ti.getExtractedTools();
  assert('tool_params null → args is {}', tools[0]?.function?.arguments === '{}');
}

// ── Test 8: flush() outside tool block returns partial-tag remainder from buffer
// feed() correctly emits "partial " immediately and holds "<exec" in the buffer
// waiting for possible completion. flush() then returns the buffered partial tag.
{
  const ti = new StreamingToolInterceptor();
  const emitted = ti.feed('partial <exec');
  const flushed = ti.flush();
  assert('feed() emits text before partial tag', emitted === 'partial ');
  assert('flush() outside tool block returns buffered partial tag', flushed === '<exec');
}

// ── Test 9: Multiple tool calls in one stream
{
  const ti = new StreamingToolInterceptor();
  ti.feed('a <execute_tool>{"tool_name":"t1","tool_params":{}}</execute_tool> b <execute_tool>{"tool_name":"t2","tool_params":{}}</execute_tool> c');
  const tools = ti.getExtractedTools();
  assert('Multiple tools: first extracted', tools[0]?.function?.name === 't1');
  assert('Multiple tools: second extracted', tools[1]?.function?.name === 't2');
}

// ── Test 10: Empty feed
{
  const ti = new StreamingToolInterceptor();
  const out = ti.feed('');
  assert('Empty feed returns empty string', out === '');
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
