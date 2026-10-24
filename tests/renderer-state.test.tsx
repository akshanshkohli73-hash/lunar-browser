// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  createEvent,
  within,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LunarAPI } from "../shared/api";
import type {
  BrowserBootstrap,
  BrowserSettings,
  TabsSnapshot,
} from "../electron/types";
import { StorageService } from "../electron/services/storage";
import { BrowserProvider } from "../src/state/BrowserContext";
import ThemeStudio from "../src/components/ThemeStudioView";
import App from "../src/components/App";
import { dashboardSchema } from "../shared/dashboard";
import AISidebar from "../src/components/AISidebar";

let profile: string, storage: StorageService, api: LunarAPI;
let current: TabsSnapshot;
const settingsListeners = new Set<(settings: BrowserSettings) => void>(),
  tabListeners = new Set<(tabs: TabsSnapshot) => void>();
const bootstrap = vi.fn();
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-renderer-"));
  storage = new StorageService(profile);
  storage.updateSettings({ isFirstRun: false });
  current = {
    revision: 1,
    activeTabId: "tab_a",
    tabs: [
      {
        id: "tab_a",
        url: "lunar://newtab",
        title: "New Tab",
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        isMuted: false,
        isPinned: false,
        audible: false,
      },
    ],
  };
  bootstrap.mockReset().mockImplementation(async () => ({
    tabs: current,
    settings: storage.getSettings(),
    bookmarks: storage.getBookmarks(),
    shield: {
      settings: storage.getSettings().shield,
      stats: {
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        telemetryBlocked: 0,
        socialBlocked: 0,
        cryptominersBlocked: 0,
        popupsBlocked: 0,
      },
      lists: [],
    },
    dashboard: storage.getDashboard(),
    warnings: [],
  }));
  const noEvents = () => () => {};
  const supported: Partial<LunarAPI> = {
    bootstrap,
    chooseWallpaper: vi.fn(async () => null),
    pruneWallpapers: vi.fn(async () => 0),
    getWeather: vi.fn(async () => ({
      temperature: 22,
      code: 1,
      units: "celsius" as const,
      observedAt: "2026-10-17T10:00",
    })),
    navigateTab: vi.fn(async () => {}),
    getSitePrivacy: vi.fn(async (url: string) => ({
      origin: new URL(url).origin,
      cookies: 2,
      grants: [],
      denials: [],
    })),
    clearOriginData: vi.fn(async () => {}),
    resetSitePermissions: vi.fn(async () => {}),
    denySitePermission: vi.fn(async () => {}),
    updateSettings: async (patch) => {
      const saved = storage.updateSettings(patch);
      settingsListeners.forEach((listener) => listener(saved));
      return saved;
    },
    onTabsUpdated: (listener) => {
      tabListeners.add(listener);
      return () => {
        tabListeners.delete(listener);
      };
    },
    onSettingsUpdated: (listener) => {
      settingsListeners.add(listener);
      return () => {
        settingsListeners.delete(listener);
      };
    },
    onBookmarksUpdated: noEvents,
    onShieldUpdated: noEvents,
    onDashboardUpdated: noEvents,
    updateDashboard: async (patch) => storage.updateDashboard(patch),
    onError: noEvents,
    onShortcut: noEvents,
    updateWorkspace: async () => true,
  };
  // Fail loudly for unexpected bridge operations; this fake only tests renderer/service wiring.
  api = new Proxy(supported, {
    get(target, property) {
      if (Reflect.has(target, property)) return Reflect.get(target, property);
      throw new Error(`Unexpected test bridge operation: ${String(property)}`);
    },
  }) as LunarAPI;
  window.lunarAPI = api;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  settingsListeners.clear();
  tabListeners.clear();
  delete window.lunarAPI;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("renderer connected to the real validated profile service", () => {
  it("blocks profile writes until saved preferences have finished loading", async () => {
    storage.updateSettings({ themeId: "pastel-forest" });
    let finish: (state: BrowserBootstrap) => void = () => {
      throw new Error("Bootstrap was not requested");
    };
    bootstrap.mockImplementation(
      () =>
        new Promise<BrowserBootstrap>((resolve) => {
          finish = resolve;
        }),
    );
    const update = vi.spyOn(storage, "updateSettings");
    render(
      <BrowserProvider>
        <ThemeStudio />
      </BrowserProvider>,
    );
    const preset = screen.getByRole("button", { name: /^Lunar Dark/ });
    expect(preset.hasAttribute("disabled")).toBe(true);
    fireEvent.click(preset);
    expect(update).not.toHaveBeenCalled();
    expect(storage.getSettings().themeId).toBe("pastel-forest");
    await act(async () =>
      finish({
        tabs: current,
        settings: storage.getSettings(),
        bookmarks: storage.getBookmarks(),
        shield: {
          settings: storage.getSettings().shield,
          stats: {
            totalBlocked: 0,
            adsBlocked: 0,
            trackersBlocked: 0,
            telemetryBlocked: 0,
            socialBlocked: 0,
            cryptominersBlocked: 0,
            popupsBlocked: 0,
          },
          lists: [],
        },
        dashboard: storage.getDashboard(),
        warnings: [],
      }),
    );
    expect(preset.hasAttribute("disabled")).toBe(false);
    expect(storage.getSettings().themeId).toBe("pastel-forest");
    fireEvent.click(preset);
    await waitFor(() =>
      expect(storage.getSettings().themeId).toBe("lunar-dark"),
    );
  });
  it("applies one shared preset and persists customized tokens instead of just changing decorative state", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <ThemeStudio />
      </BrowserProvider>,
    );
    await user.click(screen.getByRole("button", { name: /^Pastel Forest/ }));
    await waitFor(() =>
      expect(storage.getSettings().themeId).toBe("pastel-forest"),
    );
    expect(
      document.documentElement.style.getPropertyValue("--color-background"),
    ).toBe("#f2f7f4");
    await user.click(screen.getByRole("button", { name: "Your own touch" }));
    fireEvent.change(screen.getByLabelText("primary color"), {
      target: { value: "#123456" },
    });
    await user.selectOptions(
      screen.getByLabelText("Toolbar spacing"),
      "compact",
    );
    await user.click(
      screen.getByRole("button", { name: "Apply customization" }),
    );
    await waitFor(() =>
      expect(storage.getSettings().customTheme?.colors.primary).toBe("#123456"),
    );
    expect(
      new StorageService(profile).getSettings().customTheme?.layout.density,
    ).toBe("compact");
    expect(
      document.documentElement.style.getPropertyValue("--lunar-toolbar-height"),
    ).toBe("36px");
    expect(
      screen.getByRole("status", { name: "Theme save status" }).textContent,
    ).toContain("saved");
  });
  it("reports failed writes without switching the applied theme or displaying success", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <ThemeStudio />
      </BrowserProvider>,
    );
    vi.spyOn(storage, "updateSettings").mockImplementation(() => {
      throw new Error("Disk is full");
    });
    await user.click(screen.getByRole("button", { name: /^Lunar Dark/ }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Disk is full",
    );
    expect(storage.getSettings().themeId).toBe("lunar-coquette");
    expect(
      screen.queryByRole("status", { name: "Theme save status" }),
    ).toBeNull();
  });
  it("keeps a focused address draft across native events without re-subscribing or replaying startup", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "New tab" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    const address = screen.getByRole("textbox", { name: "Address and search" });
    await user.click(address);
    await user.type(address, "my unfinished search");
    act(() => {
      current = {
        ...current,
        revision: 2,
        tabs: [
          {
            ...current.tabs[0],
            url: "https://example.com",
            title: "Redirected title",
          },
        ],
      };
      tabListeners.forEach((listener) => listener(current));
    });
    expect((address as HTMLInputElement).value).toBe("my unfinished search");
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(tabListeners.size).toBe(1);
  });
  it("saves the chosen onboarding search engine before dismissing the first-run dialog", async () => {
    storage.updateSettings({ isFirstRun: true });
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    const search = await screen.findByLabelText("Search engine");
    await user.selectOptions(search, "duckduckgo");
    await user.click(screen.getByRole("button", { name: "Start exploring" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Welcome to Lunar" }),
      ).toBeNull(),
    );
    expect(new StorageService(profile).getSettings()).toMatchObject({
      searchEngine: "duckduckgo",
      isFirstRun: false,
    });
  });
  it("requires a fresh page-context consent for each AI message", async () => {
    storage.updateSettings({ aiEnabled: true });
    const ask = vi.fn<LunarAPI["askAI"]>(
      async () => "A real-adapter-shaped reply",
    );
    // This test's only provider stub verifies the actual sidebar request and consent reset.
    const wrapped = new Proxy(api, {
      get(target, property) {
        return property === "askAI" ? ask : Reflect.get(target, property);
      },
    });
    window.lunarAPI = wrapped;
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <AISidebar
          onClose={() => {}}
          activeTabId="tab_a"
          url="https://example.com/article"
        />
      </BrowserProvider>,
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Summarize" }));
    await screen.findByText("A real-adapter-shaped reply");
    expect(ask.mock.calls[0][0]).toMatchObject({
      tabId: "tab_a",
      sharePageContext: true,
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    expect(
      screen
        .getByRole("button", { name: "Summarize" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("persistent dashboard UI and appearance preview", () => {
  it("previews wallpaper and dock without writing; cancel restores both, and Apply keeps separately edited notes", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Customize dashboard" }),
    );
    const editor = await screen.findByRole("dialog", {
      name: "Customize dashboard",
    });
    await user.click(
      await within(editor).findByRole("button", { name: "Rose stationery" }),
    );
    await user.selectOptions(
      within(editor).getByLabelText("Dock size"),
      "compact",
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.dockSize).toBe("compact"),
    );
    expect(storage.getDashboard().dock.size).toBe("comfortable");
    expect(storage.getDashboard().wallpaper.builtin).toBe("meadow");
    expect(
      screen
        .getByRole("region", { name: "New tab dashboard" })
        .getAttribute("data-wallpaper-preset"),
    ).toBe("rose");
    await user.click(
      within(editor).getByRole("button", { name: "Cancel dashboard changes" }),
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.dockSize).toBe("comfortable"),
    );
    expect(
      screen.queryByRole("dialog", { name: "Customize dashboard" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Customize dashboard" }),
    );
    const next = await screen.findByRole("dialog", {
      name: "Customize dashboard",
    });
    await user.click(
      await within(next).findByRole("button", { name: "Rose stationery" }),
    );
    await user.selectOptions(
      within(next).getByLabelText("Dock size"),
      "compact",
    );
    storage.updateDashboard({
      note: "Independent note; do not overwrite on layout save",
    });
    await user.click(
      within(next).getByRole("button", { name: "Apply dashboard" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Customize dashboard" }),
      ).toBeNull(),
    );
    expect(new StorageService(profile).getDashboard()).toMatchObject({
      wallpaper: { builtin: "rose" },
      dock: { size: "compact" },
      note: "Independent note; do not overwrite on layout save",
    });
  });
  it("adds/configures/hides/removes/resizes real registry widgets and never requests weather without an Update click", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Customize dashboard" }),
    );
    const editor = await screen.findByRole("dialog", {
      name: "Customize dashboard",
    });
    await user.click(
      await within(editor).findByRole("button", { name: "Add widget" }),
    );
    await user.type(
      within(editor).getByLabelText("Location label"),
      "Test city",
    );
    await user.clear(within(editor).getByLabelText("Latitude"));
    await user.type(within(editor).getByLabelText("Latitude"), "28");
    await user.click(
      within(editor).getByRole("checkbox", {
        name: /Allow sending these coordinates/,
      }),
    );
    expect(api.getWeather).not.toHaveBeenCalled();
    await user.click(within(editor).getByRole("button", { name: "Notes" }));
    await user.click(
      within(editor).getByRole("button", { name: "Resize widget" }),
    );
    await user.click(within(editor).getByRole("checkbox", { name: "Visible" }));
    await user.selectOptions(
      within(editor).getByRole("combobox", { name: "Widget to add" }),
      "focus",
    );
    await user.click(
      within(editor).getByRole("button", { name: "Add widget" }),
    );
    await user.click(
      within(editor).getByRole("button", { name: "Remove widget" }),
    );
    await user.click(
      within(editor).getByRole("button", { name: "Apply dashboard" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Customize dashboard" }),
      ).toBeNull(),
    );
    const saved = new StorageService(profile).getDashboard();
    expect(dashboardSchema.safeParse(saved).success).toBe(true);
    expect(
      saved.widgets.find((widget) => widget.kind === "notes"),
    ).toMatchObject({ w: 6, h: 5, visible: false });
    expect(
      saved.widgets.find((widget) => widget.kind === "focus"),
    ).toBeUndefined();
    expect(api.getWeather).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Update weather" }));
    expect(api.getWeather).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 28, consent: true }),
    );
    expect((await screen.findByText("22°C")).textContent).toBe("22°C");
  });
  it("moves with real keyboard controls and drag/drop, cancels drafts, and persists only a successful Save layout", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Arrange widgets" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    const clock = storage
      .getDashboard()
      .widgets.find((widget) => widget.kind === "clock")!;
    await user.click(screen.getByRole("button", { name: "Arrange widgets" }));
    await user.click(
      screen.getByRole("button", { name: "Move Clock & date down" }),
    );
    expect(
      screen
        .getByRole("article", { name: "Clock & date widget" })
        .style.getPropertyValue("--cell-y"),
    ).toBe("2");
    expect(
      storage.getDashboard().widgets.find((widget) => widget.id === clock.id)
        ?.y,
    ).toBe(0);
    await user.click(
      screen.getByRole("button", { name: "Cancel arrangement" }),
    );
    expect(
      screen
        .getByRole("article", { name: "Clock & date widget" })
        .style.getPropertyValue("--cell-y"),
    ).toBe("1");
    await user.click(screen.getByRole("button", { name: "Arrange widgets" }));
    const grid = screen
      .getByRole("region", { name: "New tab dashboard" })
      .querySelector<HTMLElement>(".dashboard-grid")!;
    vi.spyOn(grid, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON: () => ({}),
    });
    const drop = createEvent.drop(grid, {
      dataTransfer: { getData: () => clock.id },
    });
    Object.defineProperties(drop, {
      clientX: { value: 300 },
      clientY: { value: 264 },
    });
    fireEvent(grid, drop);
    expect(
      screen
        .getByRole("article", { name: "Clock & date widget" })
        .style.getPropertyValue("--cell-y"),
    ).toBe("5");
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Arrange widgets" }),
      ).toBeDefined(),
    );
    const saved = new StorageService(profile).getDashboard();
    expect(
      saved.widgets.find((widget) => widget.id === clock.id),
    ).toMatchObject({ x: 3, y: 4 });
    expect(dashboardSchema.safeParse(saved).success).toBe(true);
  });
  it("reports dashboard save failures, keeps the editor/draft open, and does not claim success or alter saved layout", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <App />
      </BrowserProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Customize dashboard" }),
    );
    const editor = await screen.findByRole("dialog", {
      name: "Customize dashboard",
    });
    await user.click(
      await within(editor).findByRole("button", { name: "Midnight garden" }),
    );
    vi.spyOn(storage, "updateDashboard").mockImplementation(() => {
      throw new Error("Disk is full");
    });
    await user.click(
      within(editor).getByRole("button", { name: "Apply dashboard" }),
    );
    expect((await within(editor).findByRole("alert")).textContent).toContain(
      "Disk is full",
    );
    expect(storage.getDashboard().wallpaper.builtin).toBe("meadow");
    expect(
      screen.getByRole("dialog", { name: "Customize dashboard" }),
    ).toBeDefined();
    expect(
      within(editor).queryByText("Dashboard saved to this profile."),
    ).toBeNull();
  });
  it("previews theme and motion across the shell, cancels without writes and persists both only on Apply", async () => {
    const user = userEvent.setup();
    render(
      <BrowserProvider>
        <ThemeStudio />
      </BrowserProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Your own touch" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Apply customization" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    const original =
      document.documentElement.style.getPropertyValue("--lunar-primary");
    fireEvent.change(screen.getByLabelText("primary color"), {
      target: { value: "#123456" },
    });
    await user.click(screen.getByRole("checkbox", { name: "Reduced motion" }));
    expect(
      document.documentElement.style.getPropertyValue("--lunar-primary"),
    ).toBe("#123456");
    expect(document.documentElement.dataset.reducedMotion).toBe("true");
    expect(storage.getSettings().reducedMotion).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Cancel appearance preview" }),
    );
    expect(
      document.documentElement.style.getPropertyValue("--lunar-primary"),
    ).toBe(original);
    expect(document.documentElement.dataset.reducedMotion).toBe("false");
    await user.click(
      screen.getByRole("checkbox", { name: "Live preview across the desktop" }),
    );
    fireEvent.change(screen.getByLabelText("primary color"), {
      target: { value: "#234567" },
    });
    await user.click(screen.getByRole("checkbox", { name: "Reduced motion" }));
    await user.click(
      screen.getByRole("button", { name: "Apply customization" }),
    );
    await waitFor(() =>
      expect(new StorageService(profile).getSettings()).toMatchObject({
        reducedMotion: true,
        customTheme: { colors: { primary: "#234567" } },
      }),
    );
  });
});
