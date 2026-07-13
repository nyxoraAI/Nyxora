const strings = [
  "Tunggu bentar ya... ```json\n[\n  {\n    \"tool_name\": \"check_portfolio\",\n",
  "Tunggu bentar ya... ```json\n{\n  \"tool_name\": \"check_portfolio\",\n",
  "Tunggu bentar ya... [\n  {\n    \"tool_name\": \"check_portfolio\",\n    \"tool_params\": {}\n  }\n]",
  "Tunggu bentar ya... {\n  \"tool_name\": \"check_portfolio\",\n    \"tool_params\": {}\n  }",
  "Don't match this [1, 2, 3] and tool_name",
  "Don't match this { \"a\": 1 } and tool_name",
  "Tunggu bentar ya... ```json\n[\n  {\n    \"tool_name\": \"check_portfolio\",\n    \"tool_params\": {\n      \"wallet_address\": \"0xE5c21F46993C67CFe04FCF1579486D390Be7B535\",\n      \"chain\": \"robinhood\"\n    }\n  }\n]\n```",
  "Normal conversation about \"tool_name\": \"something\"."
];

const clean = (s) => {
  return s
    // Strip markdown tool calls (complete or streaming)
    .replace(/```(?:json)?\s*\[?\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]\s*```|```|$)/gi, '')
    .replace(/```(?:json)?\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\}\s*```|```|$)/gi, '')
    // Strip raw JSON tool calls
    .replace(/\[\s*\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\]|$)/gi, '')
    .replace(/\{\s*"(?:tool_name|function_name)"[\s\S]*?(?:\}|$)/gi, '')
    .trim();
}

strings.forEach((s, i) => {
  console.log(`--- Test ${i} ---`);
  console.log("OLD:", s);
  console.log("NEW:", clean(s));
});
