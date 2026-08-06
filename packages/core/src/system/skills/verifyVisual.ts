import fs from 'fs';
import fetch from 'node-fetch';
import { ML_BASE_URL } from '../../config/constants';

export const verifyVisualToolDefinition = {
  type: 'function',
  function: {
    name: 'verify_visual_output',
    description: 'Verify if a screenshot matches an expected description.',
    parameters: {
      type: 'object',
      properties: {
        screenshotPath: {
          type: 'string',
          description: 'The absolute path to the screenshot image file.'
        },
        expectedDescription: {
          type: 'string',
          description: 'The description of what is expected to be seen in the screenshot.'
        },
        strict: {
          type: 'boolean',
          description: 'Whether to use strict mode for verification.'
        }
      },
      required: ['screenshotPath', 'expectedDescription']
    }
  }
};

export async function verifyVisual({ screenshotPath, expectedDescription, strict = false }: { screenshotPath: string; expectedDescription: string; strict?: boolean }): Promise<string> {
  if (!fs.existsSync(screenshotPath)) {
    return `[Error] Screenshot image file not found at path: ${screenshotPath}`;
  }

  try {
    const response = await fetch(`${ML_BASE_URL}/vision/verify-screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        screenshot_path: screenshotPath,
        expected_description: expectedDescription,
        strict: strict
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return `[Error] Failed to verify screenshot. Server responded with: ${response.status} - ${errText}`;
    }

    const result = await response.json() as any;
    
    // Format the structured result as a string
    let formattedResult = `Visual Verification: ${result.matches ? 'PASS' : 'FAIL'}\n`;
    formattedResult += `Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    
    if (result.issues && result.issues.length > 0) {
      formattedResult += `\nIssues Found:\n`;
      for (const issue of result.issues) {
        formattedResult += `- ${issue}\n`;
      }
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      formattedResult += `\nSuggestions:\n`;
      for (const suggestion of result.suggestions) {
        formattedResult += `- ${suggestion}\n`;
      }
    }

    return formattedResult;
  } catch (error: any) {
    return `[System Error] Exception while calling visual verification API: ${error.message}`;
  }
}
