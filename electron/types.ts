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
  description?: string;
  category?: import("../shared/shield").SourceCategory;
  format?: import("../shared/shield").SourceFormat;
  rejected?: number;
  ignored?: number;
  checkedAt?: number | null;
  updating?: boolean;
  custom?: boolean;
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
  origin?: string;
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
  customRulesEnabled?: number;
  /** Present on Shield 2.0 native snapshots; absent in an unconnected renderer preview. */
  protection?: import("../shared/shield").ShieldProtectionState;
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
  /** UI shell only; website contents never receive this bridge. */
  windowActive?: boolean;
  tabs: TabsSnapshot;
  settings: import("../shared/schemas").BrowserSettings;
  bookmarks: import("../shared/schemas").Bookmark[];
  shield: ShieldState;
  dashboard: import("../shared/dashboard").DashboardSettings;
  warnings: string[];
}
