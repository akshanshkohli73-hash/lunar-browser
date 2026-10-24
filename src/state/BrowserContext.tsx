import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BrowserSettings, Bookmark } from "../../shared/schemas";
import type { TabsSnapshot, ShieldState } from "../../electron/types";
import type { LunarAPI } from "../../shared/api";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import { BUILTIN_THEMES, applyThemeTokens } from "../styles/themes";
import {
  DEFAULT_DASHBOARD,
  type DashboardSettings,
  type DashboardPatch,
} from "../../shared/dashboard";
import type { ThemeTokens } from "../../shared/schemas";
interface BrowserContextValue {
  dashboard: DashboardSettings;
  presentationDashboard: DashboardSettings;
  previewDashboard: (
    owner: string,
    dashboard: DashboardSettings | null,
  ) => void;
  reducedMotion: boolean;
  updateDashboard: (patch: DashboardPatch) => Promise<void>;
  theme: ThemeTokens;
  previewTheme: (
    owner: string,
    theme: ThemeTokens | null,
    reducedMotion?: boolean,
  ) => void;
  api: LunarAPI | undefined;
  ready: boolean;
  settings: BrowserSettings;
  tabs: TabsSnapshot;
  bookmarks: Bookmark[];
  shield: ShieldState | null;
  errors: string[];
  report: (error: unknown) => void;
  dismissError: () => void;
  updateSettings: (partial: Partial<BrowserSettings>) => Promise<void>;
}
const BrowserContext = createContext<BrowserContextValue | null>(null);
export function BrowserProvider({ children }: { children: React.ReactNode }) {
  const api = window.lunarAPI;
  const [ready, setReady] = useState(!api),
    [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
  const [preview, setPreview] = useState<{
    owner: string;
    theme: ThemeTokens;
    reducedMotion?: boolean;
  } | null>(null);
  const previewTheme = useCallback(
    (owner: string, theme: ThemeTokens | null, reducedMotion?: boolean) => {
      setPreview((current) =>
        theme
          ? { owner, theme, reducedMotion }
          : current?.owner === owner
            ? null
            : current,
      );
    },
    [],
  );
  const [dashboardPreview, setDashboardPreview] = useState<{
    owner: string;
    dashboard: DashboardSettings;
  } | null>(null);
  const previewDashboard = useCallback(
    (owner: string, dashboard: DashboardSettings | null) =>
      setDashboardPreview((current) =>
        dashboard
          ? { owner, dashboard }
          : current?.owner === owner
            ? null
            : current,
      ),
    [],
  );
  const presentationDashboard = dashboardPreview?.dashboard ?? dashboard;
  const reducedMotion = preview?.reducedMotion ?? settings.reducedMotion;
  const [tabs, setTabs] = useState<TabsSnapshot>({
    tabs: [],
    activeTabId: null,
    revision: 0,
  });
  const revision = useRef(-1);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]),
    [shield, setShield] = useState<ShieldState | null>(null),
    [errors, setErrors] = useState<string[]>([]);
  const report = useCallback((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "The operation could not be completed.";
    setErrors((current) =>
      current.includes(message) ? current : [...current.slice(-3), message],
    );
  }, []);
  useEffect(() => {
    const receive = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string")
        report(event.detail);
    };
    window.addEventListener("lunar:app-error", receive);
    return () => window.removeEventListener("lunar:app-error", receive);
  }, [report]);
  useEffect(() => {
    if (!api) return;
    let live = true;
    const receiveTabs = (state: TabsSnapshot) => {
      if (live && state.revision >= revision.current) {
        revision.current = state.revision;
        setTabs(state);
      }
    };
    const unsubscribers = [
      api.onTabsUpdated(receiveTabs),
      api.onDashboardUpdated(setDashboard),
      api.onSettingsUpdated(setSettings),
      api.onBookmarksUpdated(setBookmarks),
      api.onShieldUpdated(setShield),
      api.onError(report),
    ];
    api
      .bootstrap()
      .then((state) => {
        if (!live) return;
        receiveTabs(state.tabs);
        setSettings(state.settings);
        setDashboard(state.dashboard);
        setBookmarks(state.bookmarks);
        setShield(state.shield);
        state.warnings.forEach(report);
        setReady(true);
      })
      .catch(report);
    return () => {
      live = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [api, report]);
  const theme =
    preview?.theme ??
    settings.customTheme ??
    BUILTIN_THEMES[settings.themeId] ??
    BUILTIN_THEMES["lunar-coquette"];
  useEffect(() => {
    applyThemeTokens(theme);
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [theme, reducedMotion]);
  const updateSettings = useCallback(
    async (partial: Partial<BrowserSettings>) => {
      if (!api)
        throw new Error(
          "Customization is saved by the installed desktop application, not this web preview.",
        );
      if (!ready)
        throw new Error("Wait until your saved preferences have loaded.");
      const saved = await api.updateSettings(partial);
      setSettings(saved);
    },
    [api, ready],
  );
  const updateDashboard = useCallback(
    async (patch: DashboardPatch) => {
      if (!api)
        throw new Error(
          "Dashboard saving requires the installed Electron application.",
        );
      if (!ready)
        throw new Error("Wait until your saved dashboard has loaded.");
      setDashboard(await api.updateDashboard(patch));
    },
    [api, ready],
  );
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.dockSize = presentationDashboard.dock.size;
    root.dataset.dockMagnify = String(presentationDashboard.dock.magnify);
    root.style.setProperty(
      "--dock-opacity",
      String(presentationDashboard.dock.opacity),
    );
  }, [presentationDashboard.dock]);
  const value = useMemo(
    () => ({
      api,
      ready,
      dashboard,
      presentationDashboard,
      previewDashboard,
      reducedMotion,
      updateDashboard,
      theme,
      previewTheme,
      settings,
      tabs,
      bookmarks,
      shield,
      errors,
      report,
      dismissError: () => setErrors((current) => current.slice(1)),
      updateSettings,
    }),
    [
      api,
      ready,
      dashboard,
      presentationDashboard,
      previewDashboard,
      reducedMotion,
      updateDashboard,
      theme,
      previewTheme,
      settings,
      tabs,
      bookmarks,
      shield,
      errors,
      report,
      updateSettings,
    ],
  );
  return (
    <BrowserContext.Provider value={value}>{children}</BrowserContext.Provider>
  );
}
export function useBrowser() {
  const value = useContext(BrowserContext);
  if (!value) throw new Error("Browser state must be inside BrowserProvider.");
  return value;
}
