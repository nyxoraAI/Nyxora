import fs from 'fs';
import child_process from 'child_process';
import util from 'util';
import path from 'path';
import { executeWithRetry } from '../../utils/llmUtils';
import { loadConfig } from '../../config/parser';

const execFile = util.promisify(child_process.execFile);

export const analyzePdfToolDefinition = {
  type: 'function',
  function: {
    name: 'analyze_pdf',
    description: 'Extract text, markdown, or a summary from a PDF file.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the PDF file.'
        },
        mode: {
          type: 'string',
          enum: ['text', 'summary', 'structured'],
          description: 'Extraction mode: "text" (raw text), "summary" (LLM summarization), "structured" (markdown with tables).'
        },
        pages: {
          type: 'string',
          description: 'Optional page range to extract (e.g., "0" or "0-5").'
        }
      },
      required: ['filePath']
    }
  }
};

export async function analyzePdf({ filePath, mode = 'text', pages }: { filePath: string; mode?: 'text' | 'summary' | 'structured'; pages?: string }): Promise<string> {
  if (!fs.existsSync(filePath)) {
    return `[Error] PDF file not found at path: ${filePath}`;
  }

  const scriptPath = path.join(__dirname, '../../../../playbooks/productivity/ocr-and-documents/scripts/extract_pymupdf.py');
  if (!fs.existsSync(scriptPath)) {
    return `[Error] PDF extraction script not found at path: ${scriptPath}`;
  }

  const args = [scriptPath, filePath];
  
  if (mode === 'structured') {
    args.push('--markdown');
  }
  if (pages) {
    args.push('--pages', pages);
  }

  try {
    const { stdout, stderr } = await execFile('python3', args, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
    
    if (stderr && !stdout) {
        return `[Error] Failed to extract PDF: ${stderr}`;
    }

    let result = stdout;
    
    if (mode === 'summary') {
      const config = loadConfig();
      const model = config.llm?.model || 'gpt-4o-mini';
      
      const response = await executeWithRetry(async (client) => {
        return await client.chat({
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Summarize the following extracted text from a PDF document. Be concise and capture the main points.' },
            { role: 'user', content: result.substring(0, 100000) } // Truncate to avoid context window issues
          ],
          temperature: 0.2
        });
      });
      
      result = response.message.content || "[Error] No summary generated.";
    }

    // Attempt to get metadata
    try {
        const metaArgs = [scriptPath, filePath, '--metadata'];
        const { stdout: metaOut } = await execFile('python3', metaArgs);
        const metadata = JSON.parse(metaOut);
        
        return `[Metadata] Pages: ${metadata.pages}, Title: ${metadata.title}\n\n${result}`;
    } catch(e) {
        return result;
    }
    
  } catch (error: any) {
    return `[System Error] Failed to analyze PDF: ${error.message}`;
  }
}
