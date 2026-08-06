import fs from 'fs';
import fetch from 'node-fetch';
import { ML_BASE_URL } from '../../config/constants';

export const analyzeChartToolDefinition = {
  type: 'function',
  function: {
    name: 'analyze_chart',
    description: 'Analyze a chart image to extract structured insights including title, axes, data points, trend, and key insight.',
    parameters: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'The absolute path to the chart image file.'
        },
        question: {
          type: 'string',
          description: 'Optional specific question about the chart.'
        }
      },
      required: ['imagePath']
    }
  }
};

export async function analyzeChart({ imagePath, question }: { imagePath: string; question?: string }): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    return `[Error] Chart image file not found at path: ${imagePath}`;
  }

  try {
    const response = await fetch(`${ML_BASE_URL}/vision/analyze-chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_path: imagePath,
        question: question || null
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return `[Error] Failed to analyze chart. Server responded with: ${response.status} - ${errText}`;
    }

    const result = await response.json() as any;
    
    // Format the structured result as a string
    let formattedResult = `Chart Analysis:\n`;
    if (result.title) formattedResult += `- Title: ${result.title}\n`;
    if (result.x_axis) formattedResult += `- X-Axis: ${result.x_axis}\n`;
    if (result.y_axis) formattedResult += `- Y-Axis: ${result.y_axis}\n`;
    if (result.trend) formattedResult += `- Trend: ${result.trend}\n`;
    if (result.key_insight) formattedResult += `- Key Insight: ${result.key_insight}\n`;
    if (result.data_points && result.data_points.length > 0) {
      formattedResult += `- Data Points:\n`;
      for (const dp of result.data_points) {
        formattedResult += `  * ${dp}\n`;
      }
    }
    if (result.raw_analysis) formattedResult += `\nRaw Analysis:\n${result.raw_analysis}\n`;

    return formattedResult;
  } catch (error: any) {
    return `[System Error] Exception while calling chart analysis API: ${error.message}`;
  }
}
