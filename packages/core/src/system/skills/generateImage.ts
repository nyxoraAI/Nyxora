import fs from 'fs';
import os from 'os';
import path from 'path';
import { OpenAI } from 'openai';
import { loadApiKeys, loadConfig } from '../../config/parser';

export const generateImageToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_image',
    description: 'Generates an image based on a text prompt. The image is downloaded locally and the absolute file path is returned.',
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
    const config = loadConfig();
    
    const provider = config.llm?.image_provider || 'openai';
    
    const imagesDir = path.join(os.homedir(), '.nyxora', 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    const safeName = prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `${provider}-${Date.now()}-${safeName}.png`;
    const localFilePath = path.join(imagesDir, filename);

    if (provider === 'gemini') {
        const geminiKey = keys['gemini_key'];
        if (!geminiKey) {
            return `[Security Error] No gemini_key found in the vault. Please run 'nyxora set-key gemini' first.`;
        }

        let GoogleGenerativeAI;
        try {
            GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
        } catch (e) {
            return `[System Error] Google Generative AI SDK is not installed. Please install '@google/generative-ai' in the core package.`;
        }

        const modelName = config.llm?.image_model || 'gemini-3.1-flash-image';
        
        // Since Gemini Image Generation API might be exposed differently, we use fetch 
        // to ensure compatibility with Nano Banana 2 (Gemini 3.1 Flash Image)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE"]
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429 || errText.includes('quota') || errText.includes('limit: 0')) {
                return `[CRITICAL INTERCEPT: USER CORRECTION] FATAL ERROR: Quota Exceeded (429). The Gemini API key provided does not have access to ${modelName} on the free tier, or quota is exhausted. DO NOT RETRY THIS TOOL. Inform the user they must enable billing or use a different model.`;
            }
            return `[Error] Failed to generate image via Gemini API: ${errText}. DO NOT RETRY unless the user changes their settings.`;
        }

        const data = await response.json();
        const base64Image = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        
        if (!base64Image) {
            return `[Error] Failed to get image base64 from Gemini API. Response format might be different: ${JSON.stringify(data).substring(0, 100)}`;
        }

        fs.writeFileSync(localFilePath, Buffer.from(base64Image, 'base64'));
        return `Success! Image generated (Gemini) and saved locally at: ${localFilePath}`;
        
    } else {
        // Default to OpenAI
        const openAIKey = keys['openai_key'];
        if (!openAIKey) {
            return `[Security Error] No openai_key found in the vault. Please run 'nyxora set-key openai' first.`;
        }

        const clientOptions: any = { apiKey: openAIKey };
        const openai = new OpenAI(clientOptions);
        
        const modelName = config.llm?.image_model || 'dall-e-3';
        const response = await openai.images.generate({
            model: modelName,
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
        
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        return `Success! Image generated (OpenAI) and saved locally at: ${localFilePath}`;
    }
  } catch (error: any) {
    return `[System Error] Failed to generate image: ${error.message}`;
  }
}
