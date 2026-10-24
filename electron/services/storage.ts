import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AtomicFile } from "./atomic-file";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import {
  settingsSchema,
  bookmarkSchema,
  bookmarkInputSchema,
  historySchema,
  sessionSchema,
  downloadSchema,
  extensionRecordSchema,
} from "../../shared/schemas";
import type {
  Bookmark,
  BookmarkInput,
  HistoryItem,
  BrowserSettings,
  SessionState,
  DownloadItemInfo,
  ExtensionRecord,
} from "../types";
import {
  DEFAULT_DASHBOARD,
  dashboardSchema,
  dashboardPatchSchema,
  type DashboardSettings,
  type DashboardPatch,
} from "../../shared/dashboard";
import { isWebUrl } from "../../shared/navigation";

function migrateSettings(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const old = input as Record<string, unknown>;
  // Pick known keys only. Obsolete decorative settings and plaintext credentials never reach the bridge.
  const known = Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS)
      .filter((key) => old[key] !== undefined)
      .map((key) => [key, old[key]]),
  );
  if (old.customTheme !== undefined) known.customTheme = old.customTheme;
  if (old.shield && typeof old.shield === "object") {
    const shield = old.shield as Record<string, unknown>;
    known.shield = {
      ...DEFAULT_SETTINGS.shield,
      ...Object.fromEntries(
        Object.keys(DEFAULT_SETTINGS.shield)
          .filter((key) => shield[key] !== undefined)
          .map((key) => [key, shield[key]]),
      ),
    };
  }
  return { ...DEFAULT_SETTINGS, ...known };
}
export class StorageService {
  public readonly warnings: string[] = [];
  private settings: AtomicFile<BrowserSettings>;
  private bookmarks: AtomicFile<Bookmark[]>;
  private history: AtomicFile<HistoryItem[]>;
  private session: AtomicFile<SessionState>;
  private downloads: AtomicFile<DownloadItemInfo[]>;
  private extensions: AtomicFile<ExtensionRecord[]>;
  private dashboard: AtomicFile<DashboardSettings>;
  constructor(public readonly profilePath: string) {
    const warn = (message: string) => this.warnings.push(message);
    this.dashboard = new AtomicFile(
      path.join(profilePath, "dashboard.json"),
      dashboardSchema,
      DEFAULT_DASHBOARD,
      warn,
    );
    this.settings = new AtomicFile(
      path.join(profilePath, "settings.json"),
      settingsSchema,
      DEFAULT_SETTINGS,
      warn,
      migrateSettings,
    );
    this.bookmarks = new AtomicFile(
      path.join(profilePath, "bookmarks.json"),
      z.array(bookmarkSchema).max(5000),
      [],
      warn,
      (input) =>
        Array.isArray(input)
          ? input.map((value) => {
              if (!value || typeof value !== "object") return value;
              const entry = value as Record<string, unknown>;
              return {
                id: entry.id,
                title: entry.title,
                url: entry.url,
                createdAt: entry.createdAt,
                folder: entry.folder ?? "",
              };
            })
          : input,
    );
    this.history = new AtomicFile(
      path.join(profilePath, "history.json"),
      z.array(historySchema).max(10000),
      [],
      warn,
      (input) =>
        Array.isArray(input)
          ? input.map((value) => {
              if (!value || typeof value !== "object") return value;
              const entry = value as Record<string, unknown>;
              return {
                id: entry.id,
                title: entry.title,
                url: entry.url,
                visitTime: entry.visitTime,
              };
            })
          : input,
    );
    this.session = new AtomicFile(
      path.join(profilePath, "session.json"),
      sessionSchema,
      { tabs: [], activeIndex: 0 },
      warn,
    );
    this.downloads = new AtomicFile(
      path.join(profilePath, "downloads.json"),
      z.array(downloadSchema).max(200),
      [],
      warn,
    );
    this.extensions = new AtomicFile(
      path.join(profilePath, "extensions.json"),
      z.array(extensionRecordSchema).max(50),
      [],
      warn,
    );
  }
  public getDashboard(): DashboardSettings {
    return this.dashboard.read();
  }
  public updateDashboard(patch: DashboardPatch): DashboardSettings {
    return this.dashboard.write(
      dashboardSchema.parse({
        ...this.dashboard.read(),
        ...dashboardPatchSchema.parse(patch),
      }),
    );
  }
  public getSettings(): BrowserSettings {
    return this.settings.read();
  }
  public updateSettings(
    partial: Partial<BrowserSettings>,
    currentSession?: SessionState,
  ): BrowserSettings {
    const patch = settingsSchema.partial().strict().parse(partial);
    const next = { ...this.settings.read(), ...patch };
    // Persist the initial opt-in snapshot before reporting the preference as enabled.
    if (patch.restoreSession === true && currentSession)
      this.session.write(currentSession);
    if (this.settings.read().restoreSession && !next.restoreSession)
      this.session.write({ tabs: [], activeIndex: 0 }, false);
    return this.settings.write(next);
  }
  public getBookmarks(): Bookmark[] {
    return this.bookmarks.read();
  }
  public addBookmark(input: BookmarkInput): Bookmark {
    const bookmark = {
      ...bookmarkInputSchema.parse(input),
      id: `bm_${randomUUID()}`,
      createdAt: Date.now(),
    };
    this.bookmarks.write([...this.bookmarks.read(), bookmark]);
    return bookmark;
  }
  public updateBookmark(id: string, input: BookmarkInput): Bookmark {
    const all = this.bookmarks.read(),
      index = all.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("This bookmark no longer exists.");
    all[index] = { ...all[index], ...bookmarkInputSchema.parse(input) };
    this.bookmarks.write(all);
    return all[index];
  }
  public deleteBookmark(id: string) {
    const all = this.bookmarks.read();
    if (!all.some((item) => item.id === id))
      throw new Error("This bookmark no longer exists.");
    this.bookmarks.write(
      all.filter((item) => item.id !== id),
      false,
    );
  }
  public getHistory(): HistoryItem[] {
    return this.history.read();
  }
  public addHistory(input: { url: string; title: string }): void {
    if (!this.getSettings().recordHistory || !isWebUrl(input.url)) return;
    // Do not persist common authentication callback / credential-bearing URLs.
    const url = new URL(input.url);
    if (
      [...url.searchParams.keys()].some((key) =>
        /^(?:password|passwd|access_token|id_token|refresh_token|code|authorization)$/iu.test(
          key,
        ),
      )
    )
      return;
    const all = this.history.read(),
      first = all[0];
    if (first?.url === input.url && Date.now() - first.visitTime < 5000)
      all.shift();
    this.history.write(
      [
        {
          id: `hist_${randomUUID()}`,
          url: input.url,
          title: input.title.slice(0, 500),
          visitTime: Date.now(),
        },
        ...all,
      ].slice(0, 10000),
    );
  }
  public deleteHistoryItems(ids: string[]) {
    const selected = new Set(ids);
    this.history.write(
      this.history.read().filter((item) => !selected.has(item.id)),
      false,
    );
  }
  public clearHistory() {
    this.history.write([], false);
    this.history.purgeCorruptCopies();
  }
  public getSession(): SessionState {
    return this.session.read();
  }
  public saveSession(state: SessionState) {
    if (this.getSettings().restoreSession) this.session.write(state);
  }
  public getDownloads(): DownloadItemInfo[] {
    return this.downloads.read();
  }
  public saveDownloads(items: DownloadItemInfo[]) {
    this.downloads.write(items.slice(-200));
  }
  public getExtensions(): ExtensionRecord[] {
    return this.extensions.read();
  }
  public saveExtensions(items: ExtensionRecord[]) {
    this.extensions.write(items);
  }
}
