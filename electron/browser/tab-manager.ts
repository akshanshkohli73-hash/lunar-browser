import { BrowserWindow, WebContentsView, Rectangle, ipcMain } from 'electron';
import { TabInfo } from '../types';
import { formatSearchOrUrl } from '../security';

export interface TabViewItem {
  id: string;
  view: WebContentsView;
  info: TabInfo;
}

export class TabManager {
  private window: BrowserWindow;
  private tabs: Map<string, TabViewItem> = new Map();
  private activeTabId: string | null = null;
  private secondaryTabId: string | null = null; // Split view
  private isSplitView: boolean = false;
  private sidebarOpen: boolean = false;
  private contentBounds: Rectangle = { x: 0, y: 88, width: 1280, height: 712 };
  private onPageNavigateCallback?: (item: { url: string; title: string; favicon?: string }) => void;

  constructor(window: BrowserWindow, onPageNavigate?: (item: { url: string; title: string; favicon?: string }) => void) {
    this.window = window;
    this.onPageNavigateCallback = onPageNavigate;
    this.setupListeners();
  }

  public setContentBounds(bounds: Rectangle) {
    this.contentBounds = bounds;
    this.updateViewBounds();
  }

  public setSidebarOpen(open: boolean) {
    this.sidebarOpen = open;
    this.updateViewBounds();
  }

  private setupListeners() {
    this.window.on('resize', () => {
      const { width, height } = this.window.getContentBounds();
      // Keep height above top UI navbar (height 88px)
      this.contentBounds = {
        x: 0,
        y: 88,
        width,
        height: Math.max(100, height - 88),
      };
      this.updateViewBounds();
    });
  }

