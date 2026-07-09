const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fsPromises = require('fs').promises;

// Disable hardware acceleration to prevent fullscreen crashes on Linux (MESA/Vulkan issues)
app.disableHardwareAcceleration();

let mainWindow;

// Paths
const projectRoot = path.join(__dirname, '..', '..', '..'); // depending on build output, this might vary. Wait, __dirname is packages/desktop/src. So projectRoot is ../../.. from src. No, __dirname is `packages/desktop/src`. `..` is `packages/desktop`. `..` is `packages`. `..` is `Nyxora`. So it's `../../..`.
const binPath = path.join(projectRoot, 'bin', 'nyxora.mjs');
const tokenFile = path.join(os.homedir(), '.nyxora', 'auth', 'auth.token');

async function getToken() {
  try {
    let token = await fsPromises.readFile(tokenFile, 'utf8');
    token = token.trim();
    if (token.startsWith('{')) {
      try {
        const parsed = JSON.parse(token);
        token = parsed.token;
      } catch (e) {}
    }
    return token;
  } catch (err) {
    console.error('Failed to read token file:', err.message);
    return null;
  }
}

function startDaemon() {
  return new Promise((resolve, reject) => {
    console.log('Starting Nyxora daemon...');
    
    // Check if the CLI exists
    fsPromises.access(binPath).then(() => {
      const child = spawn('node', [binPath, 'start'], {
        cwd: projectRoot,
        stdio: 'pipe'
      });

      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // The cli prints "Nyxora daemon started" or "Nyxora is already running"
        if (stdout.includes('started') || stdout.includes('already running')) {
          resolve();
        }
      });
      
      child.stderr.on('data', (data) => {
        console.error(`Daemon error: ${data}`);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`Daemon process exited with code ${code}`);
        }
        resolve(); // resolve anyway so we don't block forever if it detaches silently
      });
      
      // Fallback timeout in case we don't catch the exact string
      setTimeout(() => {
        resolve();
      }, 3000);
    }).catch((err) => {
      console.error(`CLI not found at ${binPath}. Falling back to global nyxora command:`, err.message);
      // Try using the global 'nyxora' command
      const child = spawn('nyxora', ['start'], { shell: true, stdio: 'pipe' });
      
      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.includes('started') || stdout.includes('already running')) {
          resolve();
        }
      });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
      
      setTimeout(() => resolve(), 3000);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Get token and load URL
  let token = await getToken();
  let retries = 0;
  
  // Wait for token to be generated if it's the first run
  while (!token && retries < 10) {
    await new Promise(r => setTimeout(r, 1000));
    token = await getToken();
    retries++;
  }

  const targetUrl = token ? `http://localhost:3000?token=${token}` : 'http://localhost:3000';
  
  // Wait for the backend server to be ready before loading the URL to prevent ERR_CONNECTION_REFUSED
  let serverReady = false;
  let pollRetries = 0;
  while (!serverReady && pollRetries < 20) {
    try {
      const { net } = require('electron');
      const request = net.request('http://localhost:3000');
      
      const readyPromise = new Promise(resolve => {
        request.on('response', (response) => {
          if (response.statusCode === 200 || response.statusCode === 401) resolve(true);
          else resolve(false);
        });
        request.on('error', () => resolve(false));
      });
      
      request.end();
      serverReady = await readyPromise;
    } catch (e) {
      serverReady = false;
    }
    if (!serverReady) {
      await new Promise(r => setTimeout(r, 1000));
      pollRetries++;
    }
  }

  try {
    if (!serverReady) {
      console.error('Backend server failed to respond after 20 seconds. Loading error.html.');
      await mainWindow.loadFile(path.join(__dirname, 'error.html'));
    } else {
      await mainWindow.loadURL(targetUrl);
    }
  } catch (err) {
    console.error('Failed to load URL, dashboard might not be ready:', err.message);
    await mainWindow.loadFile(path.join(__dirname, 'error.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startDaemon();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  console.log('Stopping Nyxora daemon...');
  spawn('nyxora', ['stop'], { shell: true });
});
