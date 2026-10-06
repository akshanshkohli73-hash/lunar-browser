import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Tab Management
  createTab: (url?: string) => ipcRenderer.invoke('tab:create', url),
  closeTab: (tabId: string) => ipcRenderer.invoke('tab:close', tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke('tab:switch', tabId),
  navigateTab: (tabId: string, url: string) => ipcRenderer.invoke('tab:navigate', tabId, url),
  goBack: (tabId: string) => ipcRenderer.invoke('tab:goBack', tabId),
  goForward: (tabId: string) => ipcRenderer.invoke('tab:goForward', tabId),
  reloadTab: (tabId: string, ignoreCache?: boolean) => ipcRenderer.invoke('tab:reload', tabId, ignoreCache),
  toggleMuteTab: (tabId: string) => ipcRenderer.invoke('tab:toggleMute', tabId),
  togglePinTab: (tabId: string) => ipcRenderer.invoke('tab:togglePin', tabId),
  duplicateTab: (tabId: string) => ipcRenderer.invoke('tab:duplicate', tabId),
  reorderTabs: (tabIds: string[]) => ipcRenderer.invoke('tab:reorder', tabIds),

  // Tab Events
  onTabsUpdated: (callback: (tabs: any[], activeTabId: string) => void) => {
    const listener = (_: any, tabs: any[], activeTabId: string) => callback(tabs, activeTabId);
    ipcRenderer.on('tabs:updated', listener);
    return () => ipcRenderer.removeListener('tabs:updated', listener);
  },

  // Shield
  getShieldStats: (url?: string) => ipcRenderer.invoke('shield:getStats', url),
  getShieldSettings: () => ipcRenderer.invoke('shield:getSettings'),
  updateShieldSettings: (settings: any) => ipcRenderer.invoke('shield:updateSettings', settings),
  toggleSiteAllowlist: (hostname: string) => ipcRenderer.invoke('shield:toggleAllowlist', hostname),
  onShieldStatsUpdated: (callback: (stats: any) => void) => {
    const listener = (_: any, stats: any) => callback(stats);
    ipcRenderer.on('shield:statsUpdated', listener);
    return () => ipcRenderer.removeListener('shield:statsUpdated', listener);
  },

  // Settings & Storage
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),

  // History & Bookmarks
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (item: any) => ipcRenderer.invoke('history:add', item),
  deleteHistoryItem: (id: string) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  addBookmark: (bookmark: any) => ipcRenderer.invoke('bookmarks:add', bookmark),
  deleteBookmark: (id: string) => ipcRenderer.invoke('bookmarks:delete', id),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  cancelDownload: (id: string) => ipcRenderer.invoke('downloads:cancel', id),
  pauseDownload: (id: string) => ipcRenderer.invoke('downloads:pause', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('downloads:resume', id),
  revealDownload: (id: string) => ipcRenderer.invoke('downloads:reveal', id),
  onDownloadsUpdated: (callback: (downloads: any[]) => void) => {
    const listener = (_: any, downloads: any[]) => callback(downloads);
    ipcRenderer.on('downloads:updated', listener);
    return () => ipcRenderer.removeListener('downloads:updated', listener);
  },

  // AI & Vision
  getPageText: (tabId?: string) => ipcRenderer.invoke('ai:getPageText', tabId),
  captureTabScreenshot: (tabId?: string) => ipcRenderer.invoke('ai:captureScreenshot', tabId),

  // Workspaces & Split View
  getWorkspaces: () => ipcRenderer.invoke('workspace:get'),
  saveWorkspaces: (workspaces: any[]) => ipcRenderer.invoke('workspace:save', workspaces),
  setSplitView: (enabled: boolean, secondaryTabId?: string) => ipcRenderer.invoke('splitView:set', enabled, secondaryTabId),

  // Extensions
  getExtensions: () => ipcRenderer.invoke('extensions:get'),
  loadUnpackedExtension: () => ipcRenderer.invoke('extensions:loadUnpacked'),
  toggleExtension: (id: string, enabled: boolean) => ipcRenderer.invoke('extensions:toggle', id, enabled),
  removeExtension: (id: string) => ipcRenderer.invoke('extensions:remove', id),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  openDevTools: (tabId?: string) => ipcRenderer.invoke('window:devTools', tabId),
};

contextBridge.exposeInMainWorld('lunarAPI', api);

export type LunarAPI = typeof api;
