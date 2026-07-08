import fs from 'fs';
import path from 'path';
import { loadApiKeys } from '../../config/parser';

export const analyzeLocalImageToolDefinition = {
  type: 'function',
  function: {
    name: 'analyze_local_image',
    description: 'Analyze a local image file using a Vision LLM to extract text, describe the image, or answer questions about it.',
    parameters: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'The absolute path to the local image file (e.g. /home/user/image.png).'
        },
        prompt: {
          type: 'string',
          description: 'Instructions on what to analyze or extract from the image (e.g. "Extract all text", "Describe this UI", "Convert this to markdown").'
        }
      },
      required: ['imagePath', 'prompt']
    }
  }
};

export async function analyzeLocalImage(imagePath: string, prompt: string): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    return `[Error] Image file not found at path: ${imagePath}`;
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const keys = await loadApiKeys();
    const geminiKey = keys['gemini_key'];
    
    if (!geminiKey) {
        return `[Security Error] No gemini_key found in the vault. Please run 'nyxora set-key gemini' first.`;
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1 }
    });
    
    // Read file and determine mime type
    const buffer = fs.readFileSync(imagePath);
    const base64Data = buffer.toString('base64');
    
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.heic') mimeType = 'image/heic';
    else if (ext === '.heif') mimeType = 'image/heif';

    const response = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        }
    ]);

    return response.response.text() || "[Error] No content generated.";
  } catch (error: any) {
    return `[System Error] Failed to analyze image: ${error.message}`;
  }
}
