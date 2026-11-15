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
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { LunarAPI } from "../shared/api";
import type { Bookmark, BrowserSettings } from "../shared/schemas";
import { DEFAULT_DASHBOARD, type DashboardSettings } from "../shared/dashboard";
import type {
  BrowserBootstrap,
  ShieldState,
  TabsSnapshot,
} from "../electron/types";
import { StorageService } from "../electron/services/storage";
import { BrowserProvider, useBrowser } from "../src/state/BrowserContext";
import { useWorkspaceActivity } from "../src/state/WorkspaceActivity";
import { WIDGET_COMPONENTS } from "../src/components/dashboard/Widgets";

function events<T>() {
  const listeners = new Set<(state: T) => void>();
  return {
    subscribe(listener: (state: T) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(state: T) {
      listeners.forEach((listener) => listener(state));
    },
  };
}
function deferred<T>() {
  let resolve!: (state: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let profile: string, storage: StorageService, api: LunarAPI;
let settingsEvents: ReturnType<typeof events<BrowserSettings>>,
  dashboardEvents: ReturnType<typeof events<DashboardSettings>>,
  bookmarkEvents: ReturnType<typeof events<Bookmark[]>>,
  shieldEvents: ReturnType<typeof events<ShieldState>>,
  tabEvents: ReturnType<typeof events<TabsSnapshot>>,
  activityEvents: ReturnType<typeof events<boolean>>;
function snapshot(): BrowserBootstrap {
  return {
    tabs: { tabs: [], activeTabId: null, revision: 1 },
    settings: storage.getSettings(),
    dashboard: storage.getDashboard(),
    bookmarks: storage.getBookmarks(),
    shield: {
      settings: storage.getSettings().shield,
      stats: {
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        telemetryBlocked: 0,
        cryptominersBlocked: 0,
        socialBlocked: 0,
        popupsBlocked: 0,
      },
      lists: [],
    },
    warnings: [],
  };
}
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-consistency-"));
  storage = new StorageService(profile);
  settingsEvents = events<BrowserSettings>();
  dashboardEvents = events<DashboardSettings>();
  bookmarkEvents = events<Bookmark[]>();
  shieldEvents = events<ShieldState>();
  tabEvents = events<TabsSnapshot>();
  activityEvents = events<boolean>();
  const supported: Partial<LunarAPI> = {
    bootstrap: vi.fn(async () => snapshot()),
    onSettingsUpdated: settingsEvents.subscribe,
    onDashboardUpdated: dashboardEvents.subscribe,
    onBookmarksUpdated: bookmarkEvents.subscribe,
    onShieldUpdated: shieldEvents.subscribe,
    onTabsUpdated: tabEvents.subscribe,
    onError: () => () => {},
    onWindowActivity: activityEvents.subscribe,
    getWindowActivity: vi.fn(async () => true),
    updateSettings: vi.fn(async (patch) => {
      const saved = storage.updateSettings(patch);
      settingsEvents.emit(saved);
      return saved;
    }),
    updateDashboard: vi.fn(async (patch) => {
      const saved = storage.updateDashboard(patch);
      dashboardEvents.emit(saved);
      return saved;
    }),
  };
  // This is the real profile service behind a controllable asynchronous bridge,
  // not a second implementation of renderer save/synchronization behavior.
  api = new Proxy(supported, {
    get(target, property) {
      if (Reflect.has(target, property)) return Reflect.get(target, property);
      throw new Error(`Unexpected test bridge operation: ${String(property)}`);
    },
  }) as LunarAPI;
  window.lunarAPI = api;
});
afterEach(() => {
  cleanup();
  delete window.lunarAPI;
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});

const NotesWidget = WIDGET_COMPONENTS.notes;
function renderNote() {
  const widget = DEFAULT_DASHBOARD.widgets.find(
    (item) => item.kind === "notes",
  )!;
  render(
    <BrowserProvider>
      <NotesWidget widget={widget} active navigate={() => {}} />
    </BrowserProvider>,
  );
  return {
    field: screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Dashboard note",
    }),
    save: screen.getByRole<HTMLButtonElement>("button", { name: "Save note" }),
  };
}

