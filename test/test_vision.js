const { analyzeLocalImage } = require('./packages/core/dist/system/skills/analyzeImage.js');

async function test() {
    try {
        console.log('Testing analyzeLocalImage...');
        // We will pass a dummy prompt, and a path to some file that exists
        // Just to see if the module loads and calls Gemini.
        // Let's create a dummy image file first.
        const fs = require('fs');
        fs.writeFileSync('test.jpg', Buffer.from('dummy image data'));
        
        const res = await analyzeLocalImage('test.jpg', 'What is this?');
        console.log('Result:', res);
    } catch (e) {
        console.error('Crash:', e);
    }
}
test();
