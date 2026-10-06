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
}

export interface ShieldStats {
  totalBlocked: number;
  adsBlocked: number;
  trackersBlocked: number;
  analyticsBlocked: number;
  telemetryBlocked: number;
  cryptominersBlocked: number;
  socialBlocked: number;
  popupsBlocked: number;
  annoyancesBlocked: number;
}

export interface ShieldSettings {
  enabled: boolean;
  ads: boolean;
  trackers: boolean;
  popups: boolean;
  telemetry: boolean;
  social: boolean;
  cryptomining: boolean;
  annoyances: boolean;
  autoplay: boolean;
  fingerprintProtection: boolean;
  allowlist: string[];
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  parentId?: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  visitTime: number;
}

export interface DownloadItemInfo {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  receivedBytes: number;
  totalBytes: number;
  speed: number;
  status: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused';
  startTime: number;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  tabIds: string[];
  theme?: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  permissions: string[];
  compatibility: 'FULL' | 'PARTIAL';
  path: string;
}

export interface BrowserSettings {
  searchEngine: string; // 'google' | 'bing' | 'duckduckgo' | 'custom'
  customSearchUrl?: string;
  theme: 'Lunar Dark' | 'Midnight' | 'Moonlight' | 'Void' | 'Nebula' | 'Terminal';
  accentColor: string;
  glowIntensity: number;
  animationIntensity: number;
  density: 'compact' | 'comfortable';
  aiProvider: 'openrouter' | 'gemini' | 'inception' | 'local';
  aiApiKey?: string;
  aiModel?: string;
  shield: ShieldSettings;
  activeWorkspaceId: string;
  showBookmarksBar: boolean;
  verticalTabs: boolean;
  readerModeOptions: {
    font: string;
    fontSize: number;
    theme: 'dark' | 'light' | 'sepia';
  };
}
