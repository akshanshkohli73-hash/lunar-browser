// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
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
    warnings: [],
  }));
  const noEvents = () => () => {};
  const supported: Partial<LunarAPI> = {
    bootstrap,
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
