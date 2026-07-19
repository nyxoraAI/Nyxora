import { BrowserWindow, app, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import http from "node:http";
//#region \0rolldown/runtime.js
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, { get: (a, b) => (typeof require !== "undefined" ? require : a)[b] }) : x)(function(x) {
	if (typeof require !== "undefined") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + x + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
});
//#endregion
//#region electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
process.env.DIST_ELECTRON = path.join(__dirname, "..");
process.env.DIST = path.join(process.env.DIST_ELECTRON, "dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? path.join(process.env.DIST_ELECTRON, "public") : process.env.DIST;
var win = null;
var url = process.env.VITE_DEV_SERVER_URL;
function waitForDaemon(maxWaitMs = 15e3) {
	return new Promise((resolve) => {
		const start = Date.now();
		const interval = setInterval(() => {
			const req = http.get("http://127.0.0.1:3000/api/health", (_res) => {
				clearInterval(interval);
				console.log("[Desktop] Daemon is ready ✅");
				resolve();
			});
			req.on("error", () => {
				if (Date.now() - start >= maxWaitMs) {
					clearInterval(interval);
					console.warn("[Desktop] Daemon did not respond in time, opening window anyway.");
					resolve();
				}
			});
			req.setTimeout(400, () => req.destroy());
		}, 500);
	});
}
function startNyxoraDaemon() {
	return new Promise((resolve) => {
		console.log("Starting Nyxora Daemon...");
		exec(`node "${app.isPackaged ? path.join(process.resourcesPath, "bin/nyxora.mjs") : path.resolve(__dirname, "../../../bin/nyxora.mjs")}" start`, async (error, stdout, stderr) => {
			if (error) {
				console.error(`Error starting daemon: ${error.message}`);
				resolve();
				return;
			}
			console.log(`Daemon stdout: ${stdout}`);
			await waitForDaemon(15e3);
			resolve();
		});
	});
}
function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		title: "Nyxora Desktop",
		titleBarStyle: "hidden",
		frame: process.platform === "darwin",
		icon: path.join(process.env.VITE_PUBLIC || "", "icon.png"),
		webPreferences: {
			preload: path.join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	let finalUrl = url;
	let finalPath = path.join(process.env.DIST || "", "index.html");
	try {
		const fs = __require("node:fs");
		const os = __require("node:os");
		const tokenFile = path.join(os.homedir(), ".nyxora", "auth", "runtime.token");
		if (fs.existsSync(tokenFile)) {
			let token = fs.readFileSync(tokenFile, "utf8").trim();
			if (token.startsWith("{")) token = JSON.parse(token).token;
			if (finalUrl) finalUrl = `${finalUrl}?token=${token}`;
			else finalPath = `${finalPath}?token=${token}`;
		}
	} catch (e) {}
	if (finalUrl) win.loadURL(finalUrl);
	else win.loadURL(`file://${finalPath}`);
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("https:")) shell.openExternal(url);
		return { action: "deny" };
	});
}
ipcMain.on("window-control", (event, action) => {
	const window = BrowserWindow.fromWebContents(event.sender);
	if (!window) return;
	if (action === "minimize") window.minimize();
	if (action === "maximize") if (window.isMaximized()) window.unmaximize();
	else window.maximize();
	if (action === "close") window.close();
});
app.on("window-all-closed", () => {
	win = null;
	if (process.platform !== "darwin") app.quit();
});
app.whenReady().then(async () => {
	await startNyxoraDaemon();
	createWindow();
});
//#endregion
