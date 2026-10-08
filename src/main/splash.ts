import { app, BrowserWindow, nativeTheme } from "electron";
import { join } from "node:path";
import type { SplashAppearance } from "../shared/splash";

type SplashSettings = Record<string, string>;

export function getSplashAppearance(settings: SplashSettings): SplashAppearance {
  const dark =
    settings.theme === "dark" ||
    (settings.theme !== "light" && nativeTheme.shouldUseDarkColors);
  const accent = /^#[0-9a-fA-F]{6}$/.test(settings.accentColor ?? "")
    ? settings.accentColor
    : "";
  return { dark, accent };
}

export function createSplashWindow(appearance: SplashAppearance) {
  return new BrowserWindow({
    width: 560,
    height: 500,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: false,
    show: false,
    backgroundColor: appearance.dark ? "#0c0f14" : "#f7f5f2",
    webPreferences: {
      preload: join(__dirname, "splash-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
}

export async function loadSplashWindow(
  splash: BrowserWindow,
  appearance: SplashAppearance,
) {
  const query = { theme: appearance.dark ? "dark" : "light", accent: appearance.accent };
  if (process.env.DASHBOARD_DEV === "1") {
    const params = new URLSearchParams(query).toString();
    await splash.loadURL(`http://127.0.0.1:5173/splash.html?${params}`);
  } else {
    await splash.loadFile(join(app.getAppPath(), "dist", "splash.html"), {
      query,
    });
  }
}
