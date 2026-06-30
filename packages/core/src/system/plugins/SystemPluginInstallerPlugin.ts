import { Plugin } from '../../plugin/types';
import fs from 'fs';
import path from 'path';
import { safeFetch } from '../../utils/httpClient';

const installPluginDefinition = {
  type: 'function',
  function: {
    name: 'install_plugin',
    description: 'Installs or auto-heals a new Nyxora plugin from a URL or raw code. Requires explicit user approval.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Raw URL of the .ts plugin file to fetch.' },
        code: { type: 'string', description: 'Raw TypeScript code of the plugin. Use this instead of URL if you are auto-healing or editing the code.' },
        userConfirmation: { type: 'boolean', description: 'MUST BE FALSE initially. Set to true ONLY if the user has explicitly approved the installation in the chat.' }
      }
    }
  }
};

export class SystemPluginInstallerPlugin implements Plugin {
  public name = 'SystemPluginInstallerPlugin';
  public description = 'Autonomous package manager for installing and auto-healing dynamic plugins.';
  public version = '1.0.1';

  public tools = [installPluginDefinition];

  public handlers = {
    ['install_plugin']: async (args: { url?: string, code?: string, userConfirmation?: boolean }) => {
      try {
        let pluginCode = args.code;

        // 1. Fetch if URL is provided and no code is provided
        if (args.url && !pluginCode) {
          const response = await safeFetch(args.url);
          if (!response.ok) {
            return `Error fetching plugin from URL: HTTP ${response.status} ${response.statusText}`;
          }
          pluginCode = await response.text();
        }

        if (!pluginCode) {
          return "Error: You must provide either 'url' or 'code'.";
        }

        // 2. Verification & Auto-Healing Checks
        // We use basic string matching for verification before saving
        const missingFeatures = [];
        if (!pluginCode.includes('implements Plugin')) missingFeatures.push('implements Plugin interface');
        if (!pluginCode.includes('public name') && !pluginCode.includes('name =')) missingFeatures.push('public name property');
        if (!pluginCode.includes('public tools') && !pluginCode.includes('tools =')) missingFeatures.push('public tools array');
        if (!pluginCode.includes('public handlers') && !pluginCode.includes('handlers =')) missingFeatures.push('public handlers mapping');

        if (missingFeatures.length > 0) {
          return `VERIFICATION FAILED! The provided code is missing required plugin properties: ${missingFeatures.join(', ')}.\n\nAUTO-HEALING REQUIRED: Please use your coding skills to fix the code, ensure it implements the Plugin interface correctly, and call this tool again by passing the fixed code in the 'code' parameter instead of the 'url'.`;
        }

        // Extract class name to determine Web3 vs System isolation
        const classMatch = pluginCode.match(/class\s+([A-Za-z0-9_]+)\s+implements\s+Plugin/);
        if (!classMatch) {
           return "VERIFICATION FAILED! Could not find a class implementing 'Plugin' in the code. Please auto-heal and fix the code.";
        }
        
        const className = classMatch[1];
        const isWeb3 = className.startsWith('Web3');
        const targetDir = isWeb3 ? path.join(__dirname, '../../web3/plugins') : path.join(__dirname, '../../system/plugins');
        const targetPath = path.join(targetDir, `${className}.ts`);

        // 3. Human Approval Gate
        if (!args.userConfirmation) {
          return `Plugin code verified successfully. Target isolation zone: ${isWeb3 ? 'Web3' : 'OS/System'}.\n\nSECURITY GATE: You MUST ask the user for explicit permission to install this plugin. Do NOT proceed until the user says "YES". Once approved, call this tool again with userConfirmation=true and the identical 'url' or 'code'.`;
        }

        // 4. Save to Disk
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(targetPath, pluginCode, 'utf-8');

        return `SUCCESS! Plugin ${className} has been securely installed to ${targetPath}. The system requires a quick restart (e.g., 'npm run dev' or 'npm run build && npm start') for the Auto-Discovery engine to load it into memory.`;

      } catch (err: any) {
        return `Fatal Error during plugin installation: ${err.message}`;
      }
    }
  };
}
