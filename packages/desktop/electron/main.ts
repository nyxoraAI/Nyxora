import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

app.name = 'Nyxora';
app.setAppUserModelId('Nyxora');
if (process.platform === 'linux') {
  app.setDesktopName('Nyxora.desktop');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');


process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'build');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;
let daemonProcess: ChildProcess | null = null;

function startNyxoraDaemon() {
  const monorepoRoot = path.join(process.env.APP_ROOT, '../..');
  
  daemonProcess = spawn('node', ['./bin/nyxora.mjs', 'start'], {
    cwd: monorepoRoot,
    stdio: 'ignore', // 'ignore' is required for detached processes to survive without parent console
    detached: true,
    env: { ...process.env, PORT: process.env.PORT || '40000' }
  });

  // unref allows the parent to exit independently of the child
  daemonProcess.unref();

  daemonProcess.on('error', (err) => {
    console.error('[Nyxora Daemon Error]:', err);
  });
}

function createWindow() {
  const isLinux = process.platform === 'linux';
  const isMac   = process.platform === 'darwin';

  win = new BrowserWindow({
    title: 'Nyxora',
    icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'nyxora-icon.png')),
    width: 1200,
    height: 800,
    // macOS: use hidden title bar with native traffic lights
    // Linux/Windows: frameless window with custom HTML window controls
    titleBarStyle: isMac ? 'hidden' : 'hidden',
    frame: false, // frameless on all platforms; macOS traffic lights via titleBarStyle:hidden
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return true;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    callback(true);
  });

  // Open target="_blank" links in external browser
  win.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      shell.openExternal(details.url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent navigation in the app window for normal links, open them externally
  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return;
    if (url.startsWith('file://')) return;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  let token = '';
  try {
    const tokenPath = path.join(os.homedir(), '.nyxora', 'auth', 'auth.token');
    if (fs.existsSync(tokenPath)) {
      token = fs.readFileSync(tokenPath, 'utf8').trim();
      if (token.startsWith('{')) {
        try { token = JSON.parse(token).token; } catch(e){}
      }
    }
  } catch(e) {}

  if (VITE_DEV_SERVER_URL) {
    const devUrl = new URL(VITE_DEV_SERVER_URL);
    if (token) devUrl.searchParams.set('token', token);
    win.loadURL(devUrl.toString());
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'), token ? { query: { token } } : {});
  }
}

ipcMain.on('window-minimize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || win;
  if (w) w.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || win;
  if (w) {
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || win;
  if (w) w.close();
});

ipcMain.handle('open-directory', async (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (!w) return null;
  const result = await dialog.showOpenDialog(w, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('before-quit', () => {
  // Let the daemon run in the background for testing
  // if (daemonProcess) {
  //   daemonProcess.kill();
  //   daemonProcess = null;
  // }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  startNyxoraDaemon();
  createWindow();
});
