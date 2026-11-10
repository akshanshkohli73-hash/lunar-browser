import type { BrowserWindow, WebContents } from "electron";

type ShellWindow = Pick<BrowserWindow, "loadURL"> & {
  webContents: Pick<WebContents, "setZoomFactor" | "setVisualZoomLevelLimits">;
};

/** Renderer-side IPC must not be awaited before the renderer has been loaded. */
export async function loadShellWindow(window: ShellWindow, entryUrl: string) {
  window.webContents.setZoomFactor(1);
  await window.loadURL(entryUrl);
  await window.webContents.setVisualZoomLevelLimits(1, 1);
}
