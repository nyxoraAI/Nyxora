import { pluginManager } from "./packages/core/src/plugin/registry";
import { Web3DefiPlugin } from "./packages/core/src/web3/plugins/Web3DefiPlugin";
import { Web3SecurityPlugin } from "./packages/core/src/web3/plugins/Web3SecurityPlugin";

const defi = new Web3DefiPlugin();
const security = new Web3SecurityPlugin();

pluginManager.register(defi);
pluginManager.register(security);

const tools = pluginManager.getAllToolDefinitions();
const names = tools.map(t => t.function.name);
console.log("Tools available:", names.join(', '));
