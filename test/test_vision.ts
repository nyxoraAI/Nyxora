import { analyzeLocalImage } from './packages/core/src/system/skills/analyzeImage';
import fs from 'fs';

async function test() {
    try {
        console.log('Testing analyzeLocalImage...');
        fs.writeFileSync('test.jpg', Buffer.from('dummy image data'));
        const res = await analyzeLocalImage('test.jpg', 'What is this?');
        console.log('Result:', res);
    } catch (e) {
        console.error('Crash:', e);
    }
}
test();
