import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  buildHelloWorld: (): Promise<Uint8Array> =>
    ipcRenderer.invoke("cad:build-hello-world"),
  buildTag: (
    width: number,
    depth: number,
    height: number,
  ): Promise<Uint8Array> =>
    ipcRenderer.invoke("cad:build-seal-tag", width, depth, height),
});
