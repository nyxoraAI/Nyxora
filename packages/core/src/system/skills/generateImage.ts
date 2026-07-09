import fs from 'fs';
import os from 'os';
import path from 'path';
import { OpenAI } from 'openai';
import { loadApiKeys } from '../../config/parser';

export const generateImageToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_image',
    description: 'Generates an image using OpenAI DALL-E 3 based on a text prompt. The image is downloaded locally and the absolute file path is returned.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'A highly detailed text prompt describing the image you want to generate.'
        }
      },
      required: ['prompt']
    }
  }
};

export async function generateImage(prompt: string): Promise<string> {
  try {
    const keys = await loadApiKeys();
    const openAIKey = keys['openai_key'];
    
    if (!openAIKey) {
        return `[Security Error] No openai_key found in the vault. Please run 'nyxora set-key openai' first.`;
    }

    const openai = new OpenAI({ apiKey: openAIKey });
    
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
    });

    const imageUrl = response.data[0].url;
    if (!imageUrl) {
        return `[Error] Failed to get image URL from OpenAI.`;
    }

    const res = await fetch(imageUrl);
    const buffer = await res.arrayBuffer();
    
    const imagesDir = path.join(os.homedir(), '.nyxora', 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const safeName = prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `dalle-${Date.now()}-${safeName}.png`;
    const localFilePath = path.join(imagesDir, filename);
    
    fs.writeFileSync(localFilePath, Buffer.from(buffer));

    return `Success! Image generated and saved locally at: ${localFilePath}`;
  } catch (error: any) {
    return `[System Error] Failed to generate image: ${error.message}`;
  }
}
