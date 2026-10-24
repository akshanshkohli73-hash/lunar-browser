import type { BrowserSettings, ShieldSettings } from "./schemas";
export const DEFAULT_SHIELD: ShieldSettings = {
  enabled: true,
  ads: true,
  trackers: true,
  telemetry: false,
  social: false,
  cryptomining: true,
  popups: true,
  mode: "balanced",
  blockThirdPartyCookies: true,
  httpsUpgrades: false,
  allowlist: [],
  filterLists: ["lunar-core"],
};
export const DEFAULT_SETTINGS: BrowserSettings = {
  searchEngine: "google",
  themeId: "lunar-coquette",
  reducedMotion: false,
  showBookmarksBar: true,
  recordHistory: true,
  restoreSession: false,
  isFirstRun: true,
  shield: DEFAULT_SHIELD,
  aiEnabled: false,
  aiProvider: "openrouter",
  aiModel: "",
};
