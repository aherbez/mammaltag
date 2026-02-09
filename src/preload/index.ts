import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  buildHelloWorld: (): Promise<unknown> =>
    ipcRenderer.invoke("cad:build-hello-world"),
  buildTag: (
    width: number,
    depth: number,
    height: number,
    text?: string,
  ): Promise<unknown> =>
    ipcRenderer.invoke("cad:build-seal-tag", width, depth, height, text),
  onExportSTL: (callback: () => void): (() => void) => {
    ipcRenderer.removeAllListeners("export-stl");
    ipcRenderer.on("export-stl", callback);
    return () => ipcRenderer.removeAllListeners("export-stl");
  },
  saveSTL: (buffer: ArrayBuffer): Promise<boolean> =>
    ipcRenderer.invoke("cad:save-stl", buffer),
});
