import { ToolDefinition } from '../../plugin/types';
import { generateFileToken, getPublicUrl } from '../../utils/fileLinker';
import fs from 'fs';
import path from 'path';

export const generateDownloadLinkToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_download_link',
    description: 'Generates a secure, temporary public download URL for any local file on the system. Provide this URL to the user when they want to download a file.',
    parameters: {
      type: 'object',
      properties: {
        absolutePath: {
          type: 'string',
          description: 'The absolute path to the file on the local system (e.g., /home/user/document.pdf)'
        }
      },
      required: ['absolutePath']
    }
  }
};

export async function generateDownloadLink(absolutePath: string): Promise<string> {
  try {
    if (!fs.existsSync(absolutePath)) {
      return `[Error] File not found at path: ${absolutePath}`;
    }
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      return `[Error] Cannot generate download link for a directory. Please provide a file path.`;
    }
    
    // Generate a token valid for 15 minutes
    const token = generateFileToken(absolutePath, 15);
    const baseUrl = getPublicUrl();
    
    const downloadUrl = `${baseUrl}/api/download?token=${token}`;
    return `Success! Download Link (valid for 15 minutes):\n${downloadUrl}\n\nNote: Please provide this URL directly to the user in your response.`;
  } catch (err: any) {
    return `[Error] Failed to generate download link: ${err.message}`;
  }
}
