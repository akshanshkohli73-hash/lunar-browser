import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, Session, HandlerDetails, Input } from "electron";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import type { ViewBounds } from "../electron/browser/geometry";

class FakeContents extends EventEmitter {
  static count = 0;
  id = ++FakeContents.count;
  destroyed = false;
  closeCount = 0;
  loading = false;
  url = "about:blank";
  title = "";
  urls: string[] = [];
  index = -1;
  openHandler: ((details: HandlerDetails) => { action: string }) | undefined;
  navigationHistory = {
    clear: () => {
      this.urls = [this.url];
      this.index = 0;
    },
    canGoBack: () => this.index > 0,
    canGoForward: () => this.index < this.urls.length - 1,
    goBack: () => this.visit(this.urls[--this.index]),
    goForward: () => this.visit(this.urls[++this.index]),
  };
  setWindowOpenHandler(handler: typeof this.openHandler) {
    this.openHandler = handler;
  }
  isDestroyed() {
    return this.destroyed;
  }
  isLoading() {
    return this.loading;
  }
  getURL() {
    return this.url;
  }
  getTitle() {
    return this.title;
  }
  visit(url: string) {
    this.url = url;
    this.emit("did-navigate", {}, url);
    this.emit("did-finish-load");
    this.emit("did-stop-loading");
  }
  async loadURL(url: string) {
    this.loading = true;
    this.emit("did-start-loading");
    this.urls = this.urls.slice(0, this.index + 1);
    this.urls.push(url);
    this.index++;
    this.loading = false;
    this.visit(url);
  }
  stop() {
    this.loading = false;
    this.emit("did-stop-loading");
  }
  reload() {
    this.visit(this.url);
  }
  reloadIgnoringCache() {
    this.reload();
  }
  setAudioMuted(_muted: boolean) {}
  focus() {}
  close() {
    this.destroyed = true;
    this.closeCount++;
    this.emit("destroyed");
  }
}
class FakeView {
  webContents = new FakeContents();
  bounds: ViewBounds | null = null;
  visible = false;
  setBounds(bounds: ViewBounds) {
    this.bounds = bounds;
  }
  setVisible(value: boolean) {
    this.visible = value;
  }
}
vi.mock("electron", () => ({
  WebContentsView: class {
    webContents = new FakeContents();
    bounds: ViewBounds | null = null;
    visible = false;
    setBounds(bounds: ViewBounds) {
      this.bounds = bounds;
    }
    setVisible(value: boolean) {
      this.visible = value;
    }
  },
}));
const { TabManager } = await import("../electron/browser/tab-manager");
class FakeWindow extends EventEmitter {
  children = new Set<unknown>();
  size = { width: 1000, height: 700 };
  messages: unknown[] = [];
  contentView = {
    addChildView: (view: unknown) => {
      if (this.children.has(view)) throw new Error("Duplicate attachment");
      this.children.add(view);
    },
    removeChildView: (view: unknown) => {
      if (!this.children.delete(view)) throw new Error("Detached twice");
    },
  };
  webContents = {
    isDestroyed: () => false,
    send: (_channel: string, value: unknown) => this.messages.push(value),
    focus: () => {},
  };
  isDestroyed() {
    return false;
  }
  getContentBounds() {
    return this.size;
  }
}
let win: FakeWindow, manager: InstanceType<typeof TabManager>;
const view = (id: string) => manager.getTab(id)!.view as unknown as FakeView;
const show = (id: string, visible = true) =>
  manager.updateWorkspace({
    tabId: id,
    visible,
    bounds: { x: 0, y: 110, width: 1000, height: 500 },
  });
