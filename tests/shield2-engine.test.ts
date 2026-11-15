import { describe, expect, it } from "vitest";
import {
  FilterEngine,
  compileSource,
  inspectNetworkList,
  validateNetworkRule,
  parseHostsList,
  FILTER_LIMIT_BYTES,
} from "../electron/blocker/filter-engine";
import { DEFAULT_SHIELD } from "../shared/defaults";
import {
  DEFAULT_SHIELD_CONFIG,
  youtubeEssential,
  youtubeHost,
  type ShieldConfig,
} from "../shared/shield";
import { requestSchemas } from "../shared/api";
import { trustedSubscriptionURL } from "../electron/blocker/sources";
const site = "https://shop.example.org";
const config = (): ShieldConfig => structuredClone(DEFAULT_SHIELD_CONFIG);
const match = (
  engine: FilterEngine,
  url = "https://ads.doubleclick.net/pixel",
  origin = site,
  type = "script",
  settings = DEFAULT_SHIELD,
) => engine.explain(url, origin, type, settings);
describe("Shield 2 indexed policies and deterministic precedence", () => {
  it("does not implicitly apply a parent-host exception to subdomains or an origin policy to a different port/scheme", () => {
    const engine = new FilterEngine();
    expect(
      match(engine, undefined, site, undefined, {
        ...DEFAULT_SHIELD,
        allowlist: ["example.org"],
      })?.blocked,
    ).toBe(true);
    expect(
      match(engine, undefined, site, undefined, {
        ...DEFAULT_SHIELD,
        allowlist: ["shop.example.org"],
      }),
    ).toBeNull();
    const saved = config();
    saved.sites.push({ origin: site, enabled: false });
    engine.configure(saved);
    expect(match(engine)).toBeNull();
    for (const origin of [
      "https://sub.shop.example.org",
      "http://shop.example.org",
      "https://shop.example.org:8443",
      "https://unrelated.example.org",
    ])
      expect(match(engine, undefined, origin)?.blocked).toBe(true);
  });
  it("gives exact host/resource site allowances precedence without allowing another resource, host or website", () => {
    const engine = new FilterEngine(),
      saved = config();
    saved.sites.push({
      origin: site,
      allowedRequests: [
        { hostname: "ads.doubleclick.net", resourceType: "script" },
      ],
    });
    saved.rules.push({
      id: "block",
      enabled: true,
      text: "||doubleclick.net^",
      note: "",
    });
    engine.configure(saved);
    expect(match(engine)).toMatchObject({
      blocked: false,
      excepted: true,
      source: "site-exception",
    });
    expect(match(engine, undefined, site, "image")).toMatchObject({
      blocked: true,
      source: "custom",
    });
    expect(match(engine, "https://other.doubleclick.net/p")).toMatchObject({
      blocked: true,
      source: "custom",
    });
    expect(match(engine, undefined, "https://other.example.org")).toMatchObject(
      { blocked: true, source: "custom" },
    );
    expect(
      match(engine, undefined, site, "script", {
        ...DEFAULT_SHIELD,
        enabled: false,
      }),
    ).toBeNull();
  });
  it("honors custom @@ exceptions, toggles and domain/resource/third-party constraints without blocking unmatched traffic", () => {
    const engine = new FilterEngine(),
      saved = config();
    saved.rules.push(
      {
        id: "one",
        text: "||collector.net/path$script,third-party,domain=shop.example.org|~safe.shop.example.org",
        enabled: true,
        note: "",
      },
      {
        id: "two",
        text: "@@||collector.net/path/allowed$script",
        enabled: true,
        note: "",
      },
      { id: "three", text: "@@||doubleclick.net^", enabled: true, note: "" },
    );
    engine.configure(saved);
    expect(match(engine, "https://collector.net/path/one")).toMatchObject({
      blocked: true,
      category: "custom",
    });
    for (const [url, origin, type] of [
      ["https://collector.net/path/allowed", site, "script"],
      ["https://collector.net/path/one", site, "image"],
      [
        "https://collector.net/path/one",
        "https://safe.shop.example.org",
        "script",
      ],
      ["https://collector.net/path/one", "https://collector.net", "script"],
      ["https://cdn.legitimate.net/library.js", site, "script"],
    ])
      expect(match(engine, url, origin, type)?.blocked || false).toBe(false);
    expect(match(engine)).toMatchObject({ blocked: false, source: "custom" });
    saved.rules[2].enabled = false;
    engine.configure(saved);
    expect(match(engine)?.blocked).toBe(true);
  });
  it("honors exceptions across enabled subscriptions while explicit custom blocks stay authoritative", () => {
    const engine = new FilterEngine();
    engine.setPrivacy("@@||doubleclick.net^$script");
    const settings = {
      ...DEFAULT_SHIELD,
      filterLists: ["lunar-core", "easyprivacy"],
    };
    expect(match(engine, undefined, site, "script", settings)).toMatchObject({
      blocked: false,
      source: "easyprivacy",
    });
    const saved = config();
    saved.rules.push({
      id: "custom",
      enabled: true,
      text: "||doubleclick.net^$script",
      note: "Explicit block",
    });
    engine.configure(saved);
    expect(match(engine, undefined, site, "script", settings)).toMatchObject({
      blocked: true,
      category: "custom",
    });
  });
  it("classifies known-threat matches distinctly, can block their documents and never infers malware from a mixed hosts list", () => {
    const engine = new FilterEngine(),
      compiled = compileSource("||known-threat.example^", "abp");
    engine.setCompiled("threat-intelligence", "malware", compiled.bytes);
    engine.setRemote(["mixed.example"]);
    const settings = {
      ...DEFAULT_SHIELD,
      malware: true,
      filterLists: ["threat-intelligence", "stevenblack", "lunar-core"],
    };
    expect(
      match(
        engine,
        "https://known-threat.example/login",
        site,
        "mainFrame",
        settings,
      ),
    ).toMatchObject({ blocked: true, category: "malware" });
    expect(
      match(engine, "https://known-threat.example/login", site, "mainFrame", {
        ...settings,
        malware: false,
      }),
    ).toBeNull();
    expect(
      match(engine, "https://mixed.example/p", site, "script", settings),
    ).toMatchObject({ blocked: true, category: "other" });
    expect(match(engine, undefined, site, "mainFrame", settings)).toBeNull();
  });
  it("invalidates bounded decisions after source, custom-rule, policy and global preference changes", () => {
    const engine = new FilterEngine();
    match(engine);
    match(engine);
    expect(engine.cacheInfo()).toMatchObject({
      entries: 1,
      hits: 1,
      misses: 1,
    });
    expect(
      match(engine, undefined, site, "script", {
        ...DEFAULT_SHIELD,
        ads: false,
      }),
    ).toBeNull();
    const saved = config();
    saved.sites.push({ origin: site, enabled: false });
    engine.configure(saved);
    expect(engine.cacheInfo().entries).toBe(0);
    expect(match(engine)).toBeNull();
    engine.configure(config());
    engine.setPrivacy("@@||doubleclick.net^");
    expect(engine.cacheInfo().entries).toBe(0);
    for (let i = 0; i < 4200; i++)
      match(engine, `https://ordinary.example.net/${i}`);
    expect(engine.cacheInfo().entries).toBe(4096);
    engine.removeRemote("easyprivacy");
    expect(engine.cacheInfo().entries).toBe(0);
    match(engine, `https://ordinary.example.net/${"a".repeat(9000)}`);
    expect(engine.cacheInfo().entries).toBe(0);
  });
  it("loads a compiled source with intact rule explanations and does not replace it with corrupt bytes", () => {
    const engine = new FilterEngine();
    const bytes = compileSource(
      "||collector.example^$script,third-party,domain=shop.example.org",
      "abp",
    ).bytes;
    engine.setCompiled("easyprivacy", "trackers", bytes);
    const settings = { ...DEFAULT_SHIELD, filterLists: ["easyprivacy"] };
    expect(
      match(engine, "https://collector.example/a", site, "script", settings),
    ).toMatchObject({
      blocked: true,
      rule: "||collector.example^$script,third-party,domain=shop.example.org",
    });
    expect(() =>
      engine.setCompiled("easyprivacy", "trackers", new Uint8Array([1, 2, 3])),
    ).toThrow();
    expect(
      match(engine, "https://collector.example/a", site, "script", settings)
        ?.blocked,
    ).toBe(true);
  });
});
describe("conservative YouTube recognition and player policy (not live playback verification)", () => {
  it("recognizes genuine pages/embeds, not look-alikes, query strings or credentials", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=1",
      "https://m.youtube.com/shorts/1",
      "https://youtube-nocookie.com/embed/1",
      "https://youtu.be/1",
    ])
      expect(youtubeHost(url)).toBe(true);
    for (const url of [
      "https://youtube.com.attacker.test/watch",
      "https://notyoutube.com/",
      "https://example.com/?next=youtube.com",
      "https://youtube.com@attacker.test",
      "file://youtube.com",
      "javascript:youtube.com",
    ])
      expect(youtubeHost(url)).toBe(false);
  });
  it("protects third-party matching resources while preserving media, captions/player/account hosts even in strict mode", () => {
    const engine = new FilterEngine();
    engine.setPrivacy(
      "||googlevideo.com^\n||youtube.com^\n||accounts.google.com^\n||youtubei.googleapis.com^\n||ytimg.com^",
    );
    const settings = {
        ...DEFAULT_SHIELD,
        mode: "strict" as const,
        filterLists: ["lunar-core", "easyprivacy"],
      },
      youtube = "https://www.youtube.com";
    for (const [url, type] of [
      ["https://r1.googlevideo.com/videoplayback", "xhr"],
      ["https://r1.googlevideo.com/videoplayback", "media"],
      ["https://www.youtube.com/api/timedtext?v=1", "xhr"],
      ["https://accounts.google.com/ServiceLogin", "subFrame"],
      ["https://youtubei.googleapis.com/youtubei/v1/player", "xhr"],
      ["https://i.ytimg.com/vi/1/default.jpg", "image"],
      ["https://ads.doubleclick.net/segment", "media"],
    ]) {
      expect(youtubeEssential(url, type)).toBe(true);
      expect(
        match(engine, url, youtube, type, settings)?.blocked || false,
      ).toBe(false);
    }
    expect(match(engine, undefined, youtube, "script", settings)).toMatchObject(
      { blocked: true, category: "ads", thirdParty: true },
    );
    expect(
      match(
        engine,
        "https://www.google-analytics.com/collect",
        youtube,
        "xhr",
        settings,
      ),
    ).toMatchObject({ blocked: true, category: "trackers" });
    expect(
      match(
        engine,
        "https://cdn.innocent.net/player.js",
        youtube,
        "script",
        settings,
      ),
    ).toBeNull();
  });
  it("keeps the profile separate from unrelated websites and leaves explicit custom/threat choices intact", () => {
    const engine = new FilterEngine(),
      saved = config();
    saved.youtube.enabled = false;
    engine.configure(saved);
    expect(match(engine, undefined, "https://www.youtube.com")).toBeNull();
    expect(match(engine)?.blocked).toBe(true);
    expect(
      engine.explain(
        "https://ads.doubleclick.net/x",
        site,
        "script",
        DEFAULT_SHIELD,
        true,
      ),
    ).toBeNull();
    saved.rules.push({
      id: "explicit",
      text: "||googlevideo.com^",
      enabled: true,
      note: "User override",
    });
    engine.configure(saved);
    expect(
      match(
        engine,
        "https://r1.googlevideo.com/a",
        "https://www.youtube.com",
        "media",
      ),
    ).toMatchObject({ blocked: true, source: "custom" });
  });
});
describe("bounded network-data inputs and IPC surface", () => {
  it("validates supported rules, accounts for exclusions and rejects scripts, rewriting, unsafe regex and oversized UTF-8 input", () => {
    const parsed = inspectNetworkList(
      "! comment\n[Adblock Plus]\n||tracker.net^$script\n@@||tracker.net/allowed\nsite.net##.ad\n||bad.net^$redirect=noopjs\n/^https?:.*$/\nnot a filter with spaces",
    );
    expect(parsed.rules).toEqual([
      "||tracker.net^$script",
      "@@||tracker.net/allowed",
    ]);
    expect(parsed.rejected).toBe(4);
    expect(parsed.ignored).toBe(2);
    for (const text of [
      "example.com##+js(noop)",
      "||x.net^$csp=script-src 'none'",
      "||x.net^$removeparam=a",
      "/^(a+)+$/",
      "||x.net^\n||y.net^",
      `||x.net/${"é".repeat(600)}`,
    ])
      expect(validateNetworkRule(text)).toBeTypeOf("string");
    expect(
      validateNetworkRule("@@||safe.example^$image,~third-party"),
    ).toBeNull();
    expect(() =>
      inspectNetworkList("é".repeat(FILTER_LIMIT_BYTES / 2 + 1)),
    ).toThrow(/8 MiB/);
    expect(() => inspectNetworkList("<html>error</html>")).toThrow(/Invalid/);
    expect(() =>
      parseHostsList("127.0.0.1 localhost\n::1 localhost"),
    ).toThrow();
  });
  it("limits subscriptions to deliberate public raw HTTPS sources, never credentials/internal services or redirects", () => {
    expect(
      trustedSubscriptionURL(
        "https://api.github.com/repos/owner/list/contents/rules.txt?ref=v1",
      ),
    ).toContain("ref=v1");
    for (const value of [
      "file:///etc/passwd",
      "http://easylist.to/a",
      "https://127.0.0.1/a",
      "https://intranet/a",
      "https://api.github.com/user",
      "https://api.github.com/repos/o/r/contents/x?access_token=secret",
      "https://user:secret@easylist.to/list.txt",
      "https://easylist.to:8443/a",
      "https://easylist.to/a#fragment",
      "https://evil.easylist.to/a",
    ])
      expect(() => trustedSubscriptionURL(value)).toThrow();
  });
  it("rejects arbitrary fields, paths in exact origins, fabricated permissions and unsupported deletion ranges before privileged work", () => {
    const valid = requestSchemas["shield:site"].safeParse([
      site,
      { enabled: false },
    ]);
    expect(valid.success).toBe(true);
    for (const args of [
      [`${site}/path`, { enabled: false }],
      [site, { shell: "run" }],
      [
        site,
        { allowedRequests: [{ hostname: "x.test/path", resourceType: "*" }] },
      ],
    ])
      expect(requestSchemas["shield:site"].safeParse(args).success).toBe(false);
    expect(
      requestSchemas["permissions:set"].safeParse([
        site,
        "display-capture",
        "allow",
      ]).success,
    ).toBe(false);
    expect(
      requestSchemas["privacy:clearSelected"].safeParse([
        { range: "hour", types: ["cookies"] },
      ]).success,
    ).toBe(false);
    expect(
      requestSchemas["shield:youtube"].safeParse([
        { type: "set", enabled: true, command: "run" },
      ]).success,
    ).toBe(false);
    expect(
      requestSchemas["shield:exportRules"].safeParse(["/private/path"]).success,
    ).toBe(false);
  });
});
