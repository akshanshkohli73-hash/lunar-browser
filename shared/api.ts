import { z } from "zod";
import { isWebUrl } from "./navigation";
import {
  dashboardPatchSchema,
  weatherRequestSchema,
  type DashboardSettings,
  type DashboardPatch,
  type WeatherRequest,
  type WeatherReading,
} from "./dashboard";
import type { WallpaperAsset } from "../electron/services/wallpaper-store";
import {
  idSchema,
  bookmarkInputSchema,
  settingsSchema,
  layoutSchema,
  aiRequestSchema,
} from "./schemas";
import type {
  BrowserSettings,
  Bookmark,
  BookmarkInput,
  DownloadItemInfo,
  WorkspaceLayout,
  HistoryItem,
  AIRequest,
} from "./schemas";
import type {
  BrowserBootstrap,
  TabsSnapshot,
  TabInfo,
  ShieldState,
  ExtensionInfo,
  AIStatus,
  SitePrivacy,
} from "../electron/types";
const none = z.tuple([]),
  tab = z.tuple([idSchema]);
export const requestSchemas = {
  "browser:bootstrap": none,
  "tab:create": z.tuple([z.string().max(8192).optional()]),
  "tab:close": tab,
  "tab:switch": tab,
  "tab:navigate": z.tuple([idSchema, z.string().max(8192)]),
  "tab:back": tab,
  "tab:forward": tab,
  "tab:reload": z.tuple([idSchema, z.boolean().optional()]),
  "tab:stop": tab,
  "tab:mute": tab,
  "tab:pin": tab,
  "tab:duplicate": tab,
  "tab:reorder": z.tuple([z.array(idSchema).max(100)]),
  "workspace:layout": z.tuple([layoutSchema]),
  "dashboard:get": none,
  "dashboard:update": z.tuple([dashboardPatchSchema]),
  "wallpaper:choose": none,
  "wallpaper:prune": none,
  "weather:get": z.tuple([weatherRequestSchema]),
  "settings:get": none,
  "settings:update": z.tuple([settingsSchema.partial().strict()]),
  "bookmarks:get": none,
  "bookmarks:add": z.tuple([bookmarkInputSchema]),
  "bookmarks:update": z.tuple([idSchema, bookmarkInputSchema]),
  "bookmarks:delete": tab,
  "history:get": none,
  "history:delete": z.tuple([z.array(idSchema).max(10000)]),
  "history:clear": none,
  "downloads:get": none,
  "downloads:cancel": tab,
  "downloads:pause": tab,
  "downloads:resume": tab,
  "downloads:reveal": tab,
  "downloads:clear": none,
  "shield:get": none,
  "shield:refresh": none,
  "extensions:get": none,
  "extensions:load": none,
  "extensions:toggle": z.tuple([idSchema, z.boolean()]),
  "extensions:remove": tab,
  "reader:text": tab,
  "ai:status": none,
  "ai:saveKey": z.tuple([
    z
      .string()
      .min(1)
      .max(512)
      .regex(/^[\x21-\x7e]+$/u),
  ]),
  "ai:deleteKey": none,
  "ai:test": none,
  "ai:ask": z.tuple([aiRequestSchema]),
  "privacy:clearSiteData": none,
  "privacy:site": z.tuple([z.string().max(8192).refine(isWebUrl)]),
  "privacy:clearOrigin": z.tuple([z.string().max(8192).refine(isWebUrl)]),
  "permissions:resetSite": z.tuple([z.string().max(8192).refine(isWebUrl)]),
  "permissions:denySite": z.tuple([
    z.string().max(8192).refine(isWebUrl),
    z.enum([
      "media:audio",
      "media:video",
      "geolocation",
      "geolocation-approximate",
      "notifications",
      "clipboard-read",
    ]),
    z.boolean(),
  ]),
  "permissions:reset": none,
  "window:minimize": none,
  "window:maximize": none,
  "window:close": none,
} as const;
export interface Outputs {
  "browser:bootstrap": BrowserBootstrap;
  "tab:create": TabInfo;
  "tab:close": void;
  "tab:switch": void;
  "tab:navigate": void;
  "tab:back": void;
  "tab:forward": void;
  "tab:reload": void;
  "tab:stop": void;
  "tab:mute": void;
  "tab:pin": void;
  "tab:duplicate": TabInfo;
  "tab:reorder": void;
  "workspace:layout": boolean;
  "dashboard:get": DashboardSettings;
  "dashboard:update": DashboardSettings;
  "wallpaper:choose": WallpaperAsset | null;
  "wallpaper:prune": number;
  "weather:get": WeatherReading;
  "settings:get": BrowserSettings;
  "settings:update": BrowserSettings;
  "bookmarks:get": Bookmark[];
  "bookmarks:add": Bookmark;
  "bookmarks:update": Bookmark;
  "bookmarks:delete": void;
  "history:get": HistoryItem[];
  "history:delete": void;
  "history:clear": void;
  "downloads:get": DownloadItemInfo[];
  "downloads:cancel": void;
  "downloads:pause": void;
  "downloads:resume": void;
  "downloads:reveal": void;
  "downloads:clear": void;
  "shield:get": ShieldState;
  "shield:refresh": ShieldState;
  "extensions:get": ExtensionInfo[];
  "extensions:load": ExtensionInfo | null;
  "extensions:toggle": ExtensionInfo[];
  "extensions:remove": ExtensionInfo[];
  "reader:text": string;
  "ai:status": AIStatus;
  "ai:saveKey": AIStatus;
  "ai:deleteKey": AIStatus;
  "ai:test": string;
  "ai:ask": string;
  "privacy:clearSiteData": void;
  "privacy:site": SitePrivacy;
  "privacy:clearOrigin": void;
  "permissions:resetSite": void;
  "permissions:denySite": void;
  "permissions:reset": void;
  "window:minimize": void;
  "window:maximize": void;
  "window:close": void;
}
export type Channel = keyof typeof requestSchemas;
export type Args<K extends Channel> = z.input<(typeof requestSchemas)[K]>;
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export type Shortcut =
  "address" | "commands" | "bookmark" | "ai" | "activate" | "spotlight";
