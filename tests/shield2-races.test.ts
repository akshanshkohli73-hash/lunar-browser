import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterEngine, compileSource } from "../electron/blocker/filter-engine";
import { DEFAULT_SHIELD } from "../shared/defaults";
import { DEFAULT_SHIELD_CONFIG, shieldConfigSchema } from "../shared/shield";
import { ShieldProfileFile } from "../electron/blocker/profile-file";
import { ProtectionStatistics } from "../electron/blocker/statistics";
import type {
  CompiledFilters,
  FilterCompiler,
} from "../electron/blocker/compiler";
import { deferred } from "./helpers/shield-state";
const network = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, options: RequestInit) => Promise<Response>>(),
}));
vi.mock("electron", () => ({ net: { fetch: network.fetch } }));
const { ShieldSubscriptions } =
  await import("../electron/blocker/subscriptions");
const custom = {
  id: "custom_12345678-1234-1234-1234-123456789abc",
  name: "Race fixture",
  url: "https://api.github.com/repos/example/filters/contents/list.txt",
};
let profile: string,
  engine: FilterEngine,
  lists: InstanceType<typeof ShieldSubscriptions>;
const compile = vi.fn<FilterCompiler>();
const blocked = () =>
  engine.explain(
    "https://remote.example.net/a.js",
    "https://site.example.org",
    "script",
    { ...DEFAULT_SHIELD, filterLists: [custom.id] },
  )?.blocked || false;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield2-races-"));
  engine = new FilterEngine();
  network.fetch
    .mockReset()
    .mockImplementation(
      async () =>
        new Response("||remote.example.net^$script", {
          headers: { ETag: '"fixture"' },
        }),
    );
  compile
    .mockReset()
    .mockImplementation(async (text, format) => compileSource(text, format));
  lists = new ShieldSubscriptions(profile, engine, () => {}, compile);
  lists.configure([custom]);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await lists.dispose();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("source transactions and lifecycle cancellation", () => {
  it("removes an in-flight/queued custom source without a late compile or reset resurrecting its cache", async () => {
    const result = deferred<CompiledFilters>(),
      started = deferred<void>();
    compile.mockImplementationOnce(() => {
      started.resolve();
      return result.promise;
    });
    const update = lists.update([custom.id]);
    await started.promise;
    const queued = lists.update([custom.id]),
      reset = lists.reset(custom.id),
      removed = lists.remove(custom.id);
    result.resolve(compileSource("||remote.example.net^$script", "abp"));
    await Promise.all([update, queued, reset, removed]);
    expect(blocked()).toBe(false);
    expect(lists.status().some((source) => source.id === custom.id)).toBe(
      false,
    );
    expect(
      fs.readdirSync(profile).some((name) => name.includes(custom.id)),
    ).toBe(false);
    expect(network.fetch).toHaveBeenCalledOnce();
  });
  it("makes a requested reset the final operation after an already queued update and clears all recovery copies", async () => {
    await lists.update([custom.id]);
    network.fetch.mockImplementation(
      async () => new Response("||different.example.net^$script"),
    );
    const result = deferred<CompiledFilters>(),
      started = deferred<void>();
    compile.mockImplementationOnce(() => {
      started.resolve();
      return result.promise;
    });
    const update = lists.update([custom.id]);
    await started.promise;
    const reset = lists.reset(custom.id);
    result.resolve(compileSource("||different.example.net^$script", "abp"));
    await Promise.all([update, reset]);
    expect(blocked()).toBe(false);
    expect(
      lists.status().find((source) => source.id === custom.id),
    ).toMatchObject({ ruleCount: 0, updatedAt: null });
    for (const suffix of ["", ".bak"]) {
      const cache = JSON.parse(
        fs.readFileSync(
          path.join(profile, `shield-list-${custom.id}.json${suffix}`),
          "utf8",
        ),
      );
      expect(cache.compiled).toBe("");
      expect(cache.files).toEqual([]);
    }
  });
  it("awaits an already-writing replacement before removing the file and never reactivates a deleted source", async () => {
    const rename = fs.promises.rename,
      entered = deferred<void>(),
      release = deferred<void>();
    vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith(`shield-list-${custom.id}.json`)) {
        entered.resolve();
        await release.promise;
      }
      await rename(from, to);
    });
    const update = lists.update([custom.id]);
    await entered.promise;
    const remove = lists.remove(custom.id);
    release.resolve();
    await Promise.all([update, remove]);
    expect(blocked()).toBe(false);
    expect(fs.readdirSync(profile)).toEqual([]);
  });
  it("preserves the old active engine and cache if a new compiled source cannot be persisted", async () => {
    await lists.update([custom.id]);
    const filename = path.join(profile, `shield-list-${custom.id}.json`),
      saved = fs.readFileSync(filename, "utf8");
    network.fetch.mockImplementation(
      async () => new Response("||new.example.net^"),
    );
    vi.spyOn(fs.promises, "rename").mockRejectedValue(
      new Error("disk unavailable"),
    );
    await lists.update([custom.id]);
    expect(blocked()).toBe(true);
    expect(fs.readFileSync(filename, "utf8")).toBe(saved);
    expect(
      lists.status().find((source) => source.id === custom.id)?.error,
    ).toMatch(/Could not save/);
  });
  it("cancels a real pending download on shutdown, skips queued work and refuses any new update", async () => {
    const entered = deferred<void>();
    network.fetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          entered.resolve();
          options.signal!.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );
    const updating = lists.update([custom.id]);
    await entered.promise;
    const queued = lists.update([custom.id]);
    await lists.dispose();
    await Promise.all([updating, queued]);
    expect(compile).not.toHaveBeenCalled();
    expect(network.fetch).toHaveBeenCalledOnce();
    expect(blocked()).toBe(false);
    await expect(lists.update([custom.id])).rejects.toThrow(/closing/);
  });
  it("recovers a corrupt compiled digest from a validated last-good backup without a network request", async () => {
    await lists.update([custom.id]);
    await lists.update([custom.id]);
    await lists.dispose();
    const filename = path.join(profile, `shield-list-${custom.id}.json`),
      corrupt = JSON.parse(fs.readFileSync(filename, "utf8"));
    corrupt.compiled = "AAAA";
    fs.writeFileSync(filename, JSON.stringify(corrupt));
    engine = new FilterEngine();
    lists = new ShieldSubscriptions(profile, engine, () => {}, compile);
    lists.configure([custom]);
    expect(blocked()).toBe(true);
    expect(
      lists.status().find((source) => source.id === custom.id)?.error,
    ).toMatch(/Recovered/);
    expect(network.fetch).toHaveBeenCalledTimes(2);
  });
  it("validates trusted subscription URLs during profile recovery too, not only during IPC addition", async () => {
    const filename = path.join(profile, "shield-config.json"),
      file = new ShieldProfileFile(
        filename,
        shieldConfigSchema,
        DEFAULT_SHIELD_CONFIG,
      );
    await file.write(DEFAULT_SHIELD_CONFIG, true);
    fs.writeFileSync(
      filename,
      JSON.stringify({
        ...DEFAULT_SHIELD_CONFIG,
        subscriptions: [{ ...custom, url: "https://127.0.0.1/internal" }],
      }),
    );
    const warnings: string[] = [],
      recovered = new ShieldProfileFile(
        filename,
        shieldConfigSchema,
        DEFAULT_SHIELD_CONFIG,
        (warning) => warnings.push(warning),
      );
    expect(recovered.read().subscriptions).toEqual([]);
    expect(warnings.join(" ")).toContain("Recovered");
  });
});
describe("aggregate reset/flush race and UTC retention bounds", () => {
  it("never writes a stale pre-clear aggregate after the clear transaction, including simultaneous clears and shutdown flush", async () => {
    const statistics = new ProtectionStatistics(profile),
      entered = deferred<void>(),
      release = deferred<void>();
    statistics.evaluate(Date.now(), false);
    const rename = fs.promises.rename;
    let paused = false;
    vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
      if (!paused && String(to).endsWith("shield-statistics.json")) {
        paused = true;
        entered.resolve();
        await release.promise;
      }
      await rename(from, to);
    });
    const flushing = statistics.flush();
    await entered.promise;
    const clearing = statistics.clear(),
      again = statistics.clear(),
      lateFlush = statistics.flush();
    expect(clearing).toBe(again);
    release.resolve();
    await Promise.all([flushing, clearing, lateFlush]);
    await statistics.dispose();
    expect(
      new ProtectionStatistics(profile).snapshot().periods.all.totals.evaluated,
    ).toBe(0);
    for (const suffix of ["", ".bak"])
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(profile, `shield-statistics.json${suffix}`),
            "utf8",
          ),
        ).all.totals.evaluated,
      ).toBe(0);
  });
  it("keeps at most 31 day buckets even when observations arrive across moving system clocks without taking a snapshot", async () => {
    let now = Date.UTC(2026, 9, 15),
      observations = 0;
    const statistics = new ProtectionStatistics(profile, () => now);
    for (let index = 0; index < 70; index++) {
      statistics.evaluate(now, false);
      observations++;
      now += 86400000;
    }
    await statistics.flush();
    const saved = JSON.parse(
      fs.readFileSync(path.join(profile, "shield-statistics.json"), "utf8"),
    );
    expect(saved.days.length).toBeLessThanOrEqual(31);
    expect(saved.all.totals.evaluated).toBe(observations);
    now -= 40 * 86400000;
    statistics.evaluate(now, false);
    await statistics.flush();
    expect(statistics.snapshot().periods.today.totals.evaluated).toBe(1);
    await statistics.dispose();
  });
});
