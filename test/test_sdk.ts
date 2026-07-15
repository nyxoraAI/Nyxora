import { GoogleGenAI } from '@google/genai';
import { loadApiKeys } from './packages/core/src/config/parser';

async function test() {
    const keys = await loadApiKeys();
    const ai = new GoogleGenAI({ apiKey: keys['gemini_key'] });
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'say hello'
    });
    console.log('type of res.text:', typeof res.text);
    console.log('res.text value:', res.text);
}
test();
