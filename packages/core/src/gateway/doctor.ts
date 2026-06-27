import fs from 'fs';
import path from 'path';
import net from 'net';
import pc from 'picocolors';
import { getPath } from '../config/paths';
import { loadConfig } from '../config/parser';

export async function runDoctor() {
  console.log(pc.cyan('\n🔍 Nyxora System Doctor\n'));
  let allGood = true;

  const printStatus = (name: string, status: boolean, errorMsg?: string) => {
    if (status) {
      console.log(`${pc.green('✓')} ${name}`);
    } else {
      console.log(`${pc.red('✗')} ${name}`);
      if (errorMsg) console.log(`  ${pc.gray(errorMsg)}`);
      allGood = false;
    }
  };

  // 1. Check Node Version
  const nodeVer = process.versions.node;
  const majorVer = parseInt(nodeVer.split('.')[0], 10);
  printStatus(`Node.js Version (${nodeVer})`, majorVer >= 22, `Please upgrade to Node.js v22 or higher.`);

  // 2. Check App Directory & Config
  const configPath = getPath('config.yaml');
  let configOk = false;
  let configErr = '';
  if (fs.existsSync(configPath)) {
    try {
      loadConfig();
      configOk = true;
    } catch (e: any) {
      configErr = `Invalid YAML syntax: ${e.message}`;
    }
  } else {
    configErr = `config.yaml not found at ${configPath}`;
  }
  printStatus(`Configuration File`, configOk, configErr);

  // 3. Check SQLite DB access
  const dbPath = getPath('memory.db');
  let dbOk = false;
  let dbErr = '';
  try {
    if (fs.existsSync(dbPath)) {
      fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
      dbOk = true;
    } else {
      dbOk = true; // Not created yet, which is fine
    }
  } catch (e: any) {
    dbErr = `Cannot read/write memory.db: ${e.message}`;
  }
  printStatus(`SQLite Database Permissions`, dbOk, dbErr);

  // 4. Check OS Keyring
  let keyringOk = false;
  let keyringErr = '';
  try {
    const { getPassword } = require('@napi-rs/keyring');
    // Just try to access it. If it throws native error, keyring is inaccessible
    try {
      getPassword('nyxora', 'test_ping_doctor');
    } catch (e) {
      // It's normal to throw "The specified item could not be found in the keychain"
      // But if it crashes or throws permission error, it's bad.
    }
    keyringOk = true;
  } catch (e: any) {
    keyringErr = `OS Vault inaccessible: ${e.message}. Ensure libsecret is installed on Linux.`;
  }
  printStatus(`OS Native Vault (Keyring)`, keyringOk, keyringErr);

  // 5. Check Ports
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false)); // Port in use
      server.listen(port, () => {
        server.close(() => resolve(true)); // Port free
      });
    });
  };

  const port3000Free = await checkPort(3000);
  const port3001Free = await checkPort(3001);

  let isDaemonRunning = false;
  const pidPath = getPath('daemon.pid');
  if (fs.existsSync(pidPath)) {
    try {
      const pidStr = fs.readFileSync(pidPath, 'utf8').trim();
      process.kill(parseInt(pidStr, 10), 0);
      isDaemonRunning = true;
    } catch {}
  }

  if (isDaemonRunning && !port3000Free) {
    console.log(`${pc.green('✓')} Port 3000 (Core/Gateway API) ${pc.cyan('[In Use by Nyxora]')}`);
  } else {
    printStatus(`Port 3000 (Core/Gateway API)`, port3000Free, `Port is already in use by another application.`);
  }

  if (isDaemonRunning && !port3001Free) {
    console.log(`${pc.green('✓')} Port 3001 (Policy Engine Fallback) ${pc.cyan('[In Use by Nyxora]')}`);
  } else {
    printStatus(`Port 3001 (Policy Engine Fallback)`, port3001Free, `Port is already in use by another application.`);
  }

  // 6. Check Unix Sockets (UDS)
  const policySockPath = '/tmp/nyxora-policy.sock';
  const signerSockPath = '/tmp/nyxora-signer.sock';
  
  const checkSocket = (sockPath: string, name: string) => {
    let sockExists = false;
    try {
      sockExists = fs.existsSync(sockPath);
    } catch {}

    if (sockExists) {
      if (isDaemonRunning) {
        console.log(`${pc.green('✓')} ${name} UDS (${sockPath}) ${pc.cyan('[In Use by Nyxora]')}`);
      } else {
        printStatus(`${name} UDS (${sockPath})`, false, `Stale/Zombie socket found! Run 'rm -f ${sockPath}' to fix EADDRINUSE lockups.`);
      }
    } else {
      if (isDaemonRunning) {
         printStatus(`${name} UDS (${sockPath})`, false, `Missing active socket! Nyxora is running but IPC might be broken.`);
      } else {
         console.log(`${pc.green('✓')} ${name} UDS (${sockPath}) ${pc.gray('[Clean]')}`);
      }
    }
  };

  checkSocket(policySockPath, 'Policy Engine');
  checkSocket(signerSockPath, 'Signer Vault');

  console.log('\n================================');
  if (allGood) {
    console.log(pc.green('🚀 All systems are completely healthy! Nyxora is ready to fly.'));
  } else {
    console.log(pc.yellow('⚠️ Some checks failed. Please fix the issues above for optimal performance.'));
  }
  console.log('================================\n');
}

if (require.main === module) {
  runDoctor();
}
