import fs from 'fs';
import path from 'path';
import pdfParse = require('pdf-parse');
// @ts-ignore
import mammoth from 'mammoth';

export async function analyzeDocument(filePath: string): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found at ${absolutePath}`;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(absolutePath);
      // @ts-ignore
    const data = await pdfParse(dataBuffer);
      let text = data.text.trim();
      if (text.length > 20000) {
        text = text.substring(0, 20000) + "... [Content Truncated]";
      }
      return text;
    } 
    
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: absolutePath });
      let text = result.value.trim();
      if (text.length > 20000) {
        text = text.substring(0, 20000) + "... [Content Truncated]";
      }
      return text;
    }

    // Fallback for TXT, MD, CSV, etc.
    let content = fs.readFileSync(absolutePath, 'utf8');
    if (content.length > 20000) {
      content = content.substring(0, 20000) + "... [Content Truncated]";
    }
    return content;

  } catch (error: any) {
    return `Failed to analyze document: ${error.message}`;
  }
}

export const analyzeDocumentToolDefinition = {
  type: "function",
  function: {
    name: "analyze_document",
    description: "Extracts textual content from documents (PDF, DOCX) and plain text files (TXT, MD, CSV). Useful for reading reports, contracts, and data dumps.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path to the document file.",
        }
      },
      required: ["filePath"],
    },
  },
};