beforeEach(() => {
  win = new FakeWindow();
  manager = new TabManager(win as unknown as BrowserWindow, {
    session: {} as Session,
    settings: () => structuredClone(DEFAULT_SETTINGS),
    onNavigate: () => {},
    onError: (message) => {
      throw new Error(message);
    },
    onExternal: async () => {},
    onPopupBlocked: () => {},
    onShortcut: () => {},
  });
});
describe("native-view ownership and tab state (behavioral harness, not a GUI)", () => {
  it("attaches only the active external tab after validated geometry and rejects stale layouts", () => {
    const a = manager.createTab("https://example.com"),
      b = manager.createTab("https://example.org");
    expect(win.children.size).toBe(0);
    expect(show(a.id)).toBe(false);
    expect(show(b.id)).toBe(true);
    expect(win.children.has(view(b.id))).toBe(true);
    expect(win.children.has(view(a.id))).toBe(false);
    manager.switchTab(a.id);
    expect(win.children.size).toBe(0);
    show(a.id);
    expect(win.children.size).toBe(1);
    expect(view(a.id).bounds).toEqual({
      x: 0,
      y: 110,
      width: 1000,
      height: 500,
    });
    show(a.id, false);
    expect(win.children.size).toBe(0);
    expect(view(a.id).visible).toBe(false);
  });
  it("handles independent navigation, history direction, stop, internal pages and reload", () => {
    const a = manager.createTab("https://example.com"),
      b = manager.createTab("https://example.org");
    manager.navigate(a.id, "https://example.com/next");
    expect(manager.getTab(a.id)?.info.canGoBack).toBe(true);
    manager.goBack(a.id);
    expect(manager.getTab(a.id)?.info.url).toBe("https://example.com/");
    expect(manager.getTab(b.id)?.info.url).toBe("https://example.org/");
    manager.goForward(a.id);
    expect(manager.getTab(a.id)?.info.url).toBe("https://example.com/next");
    view(a.id).webContents.loading = true;
    view(a.id).webContents.emit("did-start-loading");
    expect(manager.getTab(a.id)?.info.isLoading).toBe(true);
    manager.stopLoading(a.id);
    expect(manager.getTab(a.id)?.info.isLoading).toBe(false);
    manager.switchTab(a.id);
    show(a.id);
    manager.navigate(a.id, "lunar://settings");
    expect(win.children.size).toBe(0);
    expect(manager.getTab(a.id)?.info.title).toBe("Preferences");
    expect(manager.getTab(a.id)?.info.canGoBack).toBe(true);
    manager.goBack(a.id);
    expect(manager.getTab(a.id)?.info.url).toBe("https://example.com/next");
    manager.goForward(a.id);
    expect(manager.getTab(a.id)?.info.url).toBe("lunar://settings");
    expect(() => manager.navigate(a.id, "file:///etc/passwd")).toThrow();
  });
  it("closes native resources, selects an adjacent tab, creates one blank after the last close, and disposes without replacement", () => {
    const a = manager.createTab(),
      b = manager.createTab("https://example.org"),
      c = manager.createTab("https://example.net");
    const bv = view(b.id);
    manager.switchTab(b.id);
    show(b.id);
    manager.closeTab(b.id);
    expect(bv.webContents.destroyed).toBe(true);
    expect(bv.webContents.closeCount).toBe(1);
    expect(manager.snapshot().activeTabId).toBe(c.id);
    manager.closeTab(c.id);
    expect(manager.snapshot().activeTabId).toBe(a.id);
    manager.closeTab(a.id);
    expect(manager.getAllTabs()).toHaveLength(1);
    expect(manager.getAllTabs()[0].url).toBe("lunar://newtab");
    const last = view(manager.getAllTabs()[0].id);
    manager.dispose();
    expect(last.webContents.destroyed).toBe(true);
    expect(manager.getAllTabs()).toEqual([]);
    expect(win.children.size).toBe(0);
    expect(win.listenerCount("resize")).toBe(0);
  });
  it("recovers from destroyed contents and does not lose tabs on malformed reorder", () => {
    const a = manager.createTab(),
      b = manager.createTab();
    expect(() => manager.reorderTabs([a.id])).toThrow();
    expect(manager.getAllTabs()).toHaveLength(2);
    manager.reorderTabs([b.id, a.id]);
    expect(manager.getAllTabs().map((tab) => tab.id)).toEqual([b.id, a.id]);
    view(b.id).webContents.close();
    expect(manager.getTab(b.id)).toBeNull();
    expect(manager.getAllTabs()).toHaveLength(1);
    expect(() => manager.closeTab("invalid-id")).toThrow();
  });
  it("clamps to the native content size on resize and does not double-attach on repeated layout", () => {
    const a = manager.createTab("https://example.com");
    show(a.id);
    show(a.id);
    expect(win.children.size).toBe(1);
    win.size = { width: 800, height: 500 };
    win.emit("resize");
    expect(view(a.id).bounds).toEqual({
      x: 0,
      y: 110,
      width: 800,
      height: 390,
    });
  });
  it("handles native-focused keyboard shortcuts, not just renderer DOM keydown", () => {
    const input = (
      key: string,
      shift = false,
    ): Pick<Input, "type" | "key" | "control" | "meta" | "shift" | "alt"> => ({
      type: "keyDown",
      key,
      control: true,
      meta: false,
      alt: false,
      shift,
    });
    manager.createTab();
    expect(manager.handleShortcut(input("t"))).toBe(true);
    expect(manager.getAllTabs()).toHaveLength(2);
    const first = manager.getAllTabs()[0];
    manager.handleShortcut(input("1"));
    expect(manager.snapshot().activeTabId).toBe(first.id);
    manager.handleShortcut(input("w"));
    expect(manager.getAllTabs()).toHaveLength(1);
  });
});
