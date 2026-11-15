import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileSource } from "../electron/blocker/filter-engine";
import type { ShieldSettings } from "../electron/types";
import { DEFAULT_SHIELD } from "../shared/defaults";
import { ShieldSessionFixture } from "./helpers/shield-session";
const network = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, options: RequestInit) => Promise<Response>>(),
}));
vi.mock("electron", () => ({ net: { fetch: network.fetch } }));
const { LunarShield } = await import("../electron/blocker/shield");
let profile: string,
  fixture: ShieldSessionFixture,
  settings: ShieldSettings,
  shield: InstanceType<typeof LunarShield>;
let urls: Map<number, string>;
const compiler = vi.fn(async (text: string, format: "abp" | "hosts") =>
  compileSource(text, format),
);
const make = (active = "https://one.example.org") =>
  new LunarShield(
    fixture.session,
    profile,
    () => settings,
    (id) => urls.get(id) || "",
    () => {},
    () => active,
    { compile: compiler },
  );
const body = (url: string) =>
  url.includes("StevenBlack")
    ? "0.0.0.0 mixed-host.test\n"
    : url.includes("hagezi")
      ? "||known-threat.test^"
      : url.endsWith("allowlist.txt") ||
          url.endsWith("allowlist_dimensions.txt")
        ? "@@||remote-tracker.test/allowed$script"
        : "||remote-tracker.test^$script,third-party";
