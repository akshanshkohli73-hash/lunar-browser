import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "electron";
import { DEFAULT_SHIELD } from "../shared/defaults";
import type { ShieldSettings } from "../electron/types";
const network = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, options: RequestInit) => Promise<Response>>(),
}));
vi.mock("electron", () => ({ net: { fetch: network.fetch } }));
const { LunarShield } = await import("../electron/blocker/shield");
type Details = { url: string; webContentsId: number; resourceType: string };
type Decision = { cancel?: boolean; redirectURL?: string };
type HeaderDetails = Details & {
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string[]>;
};
let requestFilter: unknown;
let callback:
    ((details: Details, complete: (result: Decision) => void) => void) | null,
  beforeHeaders:
    | ((
        details: HeaderDetails,
        complete: (result: { requestHeaders: Record<string, string> }) => void,
      ) => void)
    | null,
  afterHeaders:
    | ((
        details: HeaderDetails,
        complete: (result: {
          responseHeaders: Record<string, string[]>;
        }) => void,
      ) => void)
    | null,
  profile: string,
  settings: ShieldSettings,
  shield: InstanceType<typeof LunarShield>;
const session = () =>
  ({
    webRequest: {
      onBeforeSendHeaders: (filter: unknown, handler: typeof beforeHeaders) => {
        beforeHeaders = filter === null ? null : handler;
      },
      onHeadersReceived: (filter: unknown, handler: typeof afterHeaders) => {
        afterHeaders = filter === null ? null : handler;
      },
      onBeforeRequest: (filter: unknown, handler: typeof callback) => {
        requestFilter = filter;
        callback = filter === null ? null : handler;
      },
    },
  }) as unknown as Session;
const create = () =>
  new LunarShield(
    session(),
    profile,
    () => settings,
    () => "https://example.com",
    () => {},
    () => "https://example.com",
  );
