import { BrowserWindow, app, dialog, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
//#region electron/main.ts
app.name = "Nyxora";
app.setAppUserModelId("Nyxora");
if (process.platform === "linux") app.setDesktopName("Nyxora.desktop");
var __dirname = path.dirname(fileURLToPath(import.meta.url));
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
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
			PORT: process.env.PORT || "40000"
		}
	});
	daemonProcess.unref();
	daemonProcess.on("error", (err) => {
		console.error("[Nyxora Daemon Error]:", err);
	});
}
function createWindow() {
	win = new BrowserWindow({
		title: "Nyxora",
		icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, "nyxora-icon.png")),
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
	win.webContents.setWindowOpenHandler((details) => {
		if (details.url.startsWith("http://") || details.url.startsWith("https://")) {
			shell.openExternal(details.url);
			return { action: "deny" };
		}
		return { action: "allow" };
	});
	win.webContents.on("will-navigate", (event, url) => {
		if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return;
		if (url.startsWith("file://")) return;
		if (url.startsWith("http://") || url.startsWith("https://")) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});
	let token = "";
	try {
		const tokenPath = path.join(os.homedir(), ".nyxora", "auth", "auth.token");
		if (fs.existsSync(tokenPath)) {
			token = fs.readFileSync(tokenPath, "utf8").trim();
			if (token.startsWith("{")) try {
				token = JSON.parse(token).token;
			} catch (e) {}
		}
	} catch (e) {}
	if (VITE_DEV_SERVER_URL) {
		const devUrl = new URL(VITE_DEV_SERVER_URL);
		if (token) devUrl.searchParams.set("token", token);
		win.loadURL(devUrl.toString());
	} else win.loadFile(path.join(RENDERER_DIST, "index.html"), token ? { query: { token } } : {});
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
