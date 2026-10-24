// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { LunarAPI } from "../shared/api";
import type { TabInfo, TabsSnapshot } from "../electron/types";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { BrowserProvider, useBrowser } from "../src/state/BrowserContext";
import { CONTROL_PANELS } from "../src/state/control-center";
import LunarDesktop from "../src/components/LunarDesktop";
import { MENU_NAMES } from "../src/components/DesktopMenuBar";
const emptyEvents = () => () => {};
let mounts = 0;
function Workspace({
  isVisible,
  isOccluded,
}: {
  isVisible?: boolean;
  isOccluded?: boolean;
}) {
  const { tabs, previewPage } = useBrowser();
  React.useEffect(() => {
    mounts++;
  }, []);
  return (
    <main
      data-testid="workspace"
      data-visible={String(isVisible)}
      data-occluded={String(isOccluded)}
    >
      <output>
        {window.lunarAPI
          ? tabs.tabs.find((t) => t.id === tabs.activeTabId)?.url
          : `lunar://${previewPage}`}
      </output>
      <input aria-label="Editing target" defaultValue="selected text" />
    </main>
  );
}
function shell() {
  return render(
    <BrowserProvider>
      <LunarDesktop browserComponent={Workspace} />
    </BrowserProvider>,
  );
}
const dock = () => within(screen.getByRole("navigation", { name: "Dock" }));
const openMenu = async (name: string) => {
  fireEvent.click(screen.getByRole("menuitem", { name }));
  return within(await screen.findByRole("menu", { name: `${name} menu` }));
};
function nativeFixture() {
  const tab: TabInfo = {
    id: "site",
    url: "https://example.org/article",
    title: "Example",
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    isMuted: false,
    isPinned: false,
    audible: false,
  };
  let state: TabsSnapshot = { revision: 1, tabs: [tab], activeTabId: tab.id },
    counter = 0;
  const listeners = new Set<(state: TabsSnapshot) => void>();
  const publish = () => {
    state = { ...state, revision: state.revision + 1 };
    listeners.forEach((fn) => fn(structuredClone(state)));
  };
  const shield = {
    settings: DEFAULT_SETTINGS.shield,
    lists: [],
    stats: {
      adsBlocked: 0,
      totalBlocked: 0,
      trackersBlocked: 0,
      telemetryBlocked: 0,
      cryptominersBlocked: 0,
      socialBlocked: 0,
      popupsBlocked: 0,
    },
  };
  const methods = {
    bootstrap: vi.fn<LunarAPI["bootstrap"]>(async () => ({
      settings: { ...DEFAULT_SETTINGS, isFirstRun: false },
      dashboard: DEFAULT_DASHBOARD,
      tabs: state,
      bookmarks: [
        {
          id: "bookmark",
          title: "Saved fixture",
          url: "https://saved.example.org",
          folder: "",
          createdAt: 0,
        },
      ],
      downloads: [],
      extensions: [],
      shield,
      warnings: [],
    })),
    onTabsUpdated: (listener: (state: TabsSnapshot) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onSettingsUpdated: emptyEvents,
    onDashboardUpdated: emptyEvents,
    onBookmarksUpdated: emptyEvents,
    onShieldUpdated: emptyEvents,
    onError: emptyEvents,
    createTab: vi.fn<LunarAPI["createTab"]>(async (url = "lunar://newtab") => {
      const item = { ...tab, id: `panel-${++counter}`, url };
      state = { ...state, tabs: [...state.tabs, item], activeTabId: item.id };
      publish();
      return item;
    }),
    navigateTab: vi.fn<LunarAPI["navigateTab"]>(async (id, url) => {
      state = {
        ...state,
        tabs: state.tabs.map((t) => (t.id === id ? { ...t, url } : t)),
      };
      publish();
    }),
    switchTab: vi.fn<LunarAPI["switchTab"]>(async (id) => {
      state = { ...state, activeTabId: id };
      publish();
    }),
    closeTab: vi.fn<LunarAPI["closeTab"]>().mockResolvedValue(),
    duplicateTab: vi.fn<LunarAPI["duplicateTab"]>(async () => ({
      ...tab,
      id: "duplicate",
    })),
    reloadTab: vi.fn<LunarAPI["reloadTab"]>().mockResolvedValue(),
    browserCommand: vi.fn<LunarAPI["browserCommand"]>().mockResolvedValue(),
    getHistory: vi.fn<LunarAPI["getHistory"]>(async () => [
      {
        id: "visit",
        title: "Recent fixture",
        url: "https://recent.example.org/",
        visitTime: 1,
      },
    ]),
    minimize: vi.fn<LunarAPI["minimize"]>().mockResolvedValue(),
    maximize: vi.fn<LunarAPI["maximize"]>().mockResolvedValue(),
    close: vi.fn<LunarAPI["close"]>().mockResolvedValue(),
  } satisfies Partial<LunarAPI>;
  window.lunarAPI = new Proxy(methods as Partial<LunarAPI>, {
    get(target, key) {
      if (Reflect.has(target, key)) return Reflect.get(target, key);
      throw new Error(`Unexpected bridge operation: ${String(key)}`);
    },
  }) as LunarAPI;
  return methods;
}
beforeEach(() => {
  mounts = 0;
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  delete window.lunarAPI;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("one Lunar control registry in the retained Coquette frame", () => {
  it("routes every dock and desktop shortcut with unique SVG entries and never remounts the workspace", async () => {
    shell();
    expect(
      dock()
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(CONTROL_PANELS.map((p) => p.label));
    for (const panel of CONTROL_PANELS) {
      expect(
        dock().getByRole("button", { name: panel.label }).querySelector("svg"),
      ).not.toBeNull();
      fireEvent.click(dock().getByRole("button", { name: panel.label }));
      await screen.findByText(`lunar://${panel.page}`);
      expect(
        dock()
          .getByRole("button", { name: panel.label })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Show desktop" }));
      expect(
        screen.getByTestId("workspace").closest("[hidden]"),
      ).not.toBeNull();
      fireEvent.click(
        screen.getByRole("button", {
          name: `Open ${panel.label}`,
        }),
      );
      await waitFor(() =>
        expect(screen.getByTestId("workspace").closest("[hidden]")).toBeNull(),
      );
    }
    expect(mounts).toBe(1);
    expect(screen.getAllByTestId("workspace")).toHaveLength(1);
    for (const old of [
      "Finder",
      "Mail",
      "Music Box",
      "Gallery",
      "Skills",
      "Trash",
      "About Me",
      "Messages",
      "Now",
      "Launchpad",
    ]) {
      expect(dock().queryByRole("button", { name: old })).toBeNull();
    }
  });
  it("uses the same nine controls in the searchable launcher", async () => {
    shell();
    const lunar = await openMenu("Lunar");
    fireEvent.click(lunar.getByRole("menuitem", { name: "Lunar controls" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Lunar controls" }),
    );
    expect(dialog.getAllByRole("button").length).toBe(10);
    fireEvent.change(
      dialog.getByRole("textbox", { name: "Find a Lunar control" }),
      { target: { value: "downloads" } },
    );
    fireEvent.keyDown(
      dialog.getByRole("textbox", { name: "Find a Lunar control" }),
      { key: "Enter" },
    );
    await screen.findByText("lunar://downloads");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("supports keyboard menu traversal, Escape and native-view occlusion while menus are open", async () => {
    shell();
    expect(
      within(screen.getByRole("menubar"))
        .getAllByRole("menuitem")
        .map((b) => b.textContent),
    ).toEqual([...MENU_NAMES]);
    const lunar = screen.getByRole("menuitem", { name: "Lunar" });
    lunar.focus();
    fireEvent.keyDown(lunar, { key: "ArrowRight" });
    const file = screen.getByRole("menuitem", { name: "File" });
    expect(document.activeElement).toBe(file);
    fireEvent.keyDown(file, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu", { name: "File menu" });
    expect(screen.getByTestId("workspace").dataset.occluded).toBe("true");
    expect(
      within(menu)
        .getByRole("menuitem", { name: "New window" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(file);
  });
  it("reuses an internal panel tab and preserves the originating website", async () => {
    const api = nativeFixture();
    shell();
    await waitFor(() =>
      expect(
        dock().getByRole("button", { name: "Home" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    for (const panel of CONTROL_PANELS) {
      fireEvent.click(dock().getByRole("button", { name: panel.label }));
      await screen.findByText(`lunar://${panel.page}`);
    }
    expect(api.createTab).toHaveBeenCalledTimes(1);
    fireEvent.click(dock().getByRole("button", { name: "Settings" }));
    await waitFor(() => expect(api.switchTab).toHaveBeenCalledWith("panel-1"));
    expect(
      (await api.bootstrap()).tabs.tabs.find((t) => t.id === "site")?.url,
    ).toBe("https://example.org/article");
    expect(mounts).toBe(1);
  });
});
describe("custom browser menus dispatch actual supported operations", () => {
  const commands = [
    ["File", "New tab", "createTab", []],
    ["File", "Close tab", "closeTab", ["site"]],
    ["File", "Duplicate tab", "duplicateTab", ["site"]],
    ["View", "Reload", "reloadTab", ["site"]],
    ["View", "Reload without cache", "reloadTab", ["site", true]],
    ["View", "Zoom in", "browserCommand", ["zoomIn", "page"]],
    ["View", "Zoom out", "browserCommand", ["zoomOut", "page"]],
    ["View", "Actual size", "browserCommand", ["zoomReset", "page"]],
    ["View", "Toggle fullscreen", "browserCommand", ["fullscreen", "chrome"]],
    ["Edit", "Undo", "browserCommand", ["undo", "page"]],
    ["Edit", "Redo", "browserCommand", ["redo", "page"]],
    ["Edit", "Cut", "browserCommand", ["cut", "page"]],
    ["Edit", "Copy", "browserCommand", ["copy", "page"]],
    ["Edit", "Paste", "browserCommand", ["paste", "page"]],
    ["Edit", "Select all", "browserCommand", ["selectAll", "page"]],
    ["Lunar", "Quit Lunar Browser", "close", []],
  ] as const;
  it.each(commands)(
    "%s → %s invokes its narrow operation",
    async (menuName, label, method, args) => {
      const api = nativeFixture();
      shell();
      await waitFor(() =>
        expect(
          dock().getByRole("button", { name: "Home" }).hasAttribute("disabled"),
        ).toBe(false),
      );
      const menu = await openMenu(menuName);
      fireEvent.click(menu.getByRole("menuitem", { name: label }));
      await waitFor(() => expect(api[method]).toHaveBeenCalledWith(...args));
    },
  );
  it("restores a chrome input's selection before editing, rather than pasting into the webpage", async () => {
    const api = nativeFixture();
    shell();
    await waitFor(() =>
      expect(
        dock().getByRole("button", { name: "Home" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    const input = screen.getByRole("textbox", {
      name: "Editing target",
    }) as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 8);
    const menu = await openMenu("Edit");
    fireEvent.click(menu.getByRole("menuitem", { name: "Paste" }));
    await waitFor(() =>
      expect(api.browserCommand).toHaveBeenCalledWith("paste", "chrome"),
    );
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(8);
  });
  it("opens recorded history and bookmarks, with unsupported library features clearly disabled", async () => {
    const api = nativeFixture();
    shell();
    await waitFor(() =>
      expect(
        dock().getByRole("button", { name: "Home" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    let menu = await openMenu("History");
    fireEvent.click(
      await menu.findByRole("menuitem", {
        name: "Recent fixture",
      }),
    );
    await waitFor(() =>
      expect(api.navigateTab).toHaveBeenCalledWith(
        "site",
        "https://recent.example.org/",
      ),
    );
    menu = await openMenu("Bookmarks");
    expect(
      menu
        .getByRole("menuitem", { name: /Reading list/ })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      menu
        .getByRole("menuitem", { name: /Offline saved pages/ })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(menu.getByRole("menuitem", { name: "Saved fixture" }));
    await waitFor(() =>
      expect(api.navigateTab).toHaveBeenCalledWith(
        "site",
        "https://saved.example.org",
      ),
    );
  });
});
