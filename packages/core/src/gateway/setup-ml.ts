import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pc from 'picocolors';
import { spinner, note, outro } from '@clack/prompts';

const appDir = path.join(os.homedir(), '.nyxora');
const mlEngineDir = path.join(appDir, 'ml-engine');
const venvDir = path.join(mlEngineDir, 'venv');
const sourceReqPath = path.join(process.cwd(), 'packages', 'ml-engine', 'requirements.txt');

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} ${args.join(' ')} failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

export async function setupMlEngine() {
  console.log(pc.cyan('\n⚙️  Initializing Universal Python ML Engine...\n'));
  const s = spinner();
  
  try {
    if (!fs.existsSync(mlEngineDir)) {
      fs.mkdirSync(mlEngineDir, { recursive: true });
    }

    s.start('Creating Python Virtual Environment (venv)...');
    if (!fs.existsSync(venvDir)) {
      await runCommand('python3', ['-m', 'venv', venvDir], mlEngineDir);
    }
    s.stop(pc.green('Virtual Environment created successfully.'));

    s.start('Installing heavy Data Science & AI dependencies (this may take a while)...');
    const pipPath = path.join(venvDir, 'bin', 'pip');
    
    // Upgrade pip
    await runCommand(pipPath, ['install', '--upgrade', 'pip'], mlEngineDir);
    
    // Install requirements
    if (fs.existsSync(sourceReqPath)) {
      await runCommand(pipPath, ['install', '-r', sourceReqPath], mlEngineDir);
      s.stop(pc.green('Dependencies installed successfully.'));
    } else {
      s.stop(pc.yellow('requirements.txt not found. Skipping dependency installation.'));
    }

    note(
      'The Python Sidecar is ready.\nIt will automatically start in the background when you run `nyxora start`.',
      'ML Engine Configured'
    );
    
  } catch (error: any) {
    s.stop(pc.red('Failed to setup ML Engine.'));
    console.error(pc.red(`Error: ${error.message}`));
    console.log(pc.yellow('\nPlease ensure python3 and python3-venv are installed on your system.'));
  }
}

// Allow running directly
if (require.main === module) {
  setupMlEngine().then(() => process.exit(0));
}
