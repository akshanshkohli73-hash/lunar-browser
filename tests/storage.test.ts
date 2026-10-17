import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../electron/services/storage";
let profile: string;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-test-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("validated and durable profile data", () => {
  it("persists bookmark edits, folders, history and settings across service restarts", () => {
    const store = new StorageService(profile);
    const bm = store.addBookmark({
      title: "A",
      url: "https://example.com",
      folder: "Research",
    });
    store.updateBookmark(bm.id, {
      title: "B",
      url: "https://example.org",
      folder: "Read later",
    });
    store.addHistory({ title: "Example", url: "https://example.com" });
    store.updateSettings({ themeId: "pastel-forest", restoreSession: true });
    store.saveSession({
      tabs: [{ url: "https://example.com", isPinned: true }],
      activeIndex: 0,
    });
    const reloaded = new StorageService(profile);
    expect(reloaded.getBookmarks()[0]).toMatchObject({
      title: "B",
      folder: "Read later",
    });
    expect(reloaded.getHistory()).toHaveLength(1);
    expect(reloaded.getSettings().themeId).toBe("pastel-forest");
    expect(reloaded.getSession().tabs[0].isPinned).toBe(true);
    reloaded.deleteBookmark(bm.id);
    reloaded.clearHistory();
    expect(new StorageService(profile).getBookmarks()).toEqual([]);
    expect(new StorageService(profile).getHistory()).toEqual([]);
  });
  it("does not expose credentials or record sensitive/internal URLs and honors privacy settings", () => {
    fs.writeFileSync(
      path.join(profile, "settings.json"),
      JSON.stringify({ aiApiKey: "legacy-secret", searchEngine: "bing" }),
    );
    const store = new StorageService(profile);
    expect(JSON.stringify(store.getSettings())).not.toContain("legacy-secret");
    store.addHistory({
      title: "Callback",
      url: "https://example.com?access_token=secret",
    });
    store.addHistory({ title: "Internal", url: "lunar://settings" });
    store.updateSettings({ recordHistory: false });
    store.addHistory({ title: "No", url: "https://example.com" });
    expect(store.getHistory()).toEqual([]);
  });
  it("quarantines corruption and recovers the last valid backup", () => {
    const store = new StorageService(profile);
    store.addBookmark({ title: "first", url: "https://example.com" });
    store.addBookmark({ title: "second", url: "https://example.org" });
    fs.writeFileSync(path.join(profile, "bookmarks.json"), "broken json");
    const reload = new StorageService(profile);
    expect(reload.getBookmarks()).toHaveLength(1);
    expect(reload.warnings.join(" ")).toContain("Recovered");
    expect(
      fs.readdirSync(profile).some((file) => file.includes(".corrupt-")),
    ).toBe(true);
  });
  it("does not claim recovery preservation when quarantine is denied", () => {
    const filename = path.join(profile, "history.json");
    fs.writeFileSync(filename, "damaged history");
    const rename = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(source) === filename) throw new Error("EACCES");
      return rename(source, destination);
    });
    const store = new StorageService(profile);
    expect(store.getHistory()).toEqual([]);
    expect(store.warnings.join(" ")).toContain("Check profile permissions");
    expect(store.warnings.join(" ")).not.toContain(
      "The original was preserved",
    );
    expect(fs.readFileSync(filename, "utf8")).toBe("damaged history");
  });
  it("preserves separate corrupt originals even with the same timestamp and clears owned recovery formats", () => {
    vi.spyOn(Date, "now").mockReturnValue(1792195200000);
    const filename = path.join(profile, "history.json");
    fs.writeFileSync(filename, "first damaged history");
    new StorageService(profile);
    fs.writeFileSync(filename, "second damaged history");
    const store = new StorageService(profile);
    const copies = fs
      .readdirSync(profile)
      .filter((name) => name.startsWith("history.json.corrupt-"));
    expect(copies).toHaveLength(2);
    expect(
      copies
        .map((name) => fs.readFileSync(path.join(profile, name), "utf8"))
        .sort(),
    ).toEqual(["first damaged history", "second damaged history"]);
    store.clearHistory();
    expect(
      fs
        .readdirSync(profile)
        .filter((name) => name.startsWith("history.json.corrupt-")),
    ).toEqual([]);
  });
  it("rejects invalid destinations and does not report success or change memory on failed writes", () => {
    const store = new StorageService(profile);
    expect(() =>
      store.addBookmark({ title: "bad", url: "javascript:alert(1)" }),
    ).toThrow();
    const original = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((a, b) => {
      if (String(b).endsWith("bookmarks.json")) throw new Error("EACCES");
      return original(a, b);
    });
    expect(() =>
      store.addBookmark({ title: "not saved", url: "https://example.com" }),
    ).toThrow("Could not save");
    expect(store.getBookmarks()).toEqual([]);
    expect(
      fs.readdirSync(profile).filter((file) => file.endsWith(".tmp")),
    ).toEqual([]);
  });
});

describe("privacy-sensitive write semantics", () => {
  it("clears normal history backups and quarantined copies rather than leaving a hidden retained history", () => {
    const store = new StorageService(profile);
    store.addHistory({ title: "First", url: "https://example.com/private" });
    store.addHistory({ title: "Second", url: "https://example.org/private" });
    fs.writeFileSync(
      path.join(profile, "history.json.corrupt-123456"),
      "old history contents",
    );
    store.clearHistory();
    expect(
      fs.readFileSync(path.join(profile, "history.json"), "utf8").trim(),
    ).toBe("[]");
    expect(
      fs.readFileSync(path.join(profile, "history.json.bak"), "utf8").trim(),
    ).toBe("[]");
    expect(
      fs.existsSync(path.join(profile, "history.json.corrupt-123456")),
    ).toBe(false);
  });
  it("does not enable session restoration when the initial snapshot cannot be written", () => {
    const store = new StorageService(profile),
      rename = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(destination).endsWith("session.json"))
        throw new Error("EACCES");
      return rename(source, destination);
    });
    expect(() =>
      store.updateSettings(
        { restoreSession: true },
        {
          tabs: [{ url: "https://example.com", isPinned: false }],
          activeIndex: 0,
        },
      ),
    ).toThrow("Could not save session.json");
    expect(store.getSettings().restoreSession).toBe(false);
  });
});
