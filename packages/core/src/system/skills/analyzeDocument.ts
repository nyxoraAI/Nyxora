import fs from 'fs';
import path from 'path';
import pdfParse = require('pdf-parse');
// @ts-ignore
import mammoth from 'mammoth';

export async function analyzeDocument(filePath: string): Promise<string> {
  try {
    let absolutePath = path.resolve(filePath);
    
    if (fs.existsSync(absolutePath)) {
      // Path Canonicalization to defeat symlink/traversal bypasses
      absolutePath = fs.realpathSync(absolutePath);
    }

    // 1. Smart Directory Blacklist (Case-insensitive matching for full paths)
    const blockedDirectories = [
      /(?:\/.+)?\/\.ssh(?:\/.*)?/i,
      /(?:\/.+)?\/\.gnupg(?:\/.*)?/i,
      /(?:\/.+)?\/\.aws(?:\/.*)?/i,
      /(?:\/.+)?\/\.config\/solana(?:\/.*)?/i,
      /(?:\/.+)?\/\.ethereum(?:\/.*)?/i,
      /(?:\/.+)?\/\.foundry(?:\/.*)?/i,
      /(?:\/.+)?\/\.wallets(?:\/.*)?/i,
      /(?:\/.+)?\/\.nyxora\/(?:auth|config|run)(?:\/.*)?/i,
      /vault\.key/i,
      /passwd/i
    ];

    for (const pattern of blockedDirectories) {
      if (pattern.test(absolutePath)) {
         return `Error: Permission Denied. Access to ${absolutePath} is strictly blocked by the system security policy.`;
      }
    }

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

    if (ext === '.xlsx' || ext === '.csv') {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      if (ext === '.csv') {
        await workbook.csv.readFile(absolutePath);
      } else {
        await workbook.xlsx.readFile(absolutePath);
      }
      
      let text = `--- Spreadsheet Data from ${path.basename(absolutePath)} ---\n`;
      
      workbook.eachSheet((worksheet) => {
        text += `\n[Sheet: ${worksheet.name}]\n`;
        worksheet.eachRow((row) => {
          const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
          text += values.join(',') + '\n';
        });
      });
      
      if (text.length > 20000) {
        text = text.substring(0, 20000) + "... [Content Truncated]";
      }
      return text;
    }

    // Fallback for TXT, MD, etc.
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