beforeEach(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield2-service-"));
  fixture = new ShieldSessionFixture();
  urls = new Map([
    [7, "https://one.example.org"],
    [8, "https://two.example.net"],
  ]);
  settings = structuredClone(DEFAULT_SHIELD);
  compiler.mockClear();
  network.fetch
    .mockReset()
    .mockImplementation(
      async (url) =>
        new Response(body(url), { headers: { ETag: '"fixture-v1"' } }),
    );
  shield = make();
  await shield.ready;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await shield.dispose();
  fs.rmSync(profile, { recursive: true, force: true });
});
const total = () => shield.getState().protection!.statistics.periods.all;
describe("single-owner request lifecycle accounting (controlled Electron adapter)", () => {
  it("waits for Chromium's terminal cancellation and counts a redirect/request ID only once", () => {
    const first = fixture.details(1, "https://ordinary.example.net/redirect");
    expect(fixture.start(first)).toEqual({ cancel: false });
    expect(
      fixture.start({
        ...first,
        url: "https://ads.doubleclick.net/final?secret=not-kept",
      }),
    ).toEqual({ cancel: true });
    expect(total().totals).toMatchObject({
      evaluated: 1,
      blocked: 0,
      allowed: 0,
    });
    fixture.finish(1, "net::ERR_BLOCKED_BY_CLIENT");
    fixture.finish(1, "net::ERR_BLOCKED_BY_CLIENT");
    fixture.finish(1);
    expect(total().totals).toMatchObject({
      evaluated: 1,
      blocked: 1,
      ads: 1,
      allowed: 0,
    });
    expect(total().unresolved).toBe(0);
    expect(JSON.stringify(shield.getState())).not.toContain("secret=not-kept");
    expect(shield.getState().protection!.site!.recent[0]).toMatchObject({
      hostname: "ads.doubleclick.net",
      site: "https://one.example.org",
      thirdParty: true,
    });
  });
  it("classifies a redirect into genuine YouTube once without duplicating global evaluations", () => {
    fixture.start(
      fixture.details(12, "https://short.example.org/redirect", "mainFrame"),
    );
    fixture.start(
      fixture.details(
        12,
        "https://www.youtube.com/watch?v=fixture",
        "mainFrame",
      ),
    );
    fixture.finish(12);
    expect(total().totals).toMatchObject({
      evaluated: 1,
      allowed: 1,
      blocked: 0,
    });
    expect(total().youtube).toMatchObject({
      evaluated: 1,
      allowed: 1,
      blocked: 0,
    });
  });
  it("does not claim a block without a matching terminal outcome and records other errors as allowed failures", () => {
    fixture.start(fixture.details(2, "https://ads.doubleclick.net/a"));
    expect(total().totals.blocked).toBe(0);
    expect(total().unresolved).toBe(1);
    fixture.finish(2, "net::ERR_CONNECTION_REFUSED");
    fixture.request(3, "https://ordinary.example.net/library.js");
    expect(total().totals).toMatchObject({
      evaluated: 2,
      blocked: 0,
      allowed: 2,
      failed: 1,
    });
  });
  it("attributes inactive tabs and separate sessions independently, rejects duplicate owners and detaches every event", async () => {
    expect(() => make()).toThrow(/owner/);
    expect(fixture.registrations).toEqual({
      before: 1,
      outgoing: 1,
      incoming: 1,
      completed: 1,
      failed: 1,
    });
    const second = new ShieldSessionFixture();
    shield.attachSession(second.session, () => "https://third.example.com");
    expect(() =>
      shield.attachSession(second.session, () => "https://x.test"),
    ).toThrow(/owner/);
    fixture.request(1, "https://ads.doubleclick.net/a", "script", 7);
    fixture.request(2, "https://google-analytics.com/p", "xhr", 8);
    second.request(1, "https://ads.doubleclick.net/b");
    expect(total().totals.blocked).toBe(3);
    expect(shield.getState("https://one.example.org").site!.blocked).toBe(1);
    expect(shield.getState("https://two.example.net").site!.blocked).toBe(1);
    expect(shield.getState("https://third.example.com").site!.blocked).toBe(1);
    expect(
      fixture.request(
        4,
        "https://ads.doubleclick.net/background",
        "script",
        999,
      ),
    ).toEqual({ cancel: false });
    expect(total().totals.evaluated).toBe(3);
    const first = shield.dispose(),
      again = shield.dispose();
    expect(first).toBe(again);
    await first;
    for (const session of [fixture, second])
      for (const event of [
        session.before,
        session.outgoing,
        session.incoming,
        session.completed,
        session.failed,
      ])
        expect(event).toBeNull();
  });
  it("uses destination origins for main-frame threat policies rather than the previous tab's origin", async () => {
    settings.malware = true;
    settings.filterLists.push("threat-intelligence");
    await shield.refresh("threat-intelligence");
    fixture.request(1, "https://known-threat.test/login", "mainFrame");
    expect(shield.getState("https://known-threat.test").site!.blocked).toBe(1);
    expect(shield.getState("https://one.example.org").site!.blocked).toBe(0);
    expect(total().totals.malware).toBe(1);
    await shield.setSite("https://known-threat.test", { enabled: false });
    expect(
      fixture.request(2, "https://known-threat.test/login", "mainFrame").cancel,
    ).toBe(false);
  });
  it("bounds unresolved requests/cache/recent diagnostics without inventing outcomes for evicted requests", () => {
    for (let index = 0; index < 4200; index++)
      fixture.start(
        fixture.details(index, `https://ordinary.example.net/${index}`),
      );
    fixture.start(
      fixture.details(0, "https://ordinary.example.net/late-redirect"),
    );
    fixture.finish(0);
    fixture.finish(4199);
    expect(total().totals).toMatchObject({
      evaluated: 4200,
      allowed: 1,
      blocked: 0,
    });
    expect(total().unresolved).toBe(4199);
    expect(shield.getState().protection!.cache.entries).toBeLessThanOrEqual(
      4096,
    );
  });
  it("completes every request/header callback once even if an unexpected preference read fails", async () => {
    await shield.dispose();
    fixture = new ShieldSessionFixture();
    const preferences = vi.fn(() => settings);
    shield = new LunarShield(
      fixture.session,
      profile,
      preferences,
      (id) => urls.get(id) || "",
      () => {},
      () => "https://one.example.org",
      { compile: compiler },
    );
    await shield.ready;
    preferences.mockImplementation(() => {
      throw new Error("unexpected preferences failure");
    });
    expect(
      fixture.start(fixture.details(123, "https://ordinary.example.net/a")),
    ).toEqual({ cancel: false });
    const headers = fixture.headers(124, "https://remote.example.net/pixel");
    expect(headers.outgoing.Cookie).toBeDefined();
    expect(headers.incoming["Set-Cookie"]).toBeDefined();
  });
  it("keeps popup and cookie-header actions separate and applies exact-origin popup/cookie overrides", async () => {
    shield.recordPopup("https://one.example.org");
    expect(total().totals.popups).toBe(1);
    expect(shield.getState().stats.totalBlocked).toBe(0);
    const headers = fixture.headers(1, "https://remote.example.com/pixel");
    expect(headers.outgoing.Cookie).toBeUndefined();
    expect(headers.incoming["Set-Cookie"]).toBeUndefined();
    expect(total().totals.cookies).toBe(2);
    expect(total().totals.blocked).toBe(0);
    await shield.setSite("https://one.example.org", { enabled: false });
    expect(shield.shouldBlockPopup("https://one.example.org")).toBe(false);
    expect(shield.shouldBlockPopup("https://sub.one.example.org")).toBe(true);
    expect(shield.shouldBlockPopup("https://one.example.org:8443")).toBe(true);
    expect(
      fixture.headers(2, "https://remote.example.com/pixel").outgoing.Cookie,
    ).toBeDefined();
    expect(JSON.stringify(shield.getState())).not.toContain("never-log");
  });
});
describe("durable rules/policies, recovery and independent profile operations", () => {
  it("persists precise site overrides and custom CRUD, imports atomically and round-trips disabled rule backups", async () => {
    await shield.setSite("https://one.example.org", {
      allowedRequests: [
        { hostname: "ads.doubleclick.net", resourceType: "script" },
      ],
    });
    expect(fixture.request(1, "https://ads.doubleclick.net/a").cancel).toBe(
      false,
    );
    expect(
      fixture.request(2, "https://ads.doubleclick.net/a", "image").cancel,
    ).toBe(true);
    await shield.saveRule(null, {
      text: "||custom.example^$script",
      enabled: true,
      note: "personal",
    });
    const id = shield.getConfig().rules[0].id;
    expect(fixture.request(3, "https://custom.example/a").cancel).toBe(true);
    await shield.saveRule(id, {
      text: "||custom.example^$image",
      enabled: false,
      note: "disabled",
    });
    const exported = shield.exportRules();
    expect(JSON.parse(exported).rules[0]).toMatchObject({
      enabled: false,
      note: "disabled",
    });
    const previous = shield.getConfig();
    await expect(
      shield.importRules("||good.example^\nexample.org##+js(noop)"),
    ).rejects.toThrow(/Line 2/);
    expect(shield.getConfig()).toEqual(previous);
    await shield.deleteRule(id);
    await shield.importRules(exported);
    expect(shield.getConfig().rules).toHaveLength(1);
    expect(shield.getConfig().rules[0]).toMatchObject({
      enabled: false,
      text: "||custom.example^$image",
    });
    await shield.importRules(
      "! comment\n||new.example^$script\n||new.example^$script",
    );
    expect(shield.getConfig().rules).toHaveLength(2);
    await shield.dispose();
    fixture = new ShieldSessionFixture();
    shield = make();
    await shield.ready;
    expect(shield.getConfig().sites).toEqual(previous.sites);
    expect(shield.getConfig().rules).toHaveLength(2);
    expect(fixture.request(10, "https://new.example/a").cancel).toBe(true);
    expect(network.fetch).not.toHaveBeenCalled();
  });
  it("never activates a custom rule when its asynchronous profile save fails", async () => {
    const original = fs.promises.rename;
    vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith("shield-config.json")) throw new Error("EACCES");
      await original(from, to);
    });
    await expect(
      shield.saveRule(null, { text: "||unsaved.example^", enabled: true }),
    ).rejects.toThrow(/Could not save/);
    expect(shield.getConfig().rules).toEqual([]);
    expect(fixture.request(1, "https://unsaved.example/a").cancel).toBe(false);
  });
  it("recognizes genuine embed frames, protects player/authentication cookies and keeps YouTube toggles/reset independent", async () => {
    const embedded = fixture.details(
      1,
      "https://ads.doubleclick.net/a",
      "script",
      7,
      "https://www.youtube.com/embed/1",
      "https://one.example.org",
    );
    expect(fixture.start(embedded).cancel).toBe(true);
    fixture.finish(1, "net::ERR_BLOCKED_BY_CLIENT");
    expect(total().youtube).toMatchObject({ evaluated: 1, blocked: 1, ads: 1 });
    expect(shield.getState().protection!.youtube.recent[0].site).toBe(
      "https://one.example.org",
    );
    expect(
      fixture.headers(
        2,
        "https://accounts.google.com/login",
        "https://www.youtube.com/embed/1",
        "https://one.example.org",
      ).outgoing.Cookie,
    ).toBeDefined();
    expect(
      fixture.headers(
        3,
        "https://ads.doubleclick.net/p",
        "https://www.youtube.com/embed/1",
        "https://one.example.org",
      ).outgoing.Cookie,
    ).toBeUndefined();
    await shield.setYoutube(false);
    expect(fixture.start({ ...embedded, id: 4 }).cancel).toBe(false);
    fixture.finish(4);
    expect(fixture.request(5, "https://ads.doubleclick.net/a").cancel).toBe(
      true,
    );
    await shield.setSite("https://www.youtube.com", { enabled: false });
    await shield.setSite("https://other.example.net", { enabled: false });
    await shield.resetYoutube();
    expect(shield.getConfig().youtube.enabled).toBe(true);
    expect(shield.getConfig().sites.map((site) => site.origin)).toEqual([
      "https://other.example.net",
    ]);
    expect(total().youtube.blocked).toBe(1);
  });
  it("records only observed allowed endpoint errors as compatibility signals, never successful playback or removed-ad claims", () => {
    const details = fixture.details(
      1,
      "https://r1.googlevideo.com/videoplayback",
      "xhr",
      7,
      "https://www.youtube.com/watch?v=1",
      "https://www.youtube.com",
    );
    expect(fixture.start(details).cancel).toBe(false);
    fixture.finish(1, "net::ERR_CONNECTION_RESET");
    const youtube = shield.getState().protection!.youtube;
    expect(youtube.compatibility).toHaveLength(1);
    expect(youtube.compatibility[0]).toMatchObject({
      hostname: "r1.googlevideo.com",
      error: "net::ERR_CONNECTION_RESET",
    });
    expect(youtube.liveVerification).toBe("not-certified");
    fixture.start({ ...details, id: 2 });
    fixture.finish(2, "net::ERR_ABORTED");
    expect(shield.getState().protection!.youtube.compatibility).toHaveLength(1);
  });
  it("clears persisted aggregates and unresolved IDs without touching rules, settings or unrelated profile data", async () => {
    await shield.saveRule(null, { text: "||custom.example^", enabled: true });
    fixture.request(1, "https://ads.doubleclick.net/a");
    fixture.start(fixture.details(2, "https://ordinary.example.net/pending"));
    await shield.flush();
    await shield.clearHistory();
    fixture.finish(2);
    expect(total().totals).toMatchObject({
      evaluated: 0,
      blocked: 0,
      allowed: 0,
    });
    expect(shield.getConfig().rules).toHaveLength(1);
    expect(shield.getState().protection!.site!.recent).toEqual([]);
    fixture.request(3, "https://custom.example/a");
    expect(total().totals).toMatchObject({
      evaluated: 1,
      blocked: 1,
      custom: 1,
    });
  });
});
describe("maintained/custom list management with last-good caches", () => {
  it("performs conditional freshness checks, skips a fresh startup download and avoids recompiling unchanged data", async () => {
    settings.filterLists = ["easyprivacy"];
    await shield.refresh();
    expect(network.fetch).toHaveBeenCalledTimes(4);
    const calls = compiler.mock.calls.length;
    network.fetch.mockImplementation(async (_url, options) => {
      expect(options.headers).toMatchObject({
        "If-None-Match": '"fixture-v1"',
      });
      return new Response(null, { status: 304 });
    });
    await shield.refresh();
    expect(compiler.mock.calls).toHaveLength(calls);
    await shield.dispose();
    fixture = new ShieldSessionFixture();
    shield = make();
    await shield.ready;
    network.fetch.mockClear();
    await shield.updateDueLists();
    expect(network.fetch).not.toHaveBeenCalled();
    expect(fixture.request(1, "https://remote-tracker.test/a").cancel).toBe(
      true,
    );
  });
  it("retains every component and active rule after a partial source failure, then resets only the selected cache", async () => {
    settings.filterLists = ["easyprivacy"];
    await shield.refresh();
    const before = fs.readFileSync(
      path.join(profile, "shield-list-easyprivacy.json"),
      "utf8",
    );
    network.fetch.mockImplementation(
      async (url) =>
        new Response(
          url.endsWith("easyprivacy_trackingservers.txt")
            ? "<html>upstream failure</html>"
            : "||different.test^",
        ),
    );
    await shield.refresh();
    expect(
      shield.getState().lists.find((list) => list.id === "easyprivacy")?.error,
    ).toContain("raw filter text");
    expect(
      fs.readFileSync(
        path.join(profile, "shield-list-easyprivacy.json"),
        "utf8",
      ),
    ).toBe(before);
    expect(fixture.request(1, "https://remote-tracker.test/a").cancel).toBe(
      true,
    );
    await shield.resetList("easyprivacy");
    expect(fixture.request(2, "https://remote-tracker.test/a").cancel).toBe(
      false,
    );
    expect(shield.getState().lists[0].ruleCount).toBeGreaterThan(0);
    const backup = JSON.parse(
      fs.readFileSync(
        path.join(profile, "shield-list-easyprivacy.json.bak"),
        "utf8",
      ),
    );
    expect(backup.rules).toBe(0);
  });
  it("adds, separately enables, validates, updates and removes a trusted subscription and its cache without changing official lists", async () => {
    await expect(
      shield.addSubscription({ name: "Unsafe", url: "https://127.0.0.1/list" }),
    ).rejects.toThrow(/HTTPS filter URL/);
    await shield.addSubscription({
      name: "Trusted fixture",
      url: "https://api.github.com/repos/example/rules/contents/filters.txt",
    });
    const id = shield.getConfig().subscriptions[0].id;
    expect(settings.filterLists).toEqual(["lunar-core"]);
    expect(network.fetch).not.toHaveBeenCalled();
    settings.filterLists.push(id);
    await shield.refresh(id);
    expect(fixture.request(1, "https://remote-tracker.test/a").cancel).toBe(
      true,
    );
    expect(shield.getState().protection!.site!.recent[0].category).toBe(
      "custom",
    );
    expect(fs.existsSync(path.join(profile, `shield-list-${id}.json`))).toBe(
      true,
    );
    await shield.removeSubscription(id);
    expect(shield.getConfig().subscriptions).toEqual([]);
    expect(fs.existsSync(path.join(profile, `shield-list-${id}.json`))).toBe(
      false,
    );
    expect(fixture.request(2, "https://remote-tracker.test/a").cancel).toBe(
      false,
    );
    expect(
      shield.getState().lists.some((list) => list.id === "easyprivacy"),
    ).toBe(true);
  });
  it("migrates existing valid legacy caches locally without a download and resets custom caches when configuration is reset", async () => {
    await shield.dispose();
    fs.writeFileSync(
      path.join(profile, "filter-cache.json"),
      JSON.stringify({ domains: ["legacy-host.test"], updatedAt: 123 }),
    );
    fixture = new ShieldSessionFixture();
    settings.filterLists = ["stevenblack"];
    shield = make();
    await shield.ready;
    expect(fixture.request(1, "https://legacy-host.test/a").cancel).toBe(true);
    expect(network.fetch).not.toHaveBeenCalled();
    await shield.addSubscription({
      name: "Custom",
      url: "https://api.github.com/repos/example/rules/contents/filters.txt",
    });
    const id = shield.getConfig().subscriptions[0].id;
    await shield.refresh(id);
    await shield.resetConfig();
    expect(shield.getConfig().subscriptions).toEqual([]);
    expect(fs.existsSync(path.join(profile, `shield-list-${id}.json`))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(profile, "shield-list-stevenblack.json")),
    ).toBe(true);
  });
});
