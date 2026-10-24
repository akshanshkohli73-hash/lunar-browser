import {
  WebContentsView,
  type BrowserWindow,
  type Session,
  type Input,
} from "electron";
import { randomUUID } from "node:crypto";
import {
  isInternalUrl,
  isWebUrl,
  normalizeNavigation,
  sanitizeFavicon,
  nativeNavigationUrl,
  displayNavigationUrl,
} from "../../shared/navigation";
import {
  clampBounds,
  isPermutation,
  nextActiveAfterClose,
  sameBounds,
  type ViewBounds,
} from "./geometry";
import type {
  BrowserSettings,
  SessionState,
  TabInfo,
  TabsSnapshot,
  WorkspaceLayout,
} from "../types";
import type { Shortcut } from "../../shared/api";

export interface TabViewItem {
  id: string;
  view: WebContentsView;
  info: TabInfo;
  lastBounds: ViewBounds | null;
}
interface TabOptions {
  session: Session;
  settings: () => BrowserSettings;
  onNavigate: (item: { url: string; title: string }) => void;
  onChanged?: (state: SessionState) => void;
  onError: (message: string) => void;
  onExternal: (url: string) => Promise<void>;
  onPopupBlocked: () => void;
  onShortcut: (shortcut: Shortcut) => void;
}
export class TabManager {
  private tabs = new Map<string, TabViewItem>();
  private activeTabId: string | null = null;
  private attached = new Set<string>();
  private contentsIds = new Map<number, string>();
  private focusOnAttach = false;
  private layout: WorkspaceLayout | null = null;
  private disposed = false;
  private revision = 0;
  private onResize = () => this.reconcileViews();
  constructor(
    private window: BrowserWindow,
    private options: TabOptions,
  ) {
    window.on("resize", this.onResize);
    window.on("enter-full-screen", this.onResize);
    window.on("leave-full-screen", this.onResize);
  }
  public createTab(input = "lunar://newtab", pinned = false): TabInfo {
    if (this.disposed) throw new Error("The browser is closing.");
    if (this.tabs.size >= 100)
      throw new Error("The 100-tab limit has been reached. Close a tab first.");
    const url = normalizeNavigation(
      input,
      this.options.settings().searchEngine,
    );
    const id = `tab_${randomUUID()}`;
    const view = new WebContentsView({
      webPreferences: {
        session: this.options.session,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
      },
    });
    view.setVisible(false);
    const info: TabInfo = {
      id,
      url,
      title: isInternalUrl(url) ? this.internalTitle(url) : "Loading…",
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isMuted: false,
      isPinned: pinned,
      audible: false,
    };
    const tab: TabViewItem = { id, view, info, lastBounds: null };
    this.tabs.set(id, tab);
    this.contentsIds.set(view.webContents.id, id);
    const wc = view.webContents;
    const sync = () => {
      if (this.disposed || !this.tabs.has(id) || wc.isDestroyed()) return;
      info.isLoading = wc.isLoading();
      info.canGoBack = wc.navigationHistory.canGoBack();
      info.canGoForward = wc.navigationHistory.canGoForward();
    };
    wc.setWindowOpenHandler((details) => {
      if (
        this.options.settings().shield.enabled &&
        this.options.settings().shield.popups &&
        details.disposition === "new-window"
      ) {
        this.options.onPopupBlocked();
      } else if (isWebUrl(details.url)) {
        try {
          this.createTab(details.url);
        } catch (error) {
          this.options.onError(this.message(error));
        }
      } else {
        void this.options
          .onExternal(details.url)
          .catch((error) => this.options.onError(this.message(error)));
      }
      return { action: "deny" };
    });
    wc.on("will-navigate", (event, target) => {
      if (!isWebUrl(target)) {
        event.preventDefault();
        void this.options
          .onExternal(target)
          .catch((error) => this.options.onError(this.message(error)));
      }
    });
    // Untrusted pages cannot redirect a native view into file:, chrome:, or lunar:.
    wc.on("will-redirect", (event, target) => {
      if (!isWebUrl(target)) event.preventDefault();
    });
    wc.on("will-frame-navigate", (event) => {
      // about:blank/srcdoc and blob frames are valid web content, but never privileged schemes.
      if (
        !isWebUrl(event.url) &&
        !["about:blank", "about:srcdoc"].includes(event.url) &&
        !event.url.startsWith("blob:") &&
        !(displayNavigationUrl(event.url) && !event.initiator)
      )
        event.preventDefault();
    });
    wc.on("will-attach-webview", (event) => event.preventDefault());
    wc.on("did-start-loading", () => {
      info.isLoading = true;
      this.notifyTabsUpdated();
    });
    wc.on("did-stop-loading", () => {
      sync();
      this.notifyTabsUpdated();
    });
    wc.on("did-navigate", (_event, target) => {
      const display = displayNavigationUrl(target);
      if (!display) return;
      info.url = display;
      info.error = undefined;
      info.crashed = false;
      if (isInternalUrl(display)) {
        info.title = this.internalTitle(display);
        info.favicon = undefined;
      }
      sync();
      this.reconcileViews();
      this.notifyTabsUpdated();
    });
    wc.on("did-navigate-in-page", (_event, target, isMainFrame) => {
      if (!isMainFrame) return;
      const display = displayNavigationUrl(target);
      if (!display) return;
      info.url = display;
      if (isInternalUrl(display)) {
        info.title = this.internalTitle(display);
        info.favicon = undefined;
      }
      sync();
      this.record(tab);
      this.reconcileViews();
      this.notifyTabsUpdated();
    });
    wc.on("did-finish-load", () => {
      if (wc.isDestroyed()) return;
      const committed = displayNavigationUrl(wc.getURL());
      if (!committed) return;
      info.url = committed;
      info.title = isInternalUrl(committed)
        ? this.internalTitle(committed)
        : wc.getTitle().slice(0, 500) || committed;
      info.error = undefined;
      info.crashed = false;
      sync();
      this.record(tab);
      this.reconcileViews();
      this.notifyTabsUpdated();
    });
    wc.on("did-fail-load", (_event, code, description, target, isMainFrame) => {
      if (!isMainFrame || code === -3 || isInternalUrl(info.url)) return;
      if (displayNavigationUrl(target) !== info.url) return; // A previous load can abort after a new navigation.
      info.isLoading = false;
      info.error = `Could not load this page (${code}): ${description.slice(0, 200)}`;
      sync();
      this.reconcileViews();
      this.notifyTabsUpdated();
    });
    wc.on("page-title-updated", (_event, title) => {
      if (!isInternalUrl(info.url)) {
        info.title = title.slice(0, 500);
        this.notifyTabsUpdated();
      }
    });
    wc.on("page-favicon-updated", (_event, icons) => {
      info.favicon = icons.map(sanitizeFavicon).find(Boolean);
      this.notifyTabsUpdated();
    });
    wc.on("media-started-playing", () => {
      info.audible = true;
      this.notifyTabsUpdated();
    });
    wc.on("media-paused", () => {
      info.audible = false;
      this.notifyTabsUpdated();
    });
    wc.on("render-process-gone", (_event, details) => {
      if (details.reason !== "clean-exit") {
        info.crashed = true;
        info.isLoading = false;
        info.error = "This page stopped responding. Reload to try again.";
        this.reconcileViews();
        this.notifyTabsUpdated();
      }
    });
    wc.on("destroyed", () => {
      if (this.tabs.has(id) && !this.disposed) this.removeTab(id, false);
    });
    wc.on("before-input-event", (event, input) => {
      if (this.handleShortcut(input)) event.preventDefault();
    });
    this.switchTab(id);
    this.load(tab, url);
    return { ...info };
  }
  private internalTitle(url: string): string {
    return (
      (
        {
          newtab: "New Tab",
          settings: "Preferences",
          themestudio: "Theme Studio",
          history: "History",
          bookmarks: "Bookmarks",
          downloads: "Downloads",
          extensions: "Extensions",
        } as Record<string, string>
      )[url.slice(8)] ?? "Lunar"
    );
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "A browser operation failed.";
  }
  private load(tab: TabViewItem, url: string) {
    tab.info.error = undefined;
    tab.info.crashed = false;
    tab.info.isLoading = true;
    void tab.view.webContents
      .loadURL(nativeNavigationUrl(url))
      .catch((error: unknown) => {
        if (
          !this.tabs.has(tab.id) ||
          this.disposed ||
          tab.info.url !== url ||
          (error instanceof Error && error.message.includes("ERR_ABORTED"))
        )
          return;
        tab.info.isLoading = false;
        tab.info.error =
          "The page could not be loaded. Check the address or your connection, then try again.";
        this.reconcileViews();
        this.notifyTabsUpdated();
      });
    this.reconcileViews();
    this.notifyTabsUpdated();
  }
  private record(tab: TabViewItem) {
    if (!isWebUrl(tab.info.url) || tab.info.error) return;
    try {
      this.options.onNavigate({ url: tab.info.url, title: tab.info.title });
    } catch (error) {
      this.options.onError(this.message(error));
    }
  }
  public navigate(id: string, input: string): void {
    const tab = this.requireTab(id),
      url = normalizeNavigation(input, this.options.settings().searchEngine);
    tab.view.webContents.stop();
    tab.info.url = url;
    tab.info.favicon = undefined;
    tab.info.error = undefined;
    tab.info.crashed = false;
    if (isInternalUrl(url)) tab.info.title = this.internalTitle(url);
    if (id === this.activeTabId) this.focusOnAttach = !isInternalUrl(url);
    this.load(tab, url);
  }

