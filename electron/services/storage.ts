import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Bookmark, HistoryItem, BrowserSettings, Workspace } from '../types';

export class StorageService {
  private userDataPath: string;
  private bookmarksFile: string;
  private historyFile: string;
  private settingsFile: string;
  private workspacesFile: string;

  private defaultSettings: BrowserSettings = {
    searchEngine: 'google',
    theme: 'Lunar Dark',
    accentColor: '#00f0ff',
    glowIntensity: 70,
    animationIntensity: 100,
    density: 'comfortable',
    aiProvider: 'openrouter',
    activeWorkspaceId: 'personal',
    showBookmarksBar: true,
    verticalTabs: false,
    shield: {
      enabled: true,
      ads: true,
      trackers: true,
      popups: true,
      telemetry: true,
      social: true,
      cryptomining: true,
      annoyances: true,
      autoplay: false,
      fingerprintProtection: true,
      allowlist: [],
    },
    readerModeOptions: {
      font: 'sans-serif',
      fontSize: 16,
      theme: 'dark',
    },
  };

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.bookmarksFile = path.join(this.userDataPath, 'bookmarks.json');
    this.historyFile = path.join(this.userDataPath, 'history.json');
    this.settingsFile = path.join(this.userDataPath, 'settings.json');
    this.workspacesFile = path.join(this.userDataPath, 'workspaces.json');
  }

  private readJson<T>(filePath: string, defaultValue: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
    }
    return defaultValue;
  }

  private writeJson<T>(filePath: string, data: T): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error writing ${filePath}:`, err);
    }
  }

  // BOOKMARKS
  public getBookmarks(): Bookmark[] {
    return this.readJson<Bookmark[]>(this.bookmarksFile, [
      { id: '1', title: 'Lunar Home', url: 'lunar://newtab', createdAt: Date.now() },
      { id: '2', title: 'GitHub', url: 'https://github.com', createdAt: Date.now() },
      { id: '3', title: 'YouTube', url: 'https://youtube.com', createdAt: Date.now() },
    ]);
  }

  public addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Bookmark {
    const bookmarks = this.getBookmarks();
    const newBookmark: Bookmark = {
      ...bookmark,
      id: `bm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: Date.now(),
    };
    bookmarks.push(newBookmark);
    this.writeJson(this.bookmarksFile, bookmarks);
    return newBookmark;
  }

  public deleteBookmark(id: string): boolean {
    let bookmarks = this.getBookmarks();
    const initialLen = bookmarks.length;
    bookmarks = bookmarks.filter((b) => b.id !== id);
    this.writeJson(this.bookmarksFile, bookmarks);
    return bookmarks.length < initialLen;
  }

  // HISTORY
  public getHistory(): HistoryItem[] {
    return this.readJson<HistoryItem[]>(this.historyFile, []);
  }

  public addHistory(item: Omit<HistoryItem, 'id' | 'visitTime'>): HistoryItem {
    const history = this.getHistory();
    // Don't duplicate lunar:// internal history
    if (item.url.startsWith('lunar://')) return item as any;

    const newItem: HistoryItem = {
      ...item,
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      visitTime: Date.now(),
    };
    // Prepend
    history.unshift(newItem);
    // Limit history entries to max 1000 items
    if (history.length > 1000) history.pop();
    this.writeJson(this.historyFile, history);
    return newItem;
  }

  public deleteHistoryItem(id: string): boolean {
    let history = this.getHistory();
    const initialLen = history.length;
    history = history.filter((h) => h.id !== id);
    this.writeJson(this.historyFile, history);
    return history.length < initialLen;
  }

  public clearHistory(): void {
    this.writeJson(this.historyFile, []);
  }

  // SETTINGS
  public getSettings(): BrowserSettings {
    return this.readJson<BrowserSettings>(this.settingsFile, this.defaultSettings);
  }

  public updateSettings(partial: Partial<BrowserSettings>): BrowserSettings {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    this.writeJson(this.settingsFile, updated);
    return updated;
  }

  // WORKSPACES
  public getWorkspaces(): Workspace[] {
    return this.readJson<Workspace[]>(this.workspacesFile, [
      { id: 'personal', name: 'Personal', icon: '👤', tabIds: [] },
      { id: 'school', name: 'School', icon: '🎓', tabIds: [] },
      { id: 'coding', name: 'Coding', icon: '💻', tabIds: [] },
      { id: 'gaming', name: 'Gaming', icon: '🎮', tabIds: [] },
      { id: 'research', name: 'Research', icon: '🔬', tabIds: [] },
    ]);
  }

  public saveWorkspaces(workspaces: Workspace[]): void {
    this.writeJson(this.workspacesFile, workspaces);
  }
}
