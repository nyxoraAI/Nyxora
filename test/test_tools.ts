import { OSAgent } from './packages/core/src/agent/osAgent';
const agent = new OSAgent();
const tools = agent['activeTools'];
console.log(tools.map(t => t.function.name));
