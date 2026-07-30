import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, nativeImage as i, shell as a } from "electron";
import o from "node:path";
import { fileURLToPath as s } from "node:url";
import { spawn as c } from "node:child_process";
import l from "node:os";
import u from "node:fs";
t.name = "Nyxora", t.setAppUserModelId("Nyxora"), process.platform === "linux" && t.setDesktopName("Nyxora.desktop");
var d = o.dirname(s(import.meta.url));
t.commandLine.appendSwitch("no-sandbox"), t.commandLine.appendSwitch("disable-gpu"), t.commandLine.appendSwitch("disable-software-rasterizer"), t.commandLine.appendSwitch("disable-gpu-compositing"), process.env.APP_ROOT = o.join(d, "..");
var f = process.env.VITE_DEV_SERVER_URL, p = o.join(process.env.APP_ROOT, "dist-electron"), m = o.join(process.env.APP_ROOT, "build");
process.env.VITE_PUBLIC = f ? o.join(process.env.APP_ROOT, "public") : m;
var h, g = null;
function _() {
	g = c("node", ["./bin/nyxora.mjs", "start"], {
		cwd: o.join(process.env.APP_ROOT, "../.."),
		stdio: "ignore",
		detached: !0,
		env: {
			...process.env,
			PORT: "3000"
		}
	}), g.unref(), g.on("error", (e) => {
		console.error("[Nyxora Daemon Error]:", e);
	});
}
function v() {
	h = new e({
		title: "Nyxora",
		icon: i.createFromPath(o.join(process.env.VITE_PUBLIC, "nyxora-icon.png")),
		width: 1200,
		height: 800,
		titleBarStyle: "hidden",
		frame: process.platform === "darwin",
		transparent: process.platform === "linux",
		webPreferences: {
			preload: o.join(d, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), h.webContents.setWindowOpenHandler((e) => e.url.startsWith("http://") || e.url.startsWith("https://") ? (a.openExternal(e.url), { action: "deny" }) : { action: "allow" }), h.webContents.on("will-navigate", (e, t) => {
		f && t.startsWith(f) || t.startsWith("file://") || (t.startsWith("http://") || t.startsWith("https://")) && (e.preventDefault(), a.openExternal(t));
	});
	let t = "";
	try {
		let e = o.join(l.homedir(), ".nyxora", "auth", "auth.token");
		if (u.existsSync(e) && (t = u.readFileSync(e, "utf8").trim(), t.startsWith("{"))) try {
			t = JSON.parse(t).token;
		} catch {}
	} catch {}
	if (f) {
		let e = new URL(f);
		t && e.searchParams.set("token", t), h.loadURL(e.toString());
	} else h.loadFile(o.join(m, "index.html"), t ? { query: { token: t } } : {});
}
r.on("window-minimize", (t) => {
	let n = e.fromWebContents(t.sender);
	n && n.minimize();
}), r.on("window-maximize", (t) => {
	let n = e.fromWebContents(t.sender);
	n && (n.isMaximized() ? n.unmaximize() : n.maximize());
}), r.on("window-close", (t) => {
	let n = e.fromWebContents(t.sender);
	n && n.close();
}), r.handle("open-directory", async (t) => {
	let r = e.fromWebContents(t.sender);
	if (!r) return null;
	let i = await n.showOpenDialog(r, { properties: ["openDirectory", "createDirectory"] });
	return !i.canceled && i.filePaths.length > 0 ? i.filePaths[0] : null;
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), h = null);
}), t.on("before-quit", () => {}), t.on("activate", () => {
	e.getAllWindows().length === 0 && v();
}), t.whenReady().then(() => {
	_(), v();
});
//#endregion
export { p as MAIN_DIST, m as RENDERER_DIST, f as VITE_DEV_SERVER_URL };
