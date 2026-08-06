import fs from 'fs';
import path from 'path';
import { loadConfig, loadApiKeys } from '../../config/parser';
import { executeWithRetry } from '../../utils/llmUtils';

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

  const buffer = fs.readFileSync(imagePath);
  const base64Data = buffer.toString('base64');
  
  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.heic') mimeType = 'image/heic';
  else if (ext === '.heif') mimeType = 'image/heif';

  const p = prompt.toLowerCase();
  let contentType = 'photo';
  if (p.includes('screenshot') || p.includes('ui')) contentType = 'screenshot';
  else if (p.includes('chart') || p.includes('graph')) contentType = 'chart';
  else if (p.includes('diagram') || p.includes('flowchart')) contentType = 'diagram';
  else if (p.includes('document') || p.includes('text') || p.includes('markdown')) contentType = 'document';

  const config = loadConfig();
  const model = config.llm?.model || 'gpt-4o-mini';

  let sysPrompt = 'You are a helpful vision assistant. Analyze the image and answer the prompt.';
  if (contentType !== 'photo') {
      sysPrompt += `\nThe user is asking about a ${contentType}. Provide a structured, well-formatted response with clear sections.`;
  }

  try {
    const response = await executeWithRetry(async (client) => {
      return await client.chat({
        model: model,
        messages: [
          { role: 'system', content: sysPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              { type: 'text', text: prompt }
            ]
          }
        ],
        temperature: 0.1
      });
    });

    return response.message.content || "[Error] No content generated.";
  } catch (error: any) {
    if (config.llm?.provider === 'gemini') {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const keys = await loadApiKeys();
        const geminiKey = keys['gemini_key'];
        
        if (geminiKey) {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const geminiModel = genAI.getGenerativeModel({ 
              model: 'gemini-2.5-flash',
              generationConfig: { temperature: 0.1 }
          });
          
          const response = await geminiModel.generateContent([
              prompt,
              {
                  inlineData: {
                      data: base64Data,
                      mimeType: mimeType
                  }
              }
          ]);
          return response.response.text() || "[Error] No content generated.";
        }
      } catch (geminiError: any) {
        return `[System Error] Primary and Gemini fallback failed: ${error.message} / ${geminiError.message}`;
      }
    }
    return `[System Error] Failed to analyze image: ${error.message}`;
  }
}