  public switchTab(id: string): void {
    this.requireTab(id);
    if (id !== this.activeTabId) {
      this.activeTabId = id;
      this.layout = null;
      this.focusOnAttach = true;
    }
    this.reconcileViews();
    this.notifyTabsUpdated();
  }
  public closeTab(id: string): void {
    this.requireTab(id);
    this.removeTab(id, true);
  }
  private removeTab(id: string, close: boolean) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const next = nextActiveAfterClose(
      [...this.tabs.keys()],
      this.activeTabId,
      id,
    );
    this.detach(tab);
    this.tabs.delete(id);
    this.contentsIds.delete(tab.view.webContents.id);
    if (close && !tab.view.webContents.isDestroyed())
      tab.view.webContents.close({ waitForBeforeUnload: false });
    tab.view.webContents.removeAllListeners();
    if (this.activeTabId !== next) {
      this.activeTabId = next;
      this.layout = null;
    }
    if (!this.tabs.size && !this.disposed) this.createTab();
    else {
      this.reconcileViews();
      this.notifyTabsUpdated();
    }
  }
  public updateWorkspace(layout: WorkspaceLayout): boolean {
    if (
      this.disposed ||
      layout.tabId !== this.activeTabId ||
      !this.tabs.has(layout.tabId)
    )
      return false;
    if (layout.visible && !this.layout?.visible) this.focusOnAttach = true;
    this.layout = layout;
    this.reconcileViews();
    return true;
  }
  private detach(tab: TabViewItem) {
    if (!tab.view.webContents.isDestroyed()) tab.view.setVisible(false);
    if (this.attached.delete(tab.id) && !this.window.isDestroyed())
      this.window.contentView.removeChildView(tab.view);
  }
  private reconcileViews() {
    if (this.window.isDestroyed()) return;
    for (const tab of this.tabs.values()) {
      const show =
        !this.disposed &&
        this.activeTabId === tab.id &&
        this.layout?.visible &&
        this.layout.tabId === tab.id &&
        isWebUrl(tab.info.url) &&
        !tab.info.error &&
        !tab.info.crashed &&
        !tab.view.webContents.isDestroyed();
      const bounds =
        show && this.layout
          ? clampBounds(this.layout.bounds, this.window.getContentBounds())
          : null;
      if (!bounds || bounds.width < 1 || bounds.height < 1) {
        this.detach(tab);
        continue;
      }
      if (!sameBounds(tab.lastBounds, bounds)) {
        tab.view.setBounds(bounds);
        tab.lastBounds = bounds;
      }
      if (!this.attached.has(tab.id)) {
        this.window.contentView.addChildView(tab.view);
        this.attached.add(tab.id);
      }
      tab.view.setVisible(true);
      if (this.focusOnAttach) {
        tab.view.webContents.focus();
        this.focusOnAttach = false;
      }
    }
  }
  private requireTab(id: string): TabViewItem {
    const tab = this.tabs.get(id);
    if (!tab || tab.view.webContents.isDestroyed())
      throw new Error("That tab is no longer available.");
    return tab;
  }
  public goBack(id: string) {
    const t = this.requireTab(id);
    if (t.view.webContents.navigationHistory.canGoBack())
      t.view.webContents.navigationHistory.goBack();
  }
  public goForward(id: string) {
    const t = this.requireTab(id);
    if (t.view.webContents.navigationHistory.canGoForward())
      t.view.webContents.navigationHistory.goForward();
  }
  public reload(id: string, ignoreCache = false) {
    const t = this.requireTab(id);
    t.info.error = undefined;
    t.info.crashed = false;
    t.info.isLoading = true;
    this.notifyTabsUpdated();
    // Retry the intended URL after a network failure (which may leave about:blank in wc).
    if (displayNavigationUrl(t.view.webContents.getURL()) !== t.info.url)
      this.load(t, t.info.url);
    else {
      if (ignoreCache) t.view.webContents.reloadIgnoringCache();
      else t.view.webContents.reload();
      this.reconcileViews();
    }
  }
  public stopLoading(id: string) {
    const t = this.requireTab(id);
    t.view.webContents.stop();
    t.info.isLoading = false;
    this.notifyTabsUpdated();
  }
  public toggleMute(id: string) {
    const t = this.requireTab(id);
    t.info.isMuted = !t.info.isMuted;
    t.view.webContents.setAudioMuted(t.info.isMuted);
    this.notifyTabsUpdated();
  }
  public togglePin(id: string) {
    const t = this.requireTab(id);
    t.info.isPinned = !t.info.isPinned;
    this.notifyTabsUpdated();
  }
  public duplicateTab(id: string) {
    return this.createTab(this.requireTab(id).info.url);
  }
  public reorderTabs(ids: string[]) {
    if (!isPermutation([...this.tabs.keys()], ids))
      throw new Error("A tab reorder must contain every tab exactly once.");
    this.tabs = new Map(ids.map((id) => [id, this.requireTab(id)]));
    this.notifyTabsUpdated();
  }
  public getTab(id: string): TabViewItem | null {
    return this.tabs.get(id) ?? null;
  }
  public getActiveTab(): TabViewItem | null {
    return this.activeTabId ? this.getTab(this.activeTabId) : null;
  }
  public ownsWebContents(id: number) {
    return this.contentsIds.has(id);
  }
  public downloadStarted(contentsId: number) {
    const id = this.contentsIds.get(contentsId),
      tab = id ? this.tabs.get(id) : undefined;
    if (!tab || tab.view.webContents.isDestroyed()) return;
    // An attachment response does not commit a webpage navigation. Keep the source address/title.
    const committed =
      displayNavigationUrl(tab.view.webContents.getURL()) ?? "lunar://newtab";
    tab.info.url = committed;
    tab.info.title = isInternalUrl(committed)
      ? this.internalTitle(committed)
      : tab.view.webContents.getTitle().slice(0, 500) || committed;
    tab.info.isLoading = false;
    tab.info.error = undefined;
    tab.info.canGoBack = tab.view.webContents.navigationHistory.canGoBack();
    tab.info.canGoForward =
      tab.view.webContents.navigationHistory.canGoForward();
    this.reconcileViews();
    this.notifyTabsUpdated();
  }
  public urlForWebContents(id: number) {
    const tabId = this.contentsIds.get(id);
    return tabId ? (this.tabs.get(tabId)?.info.url ?? "") : "";
  }
  public isActiveWebContents(id: number) {
    return (
      this.getActiveTab()?.view.webContents.id === id &&
      this.layout?.visible === true
    );
  }
  public getAllTabs(): TabInfo[] {
    return [...this.tabs.values()].map((tab) => ({ ...tab.info }));
  }
  public snapshot(): TabsSnapshot {
    return {
      revision: this.revision,
      tabs: this.getAllTabs(),
      activeTabId: this.activeTabId,
    };
  }
  public sessionState(): SessionState {
    return {
      tabs: this.getAllTabs().map(({ url, isPinned }) => ({ url, isPinned })),
      activeIndex: Math.max(
        0,
        [...this.tabs.keys()].indexOf(this.activeTabId ?? ""),
      ),
    };
  }
  public notifyTabsUpdated() {
    if (
      this.disposed ||
      this.window.isDestroyed() ||
      this.window.webContents.isDestroyed()
    )
      return;
    this.revision++;
    this.window.webContents.send("tabs:updated", this.snapshot());
    this.options.onChanged?.(this.sessionState());
  }
  /** Also called for native page key events; DOM-only shortcuts miss focused Chromium pages. */
  public handleShortcut(
    input: Pick<Input, "type" | "key" | "control" | "meta" | "shift" | "alt">,
  ): boolean {
    if (input.type !== "keyDown") return false;
    const key = input.key.toLowerCase(),
      ctrl = input.control || input.meta,
      active = this.activeTabId;
    try {
      if (ctrl && key === "t") {
        this.createTab();
        return true;
      }
      if (ctrl && key === "w" && active) {
        this.closeTab(active);
        return true;
      }
      if (ctrl && [" ", "space"].includes(key)) {
        this.window.webContents.focus();
        this.options.onShortcut("spotlight");
        return true;
      }
      if (ctrl && key === "r" && active) {
        this.reload(active, input.shift);
        return true;
      }
      if (key === "escape" && active) {
        this.stopLoading(active);
        return false;
      }
      if (ctrl && ["l", "k", "d", "j"].includes(key)) {
        this.window.webContents.focus();
        this.options.onShortcut(
          ({ l: "address", k: "commands", d: "bookmark", j: "ai" } as const)[
            key as "l" | "k" | "d" | "j"
          ],
        );
        return true;
      }
      const ids = [...this.tabs.keys()],
        index = ids.indexOf(active ?? "");
      if (ctrl && key === "tab" && ids.length) {
        this.switchTab(
          ids[(index + (input.shift ? -1 : 1) + ids.length) % ids.length],
        );
        return true;
      }
      if (ctrl && /^[1-9]$/u.test(key)) {
        const id = key === "9" ? ids.at(-1) : ids[Number(key) - 1];
        if (id) this.switchTab(id);
        return true;
      }
      if (input.alt && key === "arrowleft" && active) {
        this.goBack(active);
        return true;
      }
      if (input.alt && key === "arrowright" && active) {
        this.goForward(active);
        return true;
      }
      if (key === "f5" && active) {
        this.reload(active, input.control);
        return true;
      }
    } catch (error) {
      this.options.onError(this.message(error));
    }
    return false;
  }
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.window.removeListener("resize", this.onResize);
    this.window.removeListener("enter-full-screen", this.onResize);
    this.window.removeListener("leave-full-screen", this.onResize);
    for (const id of [...this.tabs.keys()]) this.removeTab(id, true);
    this.layout = null;
  }
}
