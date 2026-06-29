import { initializePlugins, pluginManager } from "./src/plugin/registry";
async function test() {
  await initializePlugins();
  const tools = pluginManager.getAllToolDefinitions();
  const names = tools.map(t => t.function.name);
  console.log("OS/All Tools available:", names.filter(n => n.includes('file') || n.includes('terminal')).join(', '));
}
test();
