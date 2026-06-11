import { execSync } from 'child_process';
import { chromium } from 'playwright';

let isChromiumInstalled = false;

export async function browseWebsite(url: string): Promise<string> {
  try {
    // 1. SSRF Network Blocklist (Enterprise Grade)
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return `Error: Invalid URL format.`;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHostnames = [
      'localhost', '127.0.0.1', '::1',
      '169.254.169.254', 'host.docker.internal'
    ];

    if (blockedHostnames.includes(hostname) || hostname.endsWith('.local')) {
      return `Error: SSRF Protection. Access to internal/private hostname (${hostname}) is blocked.`;
    }

    // IP Range Blocking (10.x, 172.16.x-172.31.x, 192.168.x)
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipRegex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);
      if (
        octet1 === 10 || 
        (octet1 === 172 && octet2 >= 16 && octet2 <= 31) || 
        (octet1 === 192 && octet2 === 168)
      ) {
        return `Error: SSRF Protection. Access to private IP range (${hostname}) is blocked.`;
      }
    }

    // Lazy-Loading: Install chromium binary if it's the first time
    if (!isChromiumInstalled) {
      try {
        console.log('[System] Initializing Headless Browser for the first time...');
        execSync('npx playwright install chromium', { stdio: 'ignore' });
        isChromiumInstalled = true;
      } catch (e) {
        console.warn('Failed to auto-install playwright chromium, attempting to launch anyway...');
      }
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Wait until network is mostly idle to capture React/Vue rendering
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Extract text from the fully rendered DOM
    const textContent = await page.evaluate(() => {
      // Remove scripts and styles
      document.querySelectorAll('script, style').forEach(el => el.remove());
      return document.body.innerText;
    });
    
    await browser.close();

    let text = textContent.replace(/\s+/g, ' ').trim();
    
    // Limit to 20000 characters to prevent context overflow
    if (text.length > 20000) {
      text = text.substring(0, 20000) + "... [Content Truncated]";
    }
    
    return text;
  } catch (error: any) {
    return `Failed to browse website: ${error.message}`;
  }
}

export const browseWebsiteToolDefinition = {
  type: "function",
  function: {
    name: "browse_website",
    description: "Fetches and reads the textual content of a webpage. Uses a headless browser to render JavaScript Web3 dApps.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to read.",
        }
      },
      required: ["url"],
    },
  },
};
