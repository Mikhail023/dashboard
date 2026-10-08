import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dashboardSplash", {
  onComplete(callback: () => void) {
    const listener = () => callback();
    ipcRenderer.on("dashboard:splash-complete", listener);
    return () => ipcRenderer.removeListener("dashboard:splash-complete", listener);
  },
});
