import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { Channel, Args, Outputs, Reply, LunarAPI } from "../../shared/api";

async function invoke<K extends Channel>(
  channel: K,
  ...args: Args<K>
): Promise<Outputs[K]> {
  const result: Reply<Outputs[K]> = await ipcRenderer.invoke(channel, ...args);
  if (!result || result.ok !== true)
    throw new Error(
      result?.error || "The browser could not complete this operation.",
    );
  return result.value;
}
function subscribe<T>(channel: string, callback: (value: T) => void) {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
// No arbitrary channel invocation or Electron/Node object crosses this bridge.
const api: LunarAPI = {
  bootstrap: () => invoke("browser:bootstrap"),
  createTab: (url) => invoke("tab:create", url),
  closeTab: (id) => invoke("tab:close", id),
  switchTab: (id) => invoke("tab:switch", id),
  navigateTab: (id, url) => invoke("tab:navigate", id, url),
  goBack: (id) => invoke("tab:back", id),
  goForward: (id) => invoke("tab:forward", id),
  reloadTab: (id, ignoreCache) => invoke("tab:reload", id, ignoreCache),
  stopTab: (id) => invoke("tab:stop", id),
  toggleMuteTab: (id) => invoke("tab:mute", id),
  togglePinTab: (id) => invoke("tab:pin", id),
  duplicateTab: (id) => invoke("tab:duplicate", id),
  reorderTabs: (ids) => invoke("tab:reorder", ids),
  updateWorkspace: (layout) => invoke("workspace:layout", layout),
  getDashboard: () => invoke("dashboard:get"),
  updateDashboard: (patch) => invoke("dashboard:update", patch),
  chooseWallpaper: () => invoke("wallpaper:choose"),
  pruneWallpapers: () => invoke("wallpaper:prune"),
  getWeather: (request) => invoke("weather:get", request),
  getSettings: () => invoke("settings:get"),
  updateSettings: (settings) => invoke("settings:update", settings),
  getBookmarks: () => invoke("bookmarks:get"),
  addBookmark: (input) => invoke("bookmarks:add", input),
  updateBookmark: (id, input) => invoke("bookmarks:update", id, input),
  deleteBookmark: (id) => invoke("bookmarks:delete", id),
  getHistory: () => invoke("history:get"),
  deleteHistoryItems: (ids) => invoke("history:delete", ids),
  clearHistory: () => invoke("history:clear"),
  getDownloads: () => invoke("downloads:get"),
  cancelDownload: (id) => invoke("downloads:cancel", id),
  pauseDownload: (id) => invoke("downloads:pause", id),
  resumeDownload: (id) => invoke("downloads:resume", id),
  revealDownload: (id) => invoke("downloads:reveal", id),
  clearDownloads: () => invoke("downloads:clear"),
  getShieldState: () => invoke("shield:get"),
  refreshShield: () => invoke("shield:refresh"),
  getExtensions: () => invoke("extensions:get"),
  loadUnpackedExtension: () => invoke("extensions:load"),
  toggleExtension: (id, enabled) => invoke("extensions:toggle", id, enabled),
  removeExtension: (id) => invoke("extensions:remove", id),
  getPageText: (id) => invoke("reader:text", id),
  getAIStatus: () => invoke("ai:status"),
  saveAIKey: (key) => invoke("ai:saveKey", key),
  deleteAIKey: () => invoke("ai:deleteKey"),
  testAI: () => invoke("ai:test"),
  askAI: (request) => invoke("ai:ask", request),
  getSitePrivacy: (url) => invoke("privacy:site", url),
  clearOriginData: (url) => invoke("privacy:clearOrigin", url),
  resetSitePermissions: (url) => invoke("permissions:resetSite", url),
  denySitePermission: (url, permission, deny) =>
    invoke("permissions:denySite", url, permission, deny),
  clearSiteData: () => invoke("privacy:clearSiteData"),
  resetPermissions: () => invoke("permissions:reset"),
  minimize: () => invoke("window:minimize"),
  maximize: () => invoke("window:maximize"),
  close: () => invoke("window:close"),
  onTabsUpdated: (callback) => subscribe("tabs:updated", callback),
  onDashboardUpdated: (callback) => subscribe("dashboard:updated", callback),
  onSettingsUpdated: (callback) => subscribe("settings:updated", callback),
  onBookmarksUpdated: (callback) => subscribe("bookmarks:updated", callback),
  onDownloadsUpdated: (callback) => subscribe("downloads:updated", callback),
  onShieldUpdated: (callback) => subscribe("shield:updated", callback),
  onShortcut: (callback) => subscribe("browser:shortcut", callback),
  onError: (callback) => subscribe("browser:error", callback),
};
contextBridge.exposeInMainWorld("lunarAPI", api);