  public createTab(url?: string): TabInfo {
    const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Create modern WebContentsView
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });

    const initialUrl = url ? formatSearchOrUrl(url) : 'lunar://newtab';

    const info: TabInfo = {
      id,
      url: initialUrl,
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isMuted: false,
      isPinned: false,
      audible: false,
    };

    const tabItem: TabViewItem = { id, view, info };
    this.tabs.set(id, tabItem);

    // Attach WebContents event handlers
    const wc = view.webContents;

    wc.setWindowOpenHandler(({ url: targetUrl }) => {
      this.createTab(targetUrl);
      return { action: 'deny' };
    });

    wc.on('did-start-loading', () => {
      info.isLoading = true;
      this.notifyTabsUpdated();
    });

    wc.on('did-finish-load', () => {
      info.isLoading = false;
      info.title = wc.getTitle() || 'Lunar Page';
      info.url = wc.getURL();
      info.canGoBack = wc.canGoBack();
      info.canGoForward = wc.canGoForward();
      this.notifyTabsUpdated();

      // Record History
      if (!info.url.startsWith('lunar://') && this.onPageNavigateCallback) {
        this.onPageNavigateCallback({
          url: info.url,
          title: info.title,
          favicon: info.favicon,
        });
      }
    });

    wc.on('page-title-updated', (_, title) => {
      info.title = title;
      this.notifyTabsUpdated();
    });

    wc.on('page-favicon-updated', (_, favicons) => {
      if (favicons && favicons.length > 0) {
        info.favicon = favicons[0];
        this.notifyTabsUpdated();
      }
    });

    wc.on('media-started-playing', () => {
      info.audible = true;
      this.notifyTabsUpdated();
    });

    wc.on('media-paused', () => {
      info.audible = false;
      this.notifyTabsUpdated();
    });

    wc.on('render-process-gone', (_, details) => {
      if (details.reason !== 'clean-exit') {
        info.crashed = true;
        this.notifyTabsUpdated();
      }
    });

    // Load URL if not lunar:// page
    if (initialUrl.startsWith('http://') || initialUrl.startsWith('https://') || initialUrl.startsWith('file://')) {
      wc.loadURL(initialUrl);
    }

    this.switchTab(id);
    return info;
  }

  public switchTab(tabId: string) {
    if (!this.tabs.has(tabId)) return;

    // Remove current views from content view
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const prev = this.tabs.get(this.activeTabId)!;
      try {
        this.window.contentView.removeChildView(prev.view);
      } catch (_) {}
    }

    if (this.secondaryTabId && this.tabs.has(this.secondaryTabId)) {
      const prevSec = this.tabs.get(this.secondaryTabId)!;
      try {
        this.window.contentView.removeChildView(prevSec.view);
      } catch (_) {}
    }

    this.activeTabId = tabId;
    const current = this.tabs.get(tabId)!;

    // Add view to window content view if real webpage (non lunar://)
    if (!current.info.url.startsWith('lunar://')) {
      this.window.contentView.addChildView(current.view);
    }

    if (this.isSplitView && this.secondaryTabId && this.tabs.has(this.secondaryTabId)) {
      const secondary = this.tabs.get(this.secondaryTabId)!;
      if (!secondary.info.url.startsWith('lunar://')) {
        this.window.contentView.addChildView(secondary.view);
      }
    }

    this.updateViewBounds();
    this.notifyTabsUpdated();
  }

  public closeTab(tabId: string) {
    if (!this.tabs.has(tabId)) return;

    const tabItem = this.tabs.get(tabId)!;
    try {
      this.window.contentView.removeChildView(tabItem.view);
      (tabItem.view.webContents as any).destroy?.();
    } catch (_) {}

    this.tabs.delete(tabId);

    // If active tab closed, switch to another
    if (this.activeTabId === tabId) {
      const remainingIds = Array.from(this.tabs.keys());
      if (remainingIds.length > 0) {
        this.switchTab(remainingIds[remainingIds.length - 1]);
      } else {
        this.activeTabId = null;
        this.createTab('lunar://newtab');
      }
    } else {
      this.notifyTabsUpdated();
    }
  }

  public navigate(tabId: string, inputUrl: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const formatted = formatSearchOrUrl(inputUrl);
    tab.info.url = formatted;
    tab.info.crashed = false;

    if (formatted.startsWith('lunar://')) {
      try {
        this.window.contentView.removeChildView(tab.view);
      } catch (_) {}
    } else {
      if (this.activeTabId === tabId) {
        try {
          this.window.contentView.addChildView(tab.view);
        } catch (_) {}
      }
      tab.view.webContents.loadURL(formatted);
    }

    this.updateViewBounds();
    this.notifyTabsUpdated();
  }

  public goBack(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab && tab.view.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  public goForward(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab && tab.view.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  public reload(tabId: string, ignoreCache: boolean = false) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.info.crashed = false;
      if (ignoreCache) {
        tab.view.webContents.reloadIgnoringCache();
      } else {
        tab.view.webContents.reload();
      }
    }
  }

  public toggleMute(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.info.isMuted = !tab.info.isMuted;
      tab.view.webContents.setAudioMuted(tab.info.isMuted);
      this.notifyTabsUpdated();
    }
  }

  public togglePin(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.info.isPinned = !tab.info.isPinned;
      this.notifyTabsUpdated();
    }
  }

  public duplicateTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.createTab(tab.info.url);
    }
  }

  public reorderTabs(orderedIds: string[]) {
    const newMap = new Map<string, TabViewItem>();
    for (const id of orderedIds) {
      if (this.tabs.has(id)) {
        newMap.set(id, this.tabs.get(id)!);
      }
    }
    this.tabs = newMap;
    this.notifyTabsUpdated();
  }

  public setSplitView(enabled: boolean, secondaryTabId?: string) {
    this.isSplitView = enabled;
    this.secondaryTabId = secondaryTabId || null;
    this.updateViewBounds();
    this.notifyTabsUpdated();
  }

  public updateViewBounds() {
    if (!this.activeTabId || !this.tabs.has(this.activeTabId)) return;

    const activeTab = this.tabs.get(this.activeTabId)!;
    const sidebarWidth = this.sidebarOpen ? 320 : 0;
    const effectiveWidth = Math.max(100, this.contentBounds.width - sidebarWidth);

    if (this.isSplitView && this.secondaryTabId && this.tabs.has(this.secondaryTabId)) {
      const secondaryTab = this.tabs.get(this.secondaryTabId)!;
      const halfWidth = Math.floor(effectiveWidth / 2);

      if (!activeTab.info.url.startsWith('lunar://')) {
        activeTab.view.setBounds({
          x: this.contentBounds.x,
          y: this.contentBounds.y,
          width: halfWidth,
          height: this.contentBounds.height,
        });
      }

      if (!secondaryTab.info.url.startsWith('lunar://')) {
        secondaryTab.view.setBounds({
          x: this.contentBounds.x + halfWidth,
          y: this.contentBounds.y,
          width: effectiveWidth - halfWidth,
          height: this.contentBounds.height,
        });
      }
    } else {
      if (!activeTab.info.url.startsWith('lunar://')) {
        activeTab.view.setBounds({
          x: this.contentBounds.x,
          y: this.contentBounds.y,
          width: effectiveWidth,
          height: this.contentBounds.height,
        });
      }
    }
  }

  public getActiveTab(): TabViewItem | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  public getTab(tabId: string): TabViewItem | null {
    return this.tabs.get(tabId) || null;
  }

  public getAllTabs(): TabInfo[] {
    return Array.from(this.tabs.values()).map((t) => t.info);
  }

  public notifyTabsUpdated() {
    const tabList = this.getAllTabs();
    this.window.webContents.send('tabs:updated', tabList, this.activeTabId);
  }
}
