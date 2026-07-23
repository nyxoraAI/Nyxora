#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const appDir = path.join(os.homedir(), '.nyxora');
const pidFile = path.join(appDir, 'run', 'daemon.pid');
const logFile = path.join(appDir, 'run', 'gateway.log');
const tokenFile = path.join(appDir, 'auth', 'auth.token');

[path.join(appDir, 'run'), path.join(appDir, 'auth')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const command = process.argv[2];

function isDaemonRunning(pidStr) {
  if (!pidStr) return false;
  try {
    process.kill(parseInt(pidStr, 10), 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function getDaemonPid() {
  if (fs.existsSync(pidFile)) {
    const pidStr = fs.readFileSync(pidFile, 'utf8').trim();
    if (isDaemonRunning(pidStr)) {
      return parseInt(pidStr, 10);
    } else {
      fs.unlinkSync(pidFile);
    }
  }
  return null;
}

async function start() {
  const pid = await getDaemonPid();
  if (pid) {
    console.log(`Nyxora is already running (PID: ${pid}). Use 'nyxora restart' to restart.`);
    return;
  }

  console.log('Starting Nyxora daemon...');
  
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');
  
  // Clean up any stale sockets first
  const socketPath = '/tmp/nyxora-signer.sock';
  if (fs.existsSync(socketPath)) {
    try {
        fs.unlinkSync(socketPath);
    } catch(e) {}
  }

  const compiledLauncher = path.join(projectRoot, 'dist', 'launcher.js');
  const useCompiled = fs.existsSync(compiledLauncher);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledLauncher] : ['ts-node', '-T', 'launcher.ts'];

  if (useCompiled) console.log('⚡ Using pre-compiled JS for blazing fast startup...');

  const child = spawn(cmd, args, {
    cwd: projectRoot,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });

  child.unref();
  
  if (child.pid) {
    fs.writeFileSync(pidFile, child.pid.toString());
    console.log(`Nyxora daemon started (PID: ${child.pid}).`);
    console.log(`Logs are available at: ${logFile}`);
  }
}

async function stop(preserveTracker = false) {
  const pid = await getDaemonPid();
  if (pid) {
    console.log(`Stopping Nyxora daemon (PID: ${pid})...`);
    try {
      process.kill(-pid, 'SIGTERM');
      let attempts = 0;
      while (isDaemonRunning(pid.toString()) && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      console.log('Nyxora stopped gracefully.');
    } catch (e) {
      console.error('Failed to kill Nyxora process:', e.message);
    }

    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      if (!preserveTracker) {
        const trackerFile = path.join(appDir, 'run', 'tracker.json');
        if (fs.existsSync(trackerFile)) fs.unlinkSync(trackerFile);
      }
    } catch(e) {}
  } else {
    console.log('Nyxora is not running.');
  }
}

async function restart() {
  await stop(true);
  setTimeout(start, 1000);
}

async function dashboard() {
  const pid = await getDaemonPid();
  if (!pid) {
    console.log("Nyxora is not running. Start it first with 'nyxora start'.");
    return;
  }

  if (fs.existsSync(tokenFile)) {
    let token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (token.startsWith('{')) {
      try {
        const parsed = JSON.parse(token);
        token = parsed.token;
      } catch (e) {}
    }
    const url = `http://localhost:3000?token=${token}`;
    console.log(`Opening Dashboard at ${url}`);
    try {
        const { default: open } = await import('open');
        await open(url);
    } catch(e) {
        console.error("Failed to open browser. Please manually open:", url);
    }
  } else {
    console.log("Dashboard token not found. The daemon might still be starting.");
  }
}

async function cleanLogs() {
  if (fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
    console.log('Logs have been cleared.');
  } else {
    console.log('No logs found to clear.');
  }
}

async function autostart(action) {
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  
  if (isLinux) {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart');
    const desktopFile = path.join(autostartDir, 'nyxora.desktop');
    
    if (action === 'enable') {
      if (!fs.existsSync(autostartDir)) fs.mkdirSync(autostartDir, { recursive: true });
      const binPath = path.resolve(projectRoot, 'bin', 'nyxora.mjs');
      const desktopContent = `[Desktop Entry]
Type=Application
Exec=node ${binPath} start
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Name=Nyxora Daemon
Comment=Start Nyxora in the background
`;
      fs.writeFileSync(desktopFile, desktopContent);
      console.log('Autostart enabled for Linux (XDG Autostart).');
    } else if (action === 'disable') {
      if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile);
      console.log('Autostart disabled.');
    } else {
      console.log("Usage: nyxora autostart [enable|disable]");
    }
  } else if (isMac) {
    const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistFile = path.join(plistDir, 'com.nyxora.gateway.plist');
    if (action === 'enable') {
      if (!fs.existsSync(plistDir)) fs.mkdirSync(plistDir, { recursive: true });
      const binPath = path.resolve(projectRoot, 'bin', 'nyxora.mjs');
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nyxora.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${binPath}</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`;
      fs.writeFileSync(plistFile, plistContent);
      console.log('Autostart enabled for macOS (LaunchAgent).');
    } else if (action === 'disable') {
      if (fs.existsSync(plistFile)) fs.unlinkSync(plistFile);
      console.log('Autostart disabled.');
    }
  } else if (isWin) {
    console.log("For Windows, please use Task Scheduler or add a shortcut to the Startup folder.");
  } else {
    console.log("Unsupported OS for autostart script.");
  }
}

async function setup() {
  console.log("Running Nyxora Setup Wizard...");
  const compiledSetup = path.join(projectRoot, 'dist', 'packages/core/src/gateway/setup-cli.js');
  const useCompiled = fs.existsSync(compiledSetup);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledSetup] : ['ts-node', '-T', 'packages/core/src/gateway/setup-cli.ts'];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function clearMemory(cliArgs) {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/cli.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli, 'clear', ...cliArgs] : ['ts-node', '-T', 'packages/core/src/gateway/cli.ts', 'clear', ...cliArgs];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function setKey(cliArgs) {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/cli.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli, 'set-key', ...cliArgs] : ['ts-node', '-T', 'packages/core/src/gateway/cli.ts', 'set-key', ...cliArgs];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function wallet(cliArgs) {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/cli.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli, 'wallet', ...cliArgs] : ['ts-node', '-T', 'packages/core/src/gateway/cli.ts', 'wallet', ...cliArgs];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function uninstall(cliArgs) {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/cli.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli, 'uninstall', ...cliArgs] : ['ts-node', '-T', 'packages/core/src/gateway/cli.ts', 'uninstall', ...cliArgs];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function chat(cliArgs) {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/cli.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli, 'chat', ...cliArgs] : ['ts-node', '-T', 'packages/core/src/gateway/cli.ts', 'chat', ...cliArgs];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function runDoctor() {
  const compiledCli = path.join(projectRoot, 'dist', 'packages/core/src/gateway/doctor.js');
  const useCompiled = fs.existsSync(compiledCli);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledCli] : ['ts-node', '-T', 'packages/core/src/gateway/doctor.ts'];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}

async function unlock() {
  if (fs.existsSync(tokenFile)) {
    let token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (token.startsWith('{')) {
      try {
        const parsed = JSON.parse(token);
        token = parsed.token;
      } catch (e) {}
    }
    try {
      const res = await fetch('http://localhost:3000/api/status/unlock', {
        method: 'POST',
        headers: {
          'x-nyxora-token': token
        }
      });
      if (res.ok) {
        console.log('✅ Dashboard unlocked successfully.');
      } else {
        console.log('❌ Failed to unlock dashboard. Is the daemon running?');
      }
    } catch (e) {
      console.log('❌ Failed to communicate with the daemon. Is it running?');
    }
  } else {
    console.log('❌ Authentication token not found.');
  }
}

async function serveMcp() {
  const compiledMcp = path.join(projectRoot, 'packages/mcp-server/dist/server.js');
  const useCompiled = fs.existsSync(compiledMcp);
  const cmd = useCompiled ? 'node' : 'npx';
  const args = useCompiled ? [compiledMcp] : ['ts-node', '-T', 'packages/mcp-server/src/server.ts'];
  const child = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_CACHE: 'false' }
  });
  
  await new Promise(resolve => child.on('close', resolve));
}



async function main() {
  switch(command) {
    case 'doctor': await runDoctor(); break;
    case 'setup': await setup(); break;
    case 'clear': await clearMemory(process.argv.slice(3)); break;
    case 'set-key': await setKey(process.argv.slice(3)); break;
    case 'wallet': await wallet(process.argv.slice(3)); break;
    case 'chat': await chat(process.argv.slice(3)); break;
    case 'uninstall': await uninstall(process.argv.slice(3)); break;
    case 'start': await start(); break;
    case 'stop': await stop(); break;
    case 'restart': await restart(); break;
    case 'dashboard': await dashboard(); break;
    case 'unlock': await unlock(); break;
    case 'clean-logs': await cleanLogs(); break;
    case 'autostart': await autostart(process.argv[3]); break;
    case 'mcp': await serveMcp(); break;

    case 'desktop': {
      const desktopPkg = path.join(projectRoot, 'packages/desktop/package.json');
      const desktopDist = path.join(projectRoot, 'packages/desktop/dist-electron');
      if (!fs.existsSync(desktopPkg) || !fs.existsSync(desktopDist)) {
        console.error('❌ Desktop app is not available in the npm package.');
        console.error('   The Desktop app must be built from source.');
        console.error('   Clone the repo and run: git clone https://github.com/nyxoraAI/Nyxora && cd Nyxora && npm install && npm run desktop');
        process.exit(1);
      }
      const { default: open } = await import('open');
      await open(desktopDist);
      break;
    }

    case 'tui': {
      // Spawn pre-compiled TUI directly using Node.
      // We must avoid wrappers like `npx` or `npm run` which spawn subshells 
      // and break TTY inheritance, causing Ink to think it's not a TTY (which makes it invisible).
      const tuiDist = path.join(projectRoot, 'packages/tui/dist/index.js');
      if (!fs.existsSync(tuiDist)) {
        console.error('❌ TUI is not available (missing compiled output).');
        console.error('   If you installed from npm, try: npm install -g nyxora@latest');
        console.error('   If running from source: npm run build');
        process.exit(1);
      }
      
      const childTui = spawn('node', [tuiDist], {
        cwd: path.join(projectRoot, 'packages/tui'),
        stdio: 'inherit',
        env: { ...process.env }
      });
      await new Promise(resolve => childTui.on('close', resolve));
      break;
    }
    case '-v':
    case '--v':
    case '--version':
    case 'version':
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      console.log(`Nyxora v${pkg.version}`);
      break;
    default:
      console.log(`
Nyxora CLI Manager - Your Personal Web3 Assistant
Usage: nyxora <command>

Commands:
  start          Start the Nyxora background daemon
  stop           Stop the running daemon
  restart        Restart the daemon
  mcp            Start the MCP Server directly (for testing/debug)
  chat           Chat interactively with the AI in terminal
  setup          Run the interactive Setup Wizard
  dashboard      Open the dashboard in your browser
  unlock         Unlock an inactive dashboard session
  doctor         Run system diagnostics and check requirements
  clear          Atomically clear the AI's short/long-term memory SQLite database
  clean-logs     Clear the daemon logs
  autostart      Enable/disable autostart on boot (usage: nyxora autostart enable)
  set-key        Securely save API Key (usage: nyxora set-key <provider> <key>)
  wallet         Manage your Web3 Wallet (usage: nyxora wallet update)
  uninstall      Wipe AI memory, securely delete keys, and remove configuration

Options:
  -v, --version  Show current version
  -h, --help     Show this help menu
`);
  }
}

main().catch(console.error);
