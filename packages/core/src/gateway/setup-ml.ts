import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import pc from 'picocolors';
import { spinner, note, outro, confirm, isCancel } from '@clack/prompts';
import { loadConfig, saveConfig } from '../config/parser';

const appDir = path.join(os.homedir(), '.nyxora');
const mlEngineDir = path.join(appDir, 'ml-engine');
const venvDir = path.join(mlEngineDir, 'venv');
let sourceReqPath = path.join(__dirname, '..', '..', '..', '..', 'packages', 'ml-engine', 'requirements.txt');
if (!fs.existsSync(sourceReqPath)) sourceReqPath = path.join(__dirname, '..', '..', '..', 'packages', 'ml-engine', 'requirements.txt');

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

    const config = loadConfig();
    let pythonCmd = config.agent.python_path || (process.platform === 'win32' ? 'python' : 'python3');

    try {
      execSync(`${pythonCmd} -c "import sys; assert sys.version_info >= (3, 10)"`, { stdio: 'ignore' });
    } catch (e) {
      const shouldInstall = await confirm({
        message: 'Python 3.10+ is not found or not in PATH. Would you like Nyxora to automatically download a sandboxed, portable Python runtime? (It won\'t affect your OS)',
        initialValue: true
      });
      if (!shouldInstall || isCancel(shouldInstall)) {
        console.error(pc.red('ML Engine requires Python 3.10+. Exiting...'));
        return;
      }
      
      console.log(pc.cyan('Downloading Portable Python (this may take a few minutes)...'));
      const pyDir = path.join(appDir, 'python-runtime');
      
      let downloadUrl = '';
      if (process.platform === 'linux' && process.arch === 'x64') downloadUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-unknown-linux-gnu-install_only.tar.gz';
      else if (process.platform === 'linux' && process.arch === 'arm64') downloadUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-aarch64-unknown-linux-gnu-install_only.tar.gz';
      else if (process.platform === 'darwin' && process.arch === 'x64') downloadUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-apple-darwin-install_only.tar.gz';
      else if (process.platform === 'darwin' && process.arch === 'arm64') downloadUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-aarch64-apple-darwin-install_only.tar.gz';
      else if (process.platform === 'win32') downloadUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.10.13+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz';
      else {
        console.error(pc.red('Unsupported platform for portable python. Please install Python 3.10+ manually.'));
        return;
      }
      
      const tarPath = path.join(appDir, 'python_portable.tar.gz');
      await new Promise<void>((resolve, reject) => {
        const getFn = (url: string) => {
          https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302 && res.headers.location) {
              getFn(res.headers.location);
            } else {
              const file = fs.createWriteStream(tarPath);
              res.pipe(file);
              file.on('finish', () => { file.close(); resolve(); });
            }
          }).on('error', reject);
        };
        getFn(downloadUrl);
      });
      
      console.log(pc.cyan('Extracting Portable Python...'));
      if (!fs.existsSync(pyDir)) fs.mkdirSync(pyDir, { recursive: true });
      execSync(`tar -xzf "${tarPath}" -C "${pyDir}"`);
      fs.unlinkSync(tarPath);
      
      pythonCmd = path.join(pyDir, 'python', 'bin', 'python3');
      if (process.platform === 'win32') pythonCmd = path.join(pyDir, 'python', 'python.exe');
      
      config.agent.python_path = pythonCmd;
      saveConfig(config);
      console.log(pc.green('Portable Python installed successfully.'));
    }

    s.start('Creating Python Virtual Environment (venv)...');
    if (!fs.existsSync(venvDir)) {
      await runCommand(pythonCmd, ['-m', 'venv', venvDir], mlEngineDir);
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
