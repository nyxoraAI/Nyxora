import fs from 'fs';
import path from 'path';
import os from 'os';

let isGlobalModeCache: boolean | null = null;

export function getAppDir(): string {
  // Check if .env or config.yaml exists in current working directory
  if (isGlobalModeCache === null) {
    const localEnv = path.join(process.cwd(), '.env');
    const localConfig = path.join(process.cwd(), 'config.yaml');
    
    if (fs.existsSync(localEnv) || fs.existsSync(localConfig)) {
      isGlobalModeCache = false; // Local manual mode
    } else {
      isGlobalModeCache = true; // Global CLI mode
    }
  }

  if (isGlobalModeCache) {
    const globalDir = path.join(os.homedir(), '.nyxora');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    return globalDir;
  }

  return process.cwd();
}

export function getPath(filename: string): string {
  return path.join(getAppDir(), filename);
}
