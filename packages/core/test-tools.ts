import { initializePlugins, pluginManager } from "./src/plugin/registry";
async function test() {
  await initializePlugins();
  const tools = pluginManager.getAllToolDefinitions();
  const names = tools.map(t => t.function.name);
  console.log(names);
}
test();
