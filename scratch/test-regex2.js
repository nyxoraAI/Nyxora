const str1 = "Tunggu bentar ya... ```json\n[\n  {\n    \"tool_name\": \"check_portfolio\",\n";
const str2 = "Tunggu bentar ya... ```json\n{\n  \"tool_name\": \"check_portfolio\",\n";
const str3 = "Tunggu bentar ya... [\n  {\n    \"tool_name\": \"check_portfolio\",\n    \"tool_params\": {}\n  }\n]";

const clean = (s) => {
  return s
    // Strip markdown tool arrays (complete or incomplete)
    .replace(/```(?:json)?\s*\[?[\s\S]*?(?:"tool_name"|"function_name")[\s\S]*?(?:\]\s*```|```|$)/gi, '')
    // Also strip raw arrays without markdown
    .replace(/\[[\s\S]*?(?:"tool_name"|"function_name")[\s\S]*?(?:\]|$)/gi, '')
    .trim();
}

console.log(clean(str1));
console.log(clean(str2));
console.log(clean(str3));
