import { generateImage } from './packages/core/src/system/skills/generateImage';

async function test() {
    console.log("Starting test...");
    const result = await generateImage("A futuristic city at sunset");
    console.log("Result:", result);
}
test().catch(console.error);
