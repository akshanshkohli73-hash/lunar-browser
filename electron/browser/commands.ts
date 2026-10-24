import type { BrowserWindow, WebContents } from "electron";
import type { BrowserCommand } from "../../shared/api";
import { isWebUrl } from "../../shared/navigation";
type EditingContents = Pick<
  WebContents,
  "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"
>;
interface CommandTarget {
  window: Pick<BrowserWindow, "isFullScreen" | "setFullScreen"> & {
    webContents: EditingContents;
  };
  tabs: {
    getActiveTab: () => {
      info: { url: string };
      view: { webContents: EditingContents };
    } | null;
    zoomActive: (command: "zoomIn" | "zoomOut" | "zoomReset") => void;
  };
}
/** Invoked only after owning-frame authorization and enum validation in main. */
export function executeBrowserCommand(
  ctx: CommandTarget,
  command: BrowserCommand,
  target: "page" | "chrome",
): void {
  if (command === "fullscreen") {
    ctx.window.setFullScreen(!ctx.window.isFullScreen());
    return;
  }
  if (
    command === "zoomIn" ||
    command === "zoomOut" ||
    command === "zoomReset"
  ) {
    ctx.tabs.zoomActive(command);
    return;
  }
  const tab = ctx.tabs.getActiveTab();
  if (target === "page" && (!tab || !isWebUrl(tab.info.url)))
    throw new Error("Select a website tab first.");
  const contents =
    target === "page" ? tab!.view.webContents : ctx.window.webContents;
  // A fixed set of editing methods. Never returns clipboard data or executes supplied JS.
  contents[command]();
}
