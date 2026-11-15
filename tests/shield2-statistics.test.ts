import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectionStatistics } from "../electron/blocker/statistics";
let profile: string, now: number, statistics: ProtectionStatistics;
const DAY = 86400000;
const observed = (
  blocked: boolean,
  category: "ads" | "trackers" | "malware" | "custom" | "other" = "ads",
  youtube = false,
  host = "ads.private.example",
  site = "https://visited.private.example",
) => {
  statistics.evaluate(now, youtube);
  statistics.terminal(
    now,
    youtube,
    blocked,
    category,
    site,
    host,
    true,
    !blocked,
  );
};
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield-stats-"));
  now = Date.UTC(2026, 9, 1, 12);
  statistics = new ProtectionStatistics(profile, () => now);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await statistics.dispose();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("genuine timestamped, privacy-minimized aggregates", () => {
  it("has no backfilled activity and computes today/7/30/all from actually observed UTC timestamps", async () => {
    expect(statistics.snapshot().days).toEqual([]);
    observed(true, "ads", true);
    now += 2 * DAY;
    observed(true, "trackers");
    now += 6 * DAY;
    observed(false);
    statistics.evaluate(now, false);
    const saved = statistics.snapshot();
    expect(saved.days.map((day) => day.day)).toEqual([
      "2026-10-01",
      "2026-10-03",
      "2026-10-09",
    ]);
    expect(saved.periods.today.totals).toMatchObject({
      evaluated: 2,
      blocked: 0,
      allowed: 1,
      failed: 1,
    });
    expect(saved.periods.today.unresolved).toBe(1);
    expect(saved.periods.week.totals).toMatchObject({
      evaluated: 3,
      blocked: 1,
      allowed: 1,
    });
    expect(saved.periods.month.totals).toMatchObject({
      evaluated: 4,
      blocked: 2,
      allowed: 1,
    });
    expect(saved.periods.all.youtube.blocked).toBe(1);
    await statistics.flush();
    await statistics.dispose();
    statistics = new ProtectionStatistics(profile, () => now);
    expect(statistics.snapshot().periods.all.totals).toEqual(
      saved.periods.all.totals,
    );
    expect(statistics.snapshot().periods.all.unresolved).toBe(1);
    now += 40 * DAY;
    expect(statistics.snapshot().days).toEqual([]);
    expect(statistics.snapshot().periods.month.totals.evaluated).toBe(0);
    expect(statistics.snapshot().periods.all.totals.evaluated).toBe(4);
  });
  it("keeps category sums, popup/cookie/upgrade actions and network failures distinct", () => {
    for (const category of [
      "ads",
      "trackers",
      "malware",
      "custom",
      "other",
    ] as const)
      observed(true, category);
    observed(false);
    statistics.intervention("popups", true);
    statistics.intervention("cookies", true);
    statistics.intervention("upgrades", false);
    const { totals, youtube } = statistics.snapshot().periods.today;
    expect(totals.blocked).toBe(
      totals.ads +
        totals.trackers +
        totals.malware +
        totals.custom +
        totals.other,
    );
    expect(totals.evaluated).toBe(6);
    expect(totals.allowed).toBe(1);
    expect(totals.failed).toBe(1);
    expect(totals.popups).toBe(1);
    expect(youtube.evaluated).toBe(0);
    expect(youtube.popups).toBe(1);
  });
  it("persists salted distinct identifiers, not domains, site origins, request URLs, paths or event logs", async () => {
    observed(true);
    observed(true);
    observed(true, "trackers", false, "second.private.example");
    await statistics.flush();
    const state = statistics.snapshot().periods.all;
    expect(state.uniqueBlockedDomains).toBe(2);
    expect(state.protectedSites).toBe(1);
    const text = fs.readFileSync(
      path.join(profile, "shield-statistics.json"),
      "utf8",
    );
    for (const privateValue of [
      "private.example",
      "https:",
      "visited",
      "ads.private",
    ])
      expect(text).not.toContain(privateValue);
    const saved = JSON.parse(text);
    expect(saved.all.domains).toHaveLength(2);
    expect(saved.salt).toHaveLength(64);
    expect(saved.all.domains[0]).toMatch(/^[a-f\d]{32}$/u);
  });
  it("bounds distinct sets and explicitly reports lower bounds instead of invented precise counts", () => {
    for (let index = 0; index < 2050; index++)
      observed(true, "other", false, `node${index}.tracker.test`);
    const state = statistics.snapshot();
    expect(state.periods.today.uniqueBlockedDomains).toBe(2048);
    expect(state.periods.today.distinctCountsLimited).toBe(true);
    expect(state.periods.all.uniqueBlockedDomains).toBe(2050);
    expect(state.periods.all.distinctCountsLimited).toBe(false);
    expect(state.periods.all.totals.blocked).toBe(2050);
  });
  it("does not attribute future buckets to today if the system clock moves backwards", () => {
    observed(true);
    now -= DAY;
    observed(false);
    expect(statistics.snapshot().periods.today.totals).toMatchObject({
      evaluated: 1,
      allowed: 1,
      blocked: 0,
    });
    expect(statistics.snapshot().periods.all.totals.evaluated).toBe(2);
  });
  it("clears primary/backup/recovery data, rotates the salt and never resets unrelated profile files", async () => {
    observed(true, "ads", true);
    await statistics.flush();
    const filename = path.join(profile, "shield-statistics.json"),
      previous = JSON.parse(fs.readFileSync(filename, "utf8"));
    fs.writeFileSync(`${filename}.corrupt-123`, "old browsing aggregates");
    fs.writeFileSync(path.join(profile, "notes.json"), "keep notes");
    now += DAY;
    await statistics.clear();
    for (const suffix of ["", ".bak"]) {
      const next = JSON.parse(fs.readFileSync(`${filename}${suffix}`, "utf8"));
      expect(next.all.totals.blocked).toBe(0);
      expect(next.salt).not.toBe(previous.salt);
      expect(next.since).toBe(now);
    }
    expect(fs.existsSync(`${filename}.corrupt-123`)).toBe(false);
    expect(fs.readFileSync(path.join(profile, "notes.json"), "utf8")).toBe(
      "keep notes",
    );
    expect(statistics.snapshot().days).toEqual([]);
  });
  it("reports failed persistence, retains genuine in-memory counters and retries without double counting", async () => {
    observed(true);
    const rename = vi
      .spyOn(fs.promises, "rename")
      .mockRejectedValue(new Error("disk unavailable"));
    await expect(statistics.flush()).rejects.toThrow("Could not save");
    expect(statistics.snapshot().persistenceError).toContain("Could not save");
    expect(statistics.snapshot().periods.all.totals.blocked).toBe(1);
    rename.mockRestore();
    observed(false);
    await statistics.flush();
    await statistics.dispose();
    statistics = new ProtectionStatistics(profile, () => now);
    expect(statistics.snapshot().periods.all.totals).toMatchObject({
      evaluated: 2,
      blocked: 1,
      allowed: 1,
    });
  });
});
