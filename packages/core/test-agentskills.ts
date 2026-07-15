import { AgentSkills } from "./src/system/agentskills";
async function test() {
  const agentSkills = new AgentSkills();
  await agentSkills.discoverSkills();
  const schemas = agentSkills.getToolSchemas();
  console.log("Loaded Skill names:", schemas.map(s => s.function.name));
}
test();