describe("dashboard note drafts during delayed profile saves", () => {
  it.each(["A newer unfinished draft", ""])(
    "keeps later typing (%j) through both the save broadcast and its delayed acknowledgement",
    async (laterDraft) => {
      const pending = deferred<DashboardSettings>();
      let submitted!: DashboardSettings;
      vi.mocked(api.updateDashboard).mockImplementationOnce((patch) => {
        submitted = storage.updateDashboard(patch);
        return pending.promise;
      });
      const { field, save } = renderNote();
      fireEvent.change(field, { target: { value: "First submitted draft" } });
      await waitFor(() => expect(save.disabled).toBe(false));
      fireEvent.click(save);
      expect(save.disabled).toBe(true);
      fireEvent.change(field, { target: { value: laterDraft } });
      act(() => dashboardEvents.emit(submitted));
      expect(field.value).toBe(laterDraft);
      await act(async () => pending.resolve(submitted));
      expect(field.value).toBe(laterDraft);
      expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
      expect(save.disabled).toBe(false);
      expect(new StorageService(profile).getDashboard().note).toBe(
        "First submitted draft",
      );
      fireEvent.click(save);
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe("Saved locally"),
      );
      expect(save.disabled).toBe(true);
      expect(new StorageService(profile).getDashboard().note).toBe(laterDraft);
    },
  );

  it("accepts external changes when pristine, but never discards an unsaved local draft", async () => {
    const { field, save } = renderNote();
    await act(async () => {});
    act(() =>
      dashboardEvents.emit(
        storage.updateDashboard({ note: "Saved elsewhere" }),
      ),
    );
    expect(field.value).toBe("Saved elsewhere");
    fireEvent.change(field, { target: { value: "Local unsaved draft" } });
    act(() =>
      dashboardEvents.emit(
        storage.updateDashboard({ note: "Another saved version" }),
      ),
    );
    expect(field.value).toBe("Local unsaved draft");
    expect(save.disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
  });

  it("retains edits and reports a failed save, then lets the user retry the current text", async () => {
    const pending = deferred<DashboardSettings>();
    vi.mocked(api.updateDashboard).mockReturnValueOnce(pending.promise);
    const { field, save } = renderNote();
    fireEvent.change(field, { target: { value: "First draft" } });
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    fireEvent.change(field, { target: { value: "Text typed while saving" } });
    await act(async () => pending.reject(new Error("Disk full")));
    expect(field.value).toBe("Text typed while saving");
    expect(screen.getByRole("status").textContent).toBe("Disk full");
    expect(storage.getDashboard().note).toBe("");
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Saved locally"),
    );
    expect(new StorageService(profile).getDashboard().note).toBe(
      "Text typed while saving",
    );
  });
});

