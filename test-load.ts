import { initializePlugins, pluginManager } from "./packages/core/src/plugin/registry";
async function test() {
  await initializePlugins();
  console.log(pluginManager.getPlugins().map(p => p.name));
}
test();
