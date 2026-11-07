export type {
  BrowserSettings,
  ShieldSettings,
  Bookmark,
  BookmarkInput,
  HistoryItem,
  SessionState,
  WorkspaceLayout,
  DownloadItemInfo,
  ExtensionRecord,
} from "../shared/schemas";
export interface TabInfo {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isMuted: boolean;
  isPinned: boolean;
  audible: boolean;
  crashed?: boolean;
  error?: string;
}
export interface TabsSnapshot {
  revision: number;
  tabs: TabInfo[];
  activeTabId: string | null;
}
export interface ShieldStats {
  totalBlocked: number;
  adsBlocked: number;
  trackersBlocked: number;
  telemetryBlocked: number;
  cryptominersBlocked: number;
  socialBlocked: number;
  popupsBlocked: number;
}
export interface FilterListStatus {
  id: string;
  name: string;
  ruleCount: number;
  updatedAt: number | null;
  source?: string;
  license?: string;
  error?: string;
}
export interface BlockDiagnostic {
  hostname: string;
  resourceType: string;
  category: string;
  source: string;
  rule: string;
  time: number;
}
export interface ShieldSiteState {
  hostname: string;
  enabled: boolean;
  blocked: number;
  cookies: number;
  upgrades: number;
  recent: BlockDiagnostic[];
}
export interface SitePrivacy {
  origin: string;
  cookies: number;
  grants: string[];
  denials: string[];
}
export interface ShieldState {
  settings: import("../shared/schemas").ShieldSettings;
  stats: ShieldStats;
  lists: FilterListStatus[];
  site?: ShieldSiteState;
}
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  permissions: string[];
  compatibility: "PARTIAL";
  path: string;
  error?: string;
}
export interface AIStatus {
  configured: boolean;
  secureStorage: boolean;
  provider: "openrouter" | "gemini";
  enabled: boolean;
}
export interface BrowserBootstrap {
  tabs: TabsSnapshot;
  settings: import("../shared/schemas").BrowserSettings;
  bookmarks: import("../shared/schemas").Bookmark[];
  shield: ShieldState;
  dashboard: import("../shared/dashboard").DashboardSettings;
  warnings: string[];
}