describe("renderer snapshot ordering", () => {
  it("does not let a delayed bootstrap overwrite newer subscription state in any domain", async () => {
    const older = snapshot(),
      pending = deferred<BrowserBootstrap>();
    vi.mocked(api.bootstrap).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    const settings = storage.updateSettings({ themeId: "pastel-forest" });
    const dashboard = storage.updateDashboard({ note: "Newer saved note" });
    storage.addBookmark({
      title: "Newer bookmark",
      url: "https://example.com",
    });
    const bookmarks = storage.getBookmarks();
    const shield = {
      ...older.shield,
      stats: { ...older.shield.stats, totalBlocked: 1 },
    };
    const tabs = { ...older.tabs, revision: 2 };
    act(() => {
      settingsEvents.emit(settings);
      dashboardEvents.emit(dashboard);
      bookmarkEvents.emit(bookmarks);
      shieldEvents.emit(shield);
      tabEvents.emit(tabs);
    });
    await act(async () => pending.resolve(older));
    expect(result.current.ready).toBe(true);
    expect(result.current.tabs).toEqual(tabs);
    expect(result.current.settings).toEqual(settings);
    expect(result.current.dashboard).toEqual(dashboard);
    expect(result.current.bookmarks).toEqual(bookmarks);
    expect(result.current.shield).toEqual(shield);
  });

  it("still hydrates untouched bootstrap domains when only the dashboard received an update", async () => {
    storage.updateSettings({ themeId: "pastel-forest" });
    storage.addBookmark({
      title: "Existing bookmark",
      url: "https://example.org",
    });
    const initial = snapshot(),
      pending = deferred<BrowserBootstrap>();
    vi.mocked(api.bootstrap).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    const dashboard = storage.updateDashboard({
      note: "Event received during startup",
    });
    act(() => dashboardEvents.emit(dashboard));
    await act(async () => pending.resolve(initial));
    expect(result.current.ready).toBe(true);
    expect(result.current.settings).toEqual(initial.settings);
    expect(result.current.bookmarks).toEqual(initial.bookmarks);
    expect(result.current.shield).toEqual(initial.shield);
    expect(result.current.dashboard).toEqual(dashboard);
  });

  it("accepts successful save replies without a broadcast and propagates failures without changing saved state", async () => {
    vi.mocked(api.updateSettings).mockImplementation(async (patch) =>
      storage.updateSettings(patch),
    );
    vi.mocked(api.updateDashboard).mockImplementation(async (patch) =>
      storage.updateDashboard(patch),
    );
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => {
      await result.current.updateSettings({ themeId: "pastel-forest" });
      await result.current.updateDashboard({ note: "Successful reply only" });
    });
    const settings = storage.getSettings(),
      dashboard = storage.getDashboard();
    expect(result.current.settings).toEqual(settings);
    expect(result.current.dashboard).toEqual(dashboard);
    vi.mocked(api.updateSettings).mockRejectedValueOnce(
      new Error("Settings disk full"),
    );
    vi.mocked(api.updateDashboard).mockRejectedValueOnce(
      new Error("Dashboard disk full"),
    );
    await act(async () => {
      await expect(
        result.current.updateSettings({ themeId: "lunar-dark" }),
      ).rejects.toThrow("Settings disk full");
      await expect(
        result.current.updateDashboard({ note: "Not saved" }),
      ).rejects.toThrow("Dashboard disk full");
    });
    expect(result.current.settings).toEqual(settings);
    expect(result.current.dashboard).toEqual(dashboard);
  });

  it("keeps the newest of overlapping save replies even when neither request broadcasts", async () => {
    const firstSettings = deferred<BrowserSettings>(),
      secondSettings = deferred<BrowserSettings>();
    const firstDashboard = deferred<DashboardSettings>(),
      secondDashboard = deferred<DashboardSettings>();
    vi.mocked(api.updateSettings)
      .mockReturnValueOnce(firstSettings.promise)
      .mockReturnValueOnce(secondSettings.promise);
    vi.mocked(api.updateDashboard)
      .mockReturnValueOnce(firstDashboard.promise)
      .mockReturnValueOnce(secondDashboard.promise);
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const olderSettings = storage.updateSettings({ themeId: "lunar-dark" });
    const olderDashboard = storage.updateDashboard({ note: "Older request" });
    const savingFirstSettings = result.current.updateSettings({
      themeId: "lunar-dark",
    });
    const savingFirstDashboard = result.current.updateDashboard({
      note: "Older request",
    });
    const newerSettings = storage.updateSettings({ themeId: "pastel-forest" });
    const newerDashboard = storage.updateDashboard({ note: "Newer request" });
    const savingSecondSettings = result.current.updateSettings({
      themeId: "pastel-forest",
    });
    const savingSecondDashboard = result.current.updateDashboard({
      note: "Newer request",
    });
    await act(async () => {
      secondSettings.resolve(newerSettings);
      secondDashboard.resolve(newerDashboard);
      await Promise.all([savingSecondSettings, savingSecondDashboard]);
    });
    await act(async () => {
      firstSettings.resolve(olderSettings);
      firstDashboard.resolve(olderDashboard);
      await Promise.all([savingFirstSettings, savingFirstDashboard]);
    });
    expect(result.current.settings).toEqual(newerSettings);
    expect(result.current.dashboard).toEqual(newerDashboard);
  });

  it("still accepts an earlier successful save when a later overlapping request fails without broadcasts", async () => {
    const pendingSettings = deferred<BrowserSettings>();
    const pendingDashboard = deferred<DashboardSettings>();
    vi.mocked(api.updateSettings)
      .mockReturnValueOnce(pendingSettings.promise)
      .mockRejectedValueOnce(new Error("Settings disk full"));
    vi.mocked(api.updateDashboard)
      .mockReturnValueOnce(pendingDashboard.promise)
      .mockRejectedValueOnce(new Error("Dashboard disk full"));
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const settings = storage.updateSettings({ themeId: "lunar-dark" });
    const dashboard = storage.updateDashboard({
      note: "Confirmed successful save",
    });
    const savingSettings = result.current.updateSettings({
      themeId: "lunar-dark",
    });
    const savingDashboard = result.current.updateDashboard({
      note: "Confirmed successful save",
    });
    const failedSettings = result.current.updateSettings({
      themeId: "pastel-forest",
    });
    const failedDashboard = result.current.updateDashboard({
      note: "Not saved",
    });
    await act(async () => {
      await Promise.all([
        expect(failedSettings).rejects.toThrow("Settings disk full"),
        expect(failedDashboard).rejects.toThrow("Dashboard disk full"),
      ]);
      pendingSettings.resolve(settings);
      pendingDashboard.resolve(dashboard);
      await Promise.all([savingSettings, savingDashboard]);
    });
    expect(result.current.settings).toEqual(settings);
    expect(result.current.dashboard).toEqual(dashboard);
    expect(new StorageService(profile).getDashboard()).toEqual(dashboard);
  });

  it("does not roll back newer settings when an older save acknowledgement arrives late", async () => {
    const pending = deferred<BrowserSettings>();
    let submitted!: BrowserSettings;
    vi.mocked(api.updateSettings).mockImplementationOnce((patch) => {
      submitted = storage.updateSettings(patch);
      return pending.promise;
    });
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const saving = result.current.updateSettings({ themeId: "lunar-dark" });
    const newer = storage.updateSettings({ themeId: "pastel-forest" });
    act(() => settingsEvents.emit(newer));
    await act(async () => {
      pending.resolve(submitted);
      await saving;
    });
    expect(result.current.settings).toEqual(newer);
  });

  it("does not roll back a newer wallpaper/layout/note snapshot on a delayed dashboard acknowledgement", async () => {
    const pending = deferred<DashboardSettings>();
    let submitted!: DashboardSettings;
    vi.mocked(api.updateDashboard).mockImplementationOnce((patch) => {
      submitted = storage.updateDashboard(patch);
      return pending.promise;
    });
    const { result } = renderHook(useBrowser, { wrapper: BrowserProvider });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const saving = result.current.updateDashboard({
      note: "Earlier note save",
    });
    const newer = storage.updateDashboard({
      note: "Latest saved note",
      wallpaper: { ...storage.getDashboard().wallpaper, builtin: "rose" },
      dock: { ...storage.getDashboard().dock, size: "compact" },
    });
    act(() => dashboardEvents.emit(newer));
    await act(async () => {
      pending.resolve(submitted);
      await saving;
    });
    expect(result.current.dashboard).toEqual(newer);
    expect(new StorageService(profile).getDashboard()).toEqual(newer);
  });

  it("does not resume a background workspace when an older activity query resolves after a blur event", async () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.mocked(api.bootstrap).mockResolvedValueOnce({
      ...snapshot(),
      windowActive: true,
    });
    const pending = deferred<boolean>();
    vi.mocked(api.getWindowActivity).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(
      () => ({ browser: useBrowser(), active: useWorkspaceActivity() }),
      { wrapper: BrowserProvider },
    );
    await waitFor(() => expect(result.current.browser.ready).toBe(true));
    expect(result.current.active).toBe(true);
    act(() => activityEvents.emit(false));
    expect(result.current.active).toBe(false);
    await act(async () => pending.resolve(true));
    expect(result.current.active).toBe(false);
  });
});