export interface LunarAPI {
  bootstrap(): Promise<BrowserBootstrap>;
  createTab(url?: string): Promise<TabInfo>;
  closeTab(id: string): Promise<void>;
  switchTab(id: string): Promise<void>;
  navigateTab(id: string, url: string): Promise<void>;
  goBack(id: string): Promise<void>;
  goForward(id: string): Promise<void>;
  reloadTab(id: string, ignoreCache?: boolean): Promise<void>;
  stopTab(id: string): Promise<void>;
  toggleMuteTab(id: string): Promise<void>;
  togglePinTab(id: string): Promise<void>;
  duplicateTab(id: string): Promise<TabInfo>;
  reorderTabs(ids: string[]): Promise<void>;
  updateWorkspace(layout: WorkspaceLayout): Promise<boolean>;
  getDashboard(): Promise<DashboardSettings>;
  updateDashboard(patch: DashboardPatch): Promise<DashboardSettings>;
  chooseWallpaper(): Promise<WallpaperAsset | null>;
  pruneWallpapers(): Promise<number>;
  getWeather(request: WeatherRequest): Promise<WeatherReading>;
  getSettings(): Promise<BrowserSettings>;
  updateSettings(settings: Partial<BrowserSettings>): Promise<BrowserSettings>;
  getBookmarks(): Promise<Bookmark[]>;
  addBookmark(input: BookmarkInput): Promise<Bookmark>;
  updateBookmark(id: string, input: BookmarkInput): Promise<Bookmark>;
  deleteBookmark(id: string): Promise<void>;
  getHistory(): Promise<HistoryItem[]>;
  deleteHistoryItems(ids: string[]): Promise<void>;
  clearHistory(): Promise<void>;
  getDownloads(): Promise<DownloadItemInfo[]>;
  cancelDownload(id: string): Promise<void>;
  pauseDownload(id: string): Promise<void>;
  resumeDownload(id: string): Promise<void>;
  revealDownload(id: string): Promise<void>;
  clearDownloads(): Promise<void>;
  getShieldState(): Promise<ShieldState>;
  refreshShield(): Promise<ShieldState>;
  getExtensions(): Promise<ExtensionInfo[]>;
  loadUnpackedExtension(): Promise<ExtensionInfo | null>;
  toggleExtension(id: string, enabled: boolean): Promise<ExtensionInfo[]>;
  removeExtension(id: string): Promise<ExtensionInfo[]>;
  getPageText(id: string): Promise<string>;
  getAIStatus(): Promise<AIStatus>;
  saveAIKey(key: string): Promise<AIStatus>;
  deleteAIKey(): Promise<AIStatus>;
  testAI(): Promise<string>;
  askAI(request: AIRequest): Promise<string>;
  clearSiteData(): Promise<void>;
  getSitePrivacy(url: string): Promise<SitePrivacy>;
  clearOriginData(url: string): Promise<void>;
  resetSitePermissions(url: string): Promise<void>;
  denySitePermission(
    url: string,
    permission:
      | "media:audio"
      | "media:video"
      | "geolocation"
      | "geolocation-approximate"
      | "notifications"
      | "clipboard-read",
    deny: boolean,
  ): Promise<void>;
  resetPermissions(): Promise<void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  onTabsUpdated(callback: (snapshot: TabsSnapshot) => void): () => void;
  onDashboardUpdated(
    callback: (dashboard: DashboardSettings) => void,
  ): () => void;
  onSettingsUpdated(callback: (settings: BrowserSettings) => void): () => void;
  onBookmarksUpdated(callback: (bookmarks: Bookmark[]) => void): () => void;
  onDownloadsUpdated(
    callback: (downloads: DownloadItemInfo[]) => void,
  ): () => void;
  onShieldUpdated(callback: (state: ShieldState) => void): () => void;
  onShortcut(callback: (shortcut: Shortcut) => void): () => void;
  onError(callback: (message: string) => void): () => void;
}
declare global {
  interface Window {
    lunarAPI?: LunarAPI;
  }
}