const fixtures = async (url: string) =>
  new Response(
    url.includes("StevenBlack")
      ? "0.0.0.0 remote-tracker.test\n"
      : url.endsWith("easyprivacy_allowlist.txt")
        ? "@@||privacy-tracker.net/allowed.js$script"
        : "||privacy-tracker.net^$script,third-party",
  );
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield-"));
  settings = structuredClone(DEFAULT_SHIELD);
  network.fetch.mockReset().mockImplementation(fixtures);
  shield = create();
});
afterEach(() => {
  shield.dispose();
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});
const intercept = (url: string, resourceType = "script"): Decision => {
  let decision: Decision | undefined;
  callback!({ url, webContentsId: 7, resourceType }, (result) => {
    decision = result;
  });
  if (!decision)
    throw new Error("Electron's completion callback was not invoked.");
  return decision;
};
const request = (url: string) => intercept(url).cancel ?? false;
const headers = (url = "https://remote.example.net/pixel", type = "image") => ({
  url,
  resourceType: type,
  webContentsId: 7,
  requestHeaders: {
    cOoKiE: "session=secret",
    Authorization: "unrelated",
    Accept: "image/*",
  },
  responseHeaders: {
    "sEt-CoOkIe": ["session=secret; Secure; HttpOnly"],
    "Content-Type": ["image/png"],
  },
});
describe("Shield interception and real cache state", () => {
  it("passes actual cancel decisions to Electron, records bounded rule reasons without request paths/queries and honors off/allowlist", () => {
    expect(
      request("https://ads.doubleclick.net/request?private-query=value"),
    ).toBe(true);
    expect(shield.getState().stats).toMatchObject({
      adsBlocked: 1,
      totalBlocked: 1,
    });
    expect(shield.getState().site).toMatchObject({
      hostname: "example.com",
      blocked: 1,
      recent: [
        {
          hostname: "ads.doubleclick.net",
          source: "lunar-core",
          rule: "||doubleclick.net^",
        },
      ],
    });
    expect(JSON.stringify(shield.getState().site)).not.toContain(
      "private-query",
    );
    expect(requestFilter).toEqual({
      urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"],
    });
    expect(intercept("wss://ads.doubleclick.net/stream", "webSocket")).toEqual({
      cancel: true,
    });
    for (let i = 0; i < 80; i++)
      expect(request(`https://node${i}.doubleclick.net/pixel`)).toBe(true);
    expect(shield.getState().site?.recent).toHaveLength(20);
    expect(shield.getState().site?.recent[0].hostname).toBe(
      "node79.doubleclick.net",
    );
    expect(shield.getState().site?.recent[19].hostname).toBe(
      "node60.doubleclick.net",
    );
    settings.allowlist = ["example.com"];
    expect(request("https://ads.doubleclick.net/request")).toBe(false);
    settings.allowlist = [];
    settings.enabled = false;
    expect(request("https://ads.doubleclick.net/request")).toBe(false);
    expect(request("https://example.org/ordinary-script.js")).toBe(false);
    expect(shield.getState().stats.totalBlocked).toBe(82);
    shield.clearSiteDiagnostics("https://example.com");
    expect(shield.getState().site?.recent).toEqual([]);
  });
  it("activates fetched host rules only after a successful validated write and retains them after failure", async () => {
    settings.filterLists = ["stevenblack"];
    expect(shield.getState().lists[1].error).toContain("Not downloaded");
    await shield.refresh();
    expect(shield.getState().lists[1].ruleCount).toBe(1);
    expect(request("https://remote-tracker.test/x")).toBe(true);
    network.fetch.mockResolvedValueOnce(
      new Response("unavailable", { status: 503 }),
    );
    await shield.refresh();
    expect(shield.getState().lists[1].error).toContain("503");
    expect(request("https://remote-tracker.test/y")).toBe(true);
    expect(fs.existsSync(path.join(profile, "filter-cache.json"))).toBe(true);
  });
  it("uses the disclosed EasyPrivacy subset, respects its exceptions, reuses its cache after restart and retains it after invalid/oversized updates", async () => {
    settings.filterLists = ["easyprivacy"];
    await shield.refresh();
    expect(network.fetch).toHaveBeenCalledTimes(4);
    expect(
      network.fetch.mock.calls.every(
        ([url, options]) =>
          String(url).startsWith(
            "https://api.github.com/repos/easylist/easylist/contents/easyprivacy/",
          ) &&
          options.redirect === "error" &&
          options.credentials === "omit" &&
          options.referrerPolicy === "no-referrer",
      ),
    ).toBe(true);
    expect(request("https://privacy-tracker.net/a.js")).toBe(true);
    expect(request("https://privacy-tracker.net/allowed.js")).toBe(false);
    const cached = fs.readFileSync(
      path.join(profile, "privacy-filter-cache.json"),
      "utf8",
    );
    shield.dispose();
    shield = create();
    expect(request("https://privacy-tracker.net/another.js")).toBe(true);
    expect(network.fetch).toHaveBeenCalledTimes(4);
    network.fetch.mockImplementation(
      async () => new Response("<html>not a list</html>"),
    );
    await shield.refresh();
    expect(shield.getState().lists[2].error).toContain("Invalid");
    expect(request("https://privacy-tracker.net/a.js")).toBe(true);
    network.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "API returned JSON, not filter text" }),
      ),
    );
    await shield.refresh();
    expect(shield.getState().lists[2].error).toContain("Invalid");
    expect(request("https://privacy-tracker.net/a.js")).toBe(true);
    network.fetch.mockImplementation(
      async () =>
        new Response("tiny", { headers: { "Content-Length": "999999999" } }),
    );
    await shield.refresh();
    expect(shield.getState().lists[2].error).toContain("size limit");
    expect(
      fs.readFileSync(path.join(profile, "privacy-filter-cache.json"), "utf8"),
    ).toBe(cached);
  });
  it("does not replace active rules if saving an update fails", async () => {
    settings.filterLists = ["easyprivacy"];
    await shield.refresh();
    const rename = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(to).endsWith("privacy-filter-cache.json"))
        throw new Error("EACCES");
      return rename(from, to);
    });
    network.fetch.mockImplementation(
      async () => new Response("||new-tracker.net^$script"),
    );
    await shield.refresh();
    expect(shield.getState().lists[2].error).toContain("Could not save");
    expect(request("https://privacy-tracker.net/a.js")).toBe(true);
    expect(request("https://new-tracker.net/a.js")).toBe(false);
  });
  it("never downloads automatically and shares one explicit concurrent refresh operation", async () => {
    expect(network.fetch).not.toHaveBeenCalled();
    await expect(shield.refresh()).rejects.toThrow(
      "Select a maintained source",
    );
    expect(network.fetch).not.toHaveBeenCalled();
    settings.filterLists = ["easyprivacy"];
    const one = shield.refresh(),
      two = shield.refresh();
    expect(one).toBe(two);
    await one;
    expect(network.fetch).toHaveBeenCalledTimes(4);
  });
});
describe("scoped network privacy policies", () => {
  it("strips third-party Cookie/Set-Cookie case-insensitively without altering other headers or retaining values", () => {
    const details = headers();
    let outgoing: Record<string, string> = {},
      incoming: Record<string, string[]> = {};
    beforeHeaders!(details, (result) => {
      outgoing = result.requestHeaders;
    });
    afterHeaders!(details, (result) => {
      incoming = result.responseHeaders;
    });
    expect(outgoing).toEqual({ Authorization: "unrelated", Accept: "image/*" });
    expect(incoming).toEqual({ "Content-Type": ["image/png"] });
    expect(details.requestHeaders.cOoKiE).toBe("session=secret");
    expect(shield.getState().site?.cookies).toBe(2);
    expect(JSON.stringify(shield.getState())).not.toContain("secret");
    expect(shield.getState().stats.totalBlocked).toBe(0);
  });
  it("keeps first-party and main-frame cookies and respects per-site/global policy opt-outs", () => {
    for (const details of [
      headers("https://media.example.com/image"),
      headers("https://remote.example.net/", "mainFrame"),
    ])
      beforeHeaders!(details, ({ requestHeaders }) =>
        expect(requestHeaders.cOoKiE).toBe("session=secret"),
      );
    settings.allowlist = ["example.com"];
    beforeHeaders!(headers(), ({ requestHeaders }) =>
      expect(requestHeaders.cOoKiE).toBe("session=secret"),
    );
    settings.allowlist = [];
    settings.enabled = false;
    beforeHeaders!(headers(), ({ requestHeaders }) =>
      expect(requestHeaders.cOoKiE).toBe("session=secret"),
    );
    settings.enabled = true;
    settings.blockThirdPartyCookies = false;
    afterHeaders!(headers(), ({ responseHeaders }) =>
      expect(responseHeaders["sEt-CoOkIe"]).toBeDefined(),
    );
  });
  it("upgrades only an opted-in eligible navigation and releases all three listeners on disposal", () => {
    expect(intercept("http://public.example.org/", "mainFrame")).toEqual({
      cancel: false,
    });
    settings.httpsUpgrades = true;
    expect(intercept("http://public.example.org/path", "mainFrame")).toEqual({
      redirectURL: "https://public.example.org/path",
    });
    expect(intercept("http://127.0.0.1/path", "mainFrame")).toEqual({
      cancel: false,
    });
    settings.allowlist = ["example.org"];
    expect(intercept("http://public.example.org/", "mainFrame")).toEqual({
      cancel: false,
    });
    shield.dispose();
    expect(callback).toBeNull();
    expect(beforeHeaders).toBeNull();
    expect(afterHeaders).toBeNull();
  });
});
