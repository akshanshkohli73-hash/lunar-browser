import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "../shared/schemas";
import { StorageService } from "../electron/services/storage";
import { SessionSaver } from "../electron/services/session-saver";

const initial: SessionState = {
  tabs: [{ url: "lunar://newtab", isPinned: false }],
  activeIndex: 0,
};
const next: SessionState = {
  tabs: [{ url: "https://example.com", isPinned: true }],
  activeIndex: 0,
};
const latest: SessionState = {
  tabs: [
    { url: "https://example.com", isPinned: true },
    { url: "https://example.org", isPinned: false },
  ],
  activeIndex: 1,
};
let profile: string, storage: StorageService, saver: SessionSaver;
const report = vi.fn<(message: string) => void>();
beforeEach(() => {
  vi.useFakeTimers();
  report.mockClear();
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-session-"));
  storage = new StorageService(profile);
  storage.updateSettings({ restoreSession: true }, initial);
  saver = new SessionSaver(storage, report);
});
afterEach(() => {
  saver.dispose(storage.getSession());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});

function failOneWrite() {
  const filename = path.join(profile, "session.json"),
    rename = fs.renameSync;
  let failed = false;
  vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
    if (!failed && String(destination) === filename) {
      failed = true;
      throw new Error("EACCES");
    }
    return rename(source, destination);
  });
}

describe("per-window, opt-in session persistence", () => {
  it("retries an identical snapshot on the next event after a transient write failure, without a busy retry loop", () => {
    const save = vi.spyOn(storage, "saveSession");
    failOneWrite();
    saver.queue(next);
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining("Could not save session.json"),
    );
    expect(storage.getSession()).toEqual(initial);
    expect(new StorageService(profile).getSession()).toEqual(initial);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    saver.queue(next);
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(new StorageService(profile).getSession()).toEqual(next);
    expect(fs.readdirSync(profile).some((file) => file.endsWith(".tmp"))).toBe(
      false,
    );
  });

  it("does not postpone a pending save on duplicate loading events and deduplicates successful writes", () => {
    const save = vi.spyOn(storage, "saveSession");
    saver.queue(next);
    vi.advanceTimersByTime(400);
    saver.queue(next);
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(new StorageService(profile).getSession()).toEqual(next);
    saver.queue(next);
    vi.advanceTimersByTime(1_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("coalesces changed snapshots and persists the latest tab order, pins and active index", () => {
    const save = vi.spyOn(storage, "saveSession");
    saver.queue(next);
    vi.advanceTimersByTime(400);
    saver.queue(latest);
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(latest);
    expect(new StorageService(profile).getSession()).toEqual(latest);
  });

  it("drops a superseded pending save when tabs return to the last successfully saved snapshot", () => {
    const save = vi.spyOn(storage, "saveSession");
    saver.queue(next);
    vi.advanceTimersByTime(500);
    saver.queue(latest);
    saver.queue(next);
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(new StorageService(profile).getSession()).toEqual(next);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("replaces failed pending data with the most recent snapshot instead of reviving stale tabs", () => {
    failOneWrite();
    saver.queue(next);
    vi.advanceTimersByTime(500);
    saver.queue(latest);
    vi.advanceTimersByTime(500);
    expect(new StorageService(profile).getSession()).toEqual(latest);
    vi.advanceTimersByTime(5_000);
    expect(new StorageService(profile).getSession()).toEqual(latest);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("does not restore queued session data after the user disables session restoration", () => {
    saver.queue(next);
    storage.updateSettings({ restoreSession: false });
    vi.advanceTimersByTime(500);
    saver.queue(latest);
    vi.advanceTimersByTime(1_000);
    saver.dispose(latest);
    const restarted = new StorageService(profile);
    expect(restarted.getSettings().restoreSession).toBe(false);
    expect(restarted.getSession()).toEqual({ tabs: [], activeIndex: 0 });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(profile, "session.json.bak"), "utf8"),
      ),
    ).toEqual({ tabs: [], activeIndex: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("flushes the actual final snapshot on close, cancels timers and ignores later events or repeated disposal", () => {
    const save = vi.spyOn(storage, "saveSession");
    failOneWrite();
    saver.queue(next);
    vi.advanceTimersByTime(500);
    saver.queue(next);
    saver.dispose(latest);
    expect(save).toHaveBeenCalledTimes(2);
    expect(new StorageService(profile).getSession()).toEqual(latest);
    expect(vi.getTimerCount()).toBe(0);
    saver.queue(initial);
    saver.dispose(initial);
    vi.advanceTimersByTime(1_000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(new StorageService(profile).getSession()).toEqual(latest);
  });
});
