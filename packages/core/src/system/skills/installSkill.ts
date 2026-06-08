import fs from 'fs';
import path from 'path';
import { getPath, getAppDir } from '../../config/paths';

export async function installExternalSkill(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return `Failed to fetch skill from URL. Status: ${response.status}`;
    }
    
    const code = await response.text();
    
    // Extract a filename from URL, or generate a random one
    let filename = url.split('/').pop() || '';
    if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
      filename = `skill_${Date.now()}.ts`;
    }
    
    // Ensure external_skills directory exists
    const pluginsDir = path.join(getAppDir(), 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    
    const filePath = path.join(pluginsDir, filename);
    fs.writeFileSync(filePath, code, 'utf8');
    
    return `Skill successfully downloaded and installed to ${filePath}. Please restart the server for the plugin manager to compile and load it.`;
  } catch (error: any) {
    return `Failed to install skill: ${error.message}`;
  }
}

export const installExternalSkillToolDefinition = {
  type: "function",
  function: {
    name: "install_external_skill",
    description: "Downloads and installs a third-party typescript skill from a URL (e.g. GitHub Gist raw URL).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The direct raw URL to the .ts or .js file of the skill.",
        }
      },
      required: ["url"],
    },
  },
};
