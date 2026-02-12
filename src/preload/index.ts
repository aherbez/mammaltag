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
    textHeight?: number,
  ): Promise<unknown> =>
    ipcRenderer.invoke(
      "cad:build-seal-tag",
      width,
      depth,
      height,
      text,
      textHeight,
    ),
  onExportSTL: (callback: () => void): (() => void) => {
    ipcRenderer.removeAllListeners("export-stl");
    ipcRenderer.on("export-stl", callback);
    return () => ipcRenderer.removeAllListeners("export-stl");
  },
  onShowAbout: (callback: () => void): (() => void) => {
    ipcRenderer.removeAllListeners("show-about");
    ipcRenderer.on("show-about", callback);
    return () => ipcRenderer.removeAllListeners("show-about");
  },
  triggerExportSTL: (): void => {
    ipcRenderer.emit("export-stl");
  },
  saveSTL: (buffer: ArrayBuffer): Promise<boolean> =>
    ipcRenderer.invoke("cad:save-stl", buffer),
});
