import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { TabManager } from '../browser/tab-manager';
import { LunarShield } from '../blocker/shield';
import { StorageService } from '../services/storage';
import { DownloadManager } from '../downloads/download-manager';
import { ExtensionManager } from '../extensions/extension-manager';
import { getPageText, captureTabScreenshot } from '../services/ai-extractor';
import { setupSecurityPolicies } from '../security';

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let lunarShield: LunarShield | null = null;
let storageService: StorageService | null = null;
let downloadManager: DownloadManager | null = null;
let extensionManager: ExtensionManager | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#FAF7F2',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  setupSecurityPolicies();

  storageService = new StorageService();
  extensionManager = new ExtensionManager();

  downloadManager = new DownloadManager((downloads) => {
    mainWindow?.webContents.send('downloads:updated', downloads);
  });

  lunarShield = new LunarShield((stats) => {
    mainWindow?.webContents.send('shield:statsUpdated', stats);
  });

  tabManager = new TabManager(mainWindow, (historyItem) => {
    storageService?.addHistory(historyItem);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('ready-to-show', () => {
    if (tabManager && tabManager.getAllTabs().length === 0) {
      tabManager.createTab('lunar://newtab');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
    lunarShield = null;
    storageService = null;
    downloadManager = null;
    extensionManager = null;
  });
}

// Tab IPC Handlers
ipcMain.handle('tab:create', (_, url?: string) => tabManager?.createTab(url));
ipcMain.handle('tab:close', (_, tabId: string) => tabManager?.closeTab(tabId));
ipcMain.handle('tab:switch', (_, tabId: string) => tabManager?.switchTab(tabId));
ipcMain.handle('tab:navigate', (_, tabId: string, url: string) => tabManager?.navigate(tabId, url));
ipcMain.handle('tab:goBack', (_, tabId: string) => tabManager?.goBack(tabId));
ipcMain.handle('tab:goForward', (_, tabId: string) => tabManager?.goForward(tabId));
ipcMain.handle('tab:reload', (_, tabId: string, ignoreCache?: boolean) => tabManager?.reload(tabId, ignoreCache));
ipcMain.handle('tab:toggleMute', (_, tabId: string) => tabManager?.toggleMute(tabId));
ipcMain.handle('tab:togglePin', (_, tabId: string) => tabManager?.togglePin(tabId));
ipcMain.handle('tab:duplicate', (_, tabId: string) => tabManager?.duplicateTab(tabId));
ipcMain.handle('tab:reorder', (_, orderedIds: string[]) => tabManager?.reorderTabs(orderedIds));
ipcMain.handle('tab:updateBounds', (_, tabId: string, bounds: { x: number; y: number; width: number; height: number }) => {
  if (!tabManager || !bounds) return;
  // Sanitize and validate geometry inputs
  const x = Math.round(Number(bounds.x) || 0);
  const y = Math.round(Number(bounds.y) || 0);
  const width = Math.max(10, Math.round(Number(bounds.width) || 100));
  const height = Math.max(10, Math.round(Number(bounds.height) || 100));
  tabManager.updateTabBounds(tabId, { x, y, width, height });
});

ipcMain.handle('splitView:set', (_, enabled: boolean, secondaryTabId?: string) => tabManager?.setSplitView(enabled, secondaryTabId));

// Lunar Shield IPC
ipcMain.handle('shield:getStats', () => lunarShield?.getStats());
ipcMain.handle('shield:getSettings', () => lunarShield?.getSettings());
ipcMain.handle('shield:updateSettings', (_, settings) => lunarShield?.updateSettings(settings));
ipcMain.handle('shield:toggleAllowlist', (_, hostname) => lunarShield?.toggleAllowlist(hostname));

// Storage / Settings IPC
ipcMain.handle('settings:get', () => storageService?.getSettings());
ipcMain.handle('settings:update', (_, settings) => storageService?.updateSettings(settings));

// History IPC
ipcMain.handle('history:get', () => storageService?.getHistory());
ipcMain.handle('history:add', (_, item) => storageService?.addHistory(item));
ipcMain.handle('history:delete', (_, id) => storageService?.deleteHistoryItem(id));
ipcMain.handle('history:clear', () => storageService?.clearHistory());

// Bookmarks IPC
ipcMain.handle('bookmarks:get', () => storageService?.getBookmarks());
ipcMain.handle('bookmarks:add', (_, bookmark) => storageService?.addBookmark(bookmark));
ipcMain.handle('bookmarks:delete', (_, id) => storageService?.deleteBookmark(id));

// Downloads IPC
ipcMain.handle('downloads:get', () => downloadManager?.getDownloads());
ipcMain.handle('downloads:cancel', (_, id) => downloadManager?.cancelDownload(id));
ipcMain.handle('downloads:pause', (_, id) => downloadManager?.pauseDownload(id));
ipcMain.handle('downloads:resume', (_, id) => downloadManager?.resumeDownload(id));
ipcMain.handle('downloads:reveal', (_, id) => downloadManager?.revealDownload(id));

// Extensions IPC
ipcMain.handle('extensions:get', () => extensionManager?.getExtensions());
ipcMain.handle('extensions:loadUnpacked', () => extensionManager?.loadUnpackedExtension());
ipcMain.handle('extensions:toggle', (_, id, enabled) => extensionManager?.toggleExtension(id, enabled));
ipcMain.handle('extensions:remove', (_, id) => extensionManager?.removeExtension(id));

// AI Content Extraction IPC
ipcMain.handle('ai:getPageText', (_, tabId?: string) => (tabManager ? getPageText(tabManager, tabId) : ''));
ipcMain.handle('ai:captureScreenshot', (_, tabId?: string) => (tabManager ? captureTabScreenshot(tabManager, tabId) : ''));

// Workspaces IPC
ipcMain.handle('workspace:get', () => storageService?.getWorkspaces());
ipcMain.handle('workspace:save', (_, workspaces) => storageService?.saveWorkspaces(workspaces));

// Window controls IPC
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:devTools', (_, tabId?: string) => {
  if (tabId && tabManager) {
    const tab = tabManager.getTab(tabId);
    if (tab) {
      tab.view.webContents.openDevTools({ mode: 'detach' });
      return;
    }
  }
  mainWindow?.webContents.openDevTools({ mode: 'detach' });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
