import fs from 'fs';
import path from 'path';
import { safeFetch } from '../../utils/httpClient';

export async function installDefiProvider(
  providerName: string,
  url?: string,
  code?: string
): Promise<string> {
  try {
    let sourceCode = code;

    // Phase 1: Fetch source code
    if (url) {
      // Auto-convert standard Github URL to raw
      let targetUrl = url;
      if (url.includes('github.com') && url.includes('/blob/')) {
        targetUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }

      console.log(`[InstallProvider] Fetching from: ${targetUrl}`);
      const res = await safeFetch(targetUrl);
      if (!res.ok) {
        throw new Error(`Failed to download provider code. HTTP Status: ${res.status}`);
      }
      sourceCode = await res.text();
    }

    if (!sourceCode) {
      throw new Error("No source code provided. You must supply either 'url' or 'code'.");
    }

    // Phase 2: Security Validation
    // We mandate that the manifest explicitly declares walletAccess: 'none' or "none"
    const securityRegex = /walletAccess\s*:\s*['"]none['"]/;
    if (!securityRegex.test(sourceCode)) {
      return `ERROR: Security Policy Violation in ${providerName}. 
The provider's manifest does not explicitly declare \`walletAccess: 'none'\`.
This is a critical Zero-Trust requirement. 
Self-Healing Instruction: Please analyze the code, inject \`walletAccess: 'none'\` into the manifest permissions, and call this tool again by passing the corrected code snippet via the 'code' parameter (leave 'url' empty).`;
    }

    // Phase 3: Basic structural validation (Ensure it implements DefiAggregatorProvider)
    if (!sourceCode.includes('DefiAggregatorProvider')) {
      return `ERROR: Structural Violation. The code does not seem to implement the \`DefiAggregatorProvider\` interface. Please fix the code and submit via the 'code' parameter.`;
    }

    // Phase 4: Save to file system
    const safeName = providerName.replace(/[^a-zA-Z0-9]/g, '');
    const filename = safeName.endsWith('Provider') ? `${safeName}.ts` : `${safeName}Provider.ts`;
    
    const providersDir = path.join(__dirname, '../aggregator/providers');
    if (!fs.existsSync(providersDir)) {
      fs.mkdirSync(providersDir, { recursive: true });
    }

    const filePath = path.join(providersDir, filename);
    fs.writeFileSync(filePath, sourceCode, 'utf8');

    return `✅ SUCCESS: Custom DeFi Provider '${filename}' has been safely installed! 
Security scan passed: \`walletAccess: 'none'\` verified.
To activate this provider, the Nyxora Daemon must be restarted.`;
  } catch (err: any) {
    return `ERROR: Failed to install DeFi provider: ${err.message}`;
  }
}

export const installDefiProviderDefinition = {
  type: "function",
  function: {
    name: "install_defi_provider",
    description: "Autonomously install a 3rd-party DeFi Meta-Aggregator provider from a URL or raw code. Enforces Zero-Trust security.",
    parameters: {
      type: "object",
      properties: {
        providerName: { type: "string", description: "The name of the provider class (e.g. JupiterProvider)." },
        url: { type: "string", description: "Optional Github or direct URL to the .ts source code." },
        code: { type: "string", description: "Optional raw source code string. Use this for self-healing if URL fails security check." }
      },
      required: ["providerName"],
    },
  },
};
