import { contextBridge, ipcRenderer } from "electron";
import type { API, Request } from "../shared/model";
const api: API = {
  platform: process.platform,
  call: (request: Request) => ipcRenderer.invoke("dashboard:call", request),
  rendererReady: () => ipcRenderer.send("dashboard:renderer-ready"),
  onLock: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("dashboard:locked", listener);
    return () => ipcRenderer.removeListener("dashboard:locked", listener);
  },
  onTimer: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("dashboard:timer", listener);
    return () => ipcRenderer.removeListener("dashboard:timer", listener);
  },
};
contextBridge.exposeInMainWorld("dashboard", api);
let last = 0;
for (const event of ["pointerdown", "keydown", "mousemove", "wheel"])
  window.addEventListener(
    event,
    () => {
      if (Date.now() - last > 10000) {
        last = Date.now();
        ipcRenderer.send("dashboard:activity");
      }
    },
    { passive: true },
  );
