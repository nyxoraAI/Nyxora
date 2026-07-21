import { BrowserWindow, app, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
//#region electron/main.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-compositing");
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "build");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
var win;
var daemonProcess = null;
function startNyxoraDaemon() {
	daemonProcess = spawn("node", ["./bin/nyxora.mjs", "start"], {
		cwd: path.join(process.env.APP_ROOT, "../.."),
		stdio: "ignore",
		detached: true,
		env: {
			...process.env,
			PORT: "3000"
		}
	});
	daemonProcess.unref();
	daemonProcess.on("error", (err) => {
		console.error("[Nyxora Daemon Error]:", err);
	});
}
function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		titleBarStyle: "hidden",
		frame: process.platform === "darwin",
		transparent: process.platform === "linux",
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(RENDERER_DIST, "index.html"));
}
ipcMain.on("window-minimize", (event) => {
	const w = BrowserWindow.fromWebContents(event.sender);
	if (w) w.minimize();
});
ipcMain.on("window-maximize", (event) => {
	const w = BrowserWindow.fromWebContents(event.sender);
	if (w) if (w.isMaximized()) w.unmaximize();
	else w.maximize();
});
ipcMain.on("window-close", (event) => {
	const w = BrowserWindow.fromWebContents(event.sender);
	if (w) w.close();
});
ipcMain.handle("open-directory", async (event) => {
	const w = BrowserWindow.fromWebContents(event.sender);
	if (!w) return null;
	const result = await dialog.showOpenDialog(w, { properties: ["openDirectory", "createDirectory"] });
	if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
	return null;
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
app.on("before-quit", () => {});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.whenReady().then(() => {
	startNyxoraDaemon();
	createWindow();
});
//#endregion
export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
