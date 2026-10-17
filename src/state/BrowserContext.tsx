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
interface BrowserContextValue {
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
    settings.customTheme ??
    BUILTIN_THEMES[settings.themeId] ??
    BUILTIN_THEMES["lunar-coquette"];
  useEffect(() => {
    applyThemeTokens(theme);
    document.documentElement.dataset.reducedMotion = String(
      settings.reducedMotion,
    );
  }, [theme, settings.reducedMotion]);
  const updateSettings = useCallback(
    async (partial: Partial<BrowserSettings>) => {
      if (!api)
        throw new Error(
          "Customization is saved by the installed desktop application, not this web preview.",
        );
      const saved = await api.updateSettings(partial);
      setSettings(saved);
    },
    [api],
  );
  const value = useMemo(
    () => ({
      api,
      ready,
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
