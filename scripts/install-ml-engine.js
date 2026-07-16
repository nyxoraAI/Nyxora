import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Nyxora Setup] Setting up ML Engine Python Environment...');

const nyxoraDir = path.join(os.homedir(), '.nyxora');
const mlEngineDir = path.join(nyxoraDir, 'ml-engine');
const venvDir = path.join(mlEngineDir, 'venv');

if (!fs.existsSync(mlEngineDir)) {
  fs.mkdirSync(mlEngineDir, { recursive: true });
}

const IS_WINDOWS = process.platform === 'win32';
const pythonCmd = IS_WINDOWS ? 'python' : 'python3';

try {
  // Check if Python is installed
  const pyCheck = spawnSync(pythonCmd, ['--version'], { encoding: 'utf8' });
  if (pyCheck.error || (pyCheck.status !== 0 && !pyCheck.stdout && !pyCheck.stderr)) {
    console.warn(`[Nyxora Setup] Warning: ${pythonCmd} not found in PATH. Skipping ML Engine setup. Run 'nyxora setup' later.`);
    process.exit(0);
  }

  // Create venv if it doesn't exist
  if (!fs.existsSync(venvDir)) {
    console.log(`[Nyxora Setup] Creating virtual environment at ${venvDir}...`);
    const venvResult = spawnSync(pythonCmd, ['-m', 'venv', venvDir], { stdio: 'inherit' });
    if (venvResult.status !== 0) {
      console.warn(`[Nyxora Setup] Failed to create venv. ML Engine features will be disabled.`);
      process.exit(0);
    }
  }

  // Find pip inside venv
  const pipPath = IS_WINDOWS 
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip');

  if (!fs.existsSync(pipPath)) {
    console.warn(`[Nyxora Setup] Warning: PIP not found in venv at ${pipPath}.`);
    process.exit(0);
  }

  // Path to requirements.txt (it could be in the project root or installed globally)
  let reqPath = path.join(__dirname, '..', 'packages', 'ml-engine', 'requirements.txt');
  if (!fs.existsSync(reqPath)) {
     // fallback if script is moved
     reqPath = path.join(process.cwd(), 'packages', 'ml-engine', 'requirements.txt');
  }

  if (fs.existsSync(reqPath)) {
    console.log(`[Nyxora Setup] Installing Python dependencies from ${reqPath}...`);
    const pipResult = spawnSync(pipPath, ['install', '-r', reqPath], { stdio: 'inherit' });
    if (pipResult.status === 0) {
      console.log(`[Nyxora Setup] ML Engine dependencies installed successfully!`);
    } else {
      console.warn(`[Nyxora Setup] ML Engine dependency installation failed with code ${pipResult.status}.`);
    }
  } else {
    console.warn(`[Nyxora Setup] requirements.txt not found at ${reqPath}.`);
  }

} catch (err) {
  console.warn(`[Nyxora Setup] ML Engine setup encountered an error:`, err);
}
