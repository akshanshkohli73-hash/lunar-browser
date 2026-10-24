import type { IconName } from "../components/ui/Icon";
import type { InternalPage } from "../../shared/navigation";

/** One registry for desktop, dock, launcher, Window menu and browser commands. */
export const CONTROL_PANELS = [
  {
    id: "home",
    label: "Home",
    page: "newtab",
    icon: "moon",
    description: "Your new-tab dashboard",
  },
  {
    id: "widgets",
    label: "Widgets",
    page: "widgets",
    icon: "widgets",
    description: "Widget library and saved layout",
  },
  {
    id: "appearance",
    label: "Appearance",
    page: "themestudio",
    icon: "palette",
    description: "Theme Studio, local backgrounds and effects",
  },
  {
    id: "shield",
    label: "Lunar Shield",
    page: "shield",
    icon: "shield",
    description: "Network protection and site permissions",
  },
  {
    id: "library",
    label: "Library",
    page: "bookmarks",
    icon: "book",
    description: "Bookmarks and saved destinations",
  },
  {
    id: "activity",
    label: "Activity",
    page: "history",
    icon: "history",
    description: "Browsing history and clearing controls",
  },
  {
    id: "downloads",
    label: "Downloads",
    page: "downloads",
    icon: "download",
    description: "Transfers and downloaded files",
  },
  {
    id: "extensions",
    label: "Extensions",
    page: "extensions",
    icon: "puzzle",
    description: "Manage installed extensions",
  },
  {
    id: "settings",
    label: "Settings",
    page: "settings",
    icon: "settings",
    description: "Browser, startup and privacy preferences",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  page: InternalPage;
  icon: IconName;
  description: string;
}[];
export type ControlPanelId = (typeof CONTROL_PANELS)[number]["id"];
export const KEYBOARD_SHORTCUTS = [
  ["F10", "Focus application menu"],
  ["Ctrl/Cmd+T", "New tab"],
  ["Ctrl/Cmd+W", "Close tab"],
  ["Ctrl/Cmd+L", "Focus address"],
  ["Ctrl/Cmd+K", "Browser commands"],
  ["Ctrl/Cmd+Space", "Lunar control launcher"],
  ["Ctrl/Cmd+D", "Bookmark page"],
  ["Ctrl/Cmd+R / F5", "Reload"],
  ["Ctrl/Cmd+Shift+R", "Reload without cache"],
  ["Ctrl/Cmd++ / − / 0", "Website zoom in / out / reset"],
  ["F11", "Toggle fullscreen"],
  ["Ctrl/Cmd+Tab", "Next tab"],
  ["Ctrl/Cmd+Shift+Tab", "Previous tab"],
  ["Ctrl/Cmd+1…9", "Switch tab (9 selects last)"],
  ["Alt+Left / Right", "Back / forward"],
  ["Ctrl/Cmd+J", "Toggle optional AI sidebar"],
  ["Escape", "Close menu/dialog or stop loading"],
] as const;
