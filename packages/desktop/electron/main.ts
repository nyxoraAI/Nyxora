import { app, BrowserWindow, shell, ipcMain, Tray, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import http from 'node:http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = path.join(__dirname, '..')
process.env.DIST = path.join(process.env.DIST_ELECTRON, 'dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.DIST_ELECTRON, 'public')
  : process.env.DIST

let win: BrowserWindow | null = null
let tray: Tray | null = null

// VITE_DEV_SERVER_URL is injected by vite-plugin-electron
const url = process.env.VITE_DEV_SERVER_URL

// Poll until daemon is ready (port 3000 responds) or timeout
function waitForDaemon(maxWaitMs = 15000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const interval = setInterval(() => {
      const req = http.get('http://127.0.0.1:3000/api/health', (_res) => {
        clearInterval(interval)
        console.log('[Desktop] Daemon is ready ✅')
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start >= maxWaitMs) {
          clearInterval(interval)
          console.warn('[Desktop] Daemon did not respond in time, opening window anyway.')
          resolve()
        }
      })
      req.setTimeout(400, () => req.destroy())
    }, 500)
  })
}

function startNyxoraDaemon(): Promise<void> {
  return new Promise((resolve) => {
    console.log('Starting Nyxora Daemon...')
    const binPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'bin/nyxora.mjs')
      : path.resolve(__dirname, '../../../bin/nyxora.mjs')
      
    exec(`node "${binPath}" start`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error starting daemon: ${error.message}`)
        resolve()
        return
      }
      console.log(`Daemon stdout: ${stdout}`)
      // Always poll for readiness — whether freshly started or already running
      await waitForDaemon(15000)
      resolve()
    })
  })
}

function stopNyxoraDaemon() {
  console.log('Stopping Nyxora Daemon...')
  const binPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin/nyxora.mjs')
    : path.resolve(__dirname, '../../../bin/nyxora.mjs')
    
  exec(`node "${binPath}" stop`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error stopping daemon: ${error.message}`)
      return
    }
    console.log(`Daemon stdout: ${stdout}`)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Nyxora Desktop',
    titleBarStyle: 'hidden',
    frame: process.platform === 'darwin',
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  let finalUrl = url
  let finalPath = path.join(process.env.DIST || '', 'index.html')
  
  try {
    const fs = require('node:fs')
    const os = require('node:os')
    const tokenFile = path.join(os.homedir(), '.nyxora', 'auth', 'runtime.token')
    if (fs.existsSync(tokenFile)) {
      let token = fs.readFileSync(tokenFile, 'utf8').trim()
      if (token.startsWith('{')) {
        token = JSON.parse(token).token
      }
      if (finalUrl) {
        finalUrl = `${finalUrl}?token=${token}`
      } else {
        finalPath = `${finalPath}?token=${token}`
      }
    }
  } catch(e) {}

  if (finalUrl) {
    win.loadURL(finalUrl)
  } else {
    // Cannot pass query string to loadFile, but loadURL('file://...') works
    win.loadURL(`file://${finalPath}`)
  }

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return
  
  if (action === 'minimize') window.minimize()
  if (action === 'maximize') {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  }
  if (action === 'close') window.close()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Removed app.on('will-quit') to keep the daemon running after desktop is closed

app.whenReady().then(async () => {
  await startNyxoraDaemon()
  createWindow()
  
  // Tray setup
  /*
  tray = new Tray(path.join(process.env.VITE_PUBLIC, 'favicon.ico'))
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => win?.show() },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setToolTip('Nyxora Agent')
  tray.setContextMenu(contextMenu)
  */
})
