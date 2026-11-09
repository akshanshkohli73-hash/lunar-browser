import { describe, expect, it } from "vitest";
import {
  FilterEngine,
  httpsUpgrade,
  parseNetworkList,
  networkRequest,
} from "../electron/blocker/filter-engine";
import { DEFAULT_SHIELD } from "../shared/defaults";
import { requestSchemas } from "../shared/api";
const settings = { ...DEFAULT_SHIELD, filterLists: ["easyprivacy"] as const };
const configured = () => ({
  ...settings,
  filterLists: [...settings.filterLists],
});
describe("Ghostery network-only ABP integration", () => {
  it("honors resource types, third-party/domain options, exceptions and regular-expression network rules", () => {
    const engine = new FilterEngine();
    const parsed = parseNetworkList(
      [
        "[Adblock Plus 2.0]",
        "! Network-only test fixture",
        "||collector.net/track/$script,third-party,domain=example.org|~safe.example.org",
        "@@||collector.net/track/allowed.js$script,domain=example.org",
        "/^https?:\\/\\/analytics\\.example\\.net\\/v[0-9]+\\/pixel/$image,third-party",
      ].join("\n"),
    );
    expect(parsed.count).toBe(3);
    engine.setPrivacy(parsed.text);
    expect(
      engine.explain(
        "https://collector.net/track/blocked.js",
        "https://news.example.org",
        "script",
        configured(),
      ),
    ).toMatchObject({
      source: "easyprivacy",
      category: "trackers",
      rule: expect.stringContaining("third-party"),
    });
    expect(
      engine.decide(
        "https://collector.net/track/blocked.js",
        "https://news.example.org",
        "image",
        configured(),
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://collector.net/track/blocked.js",
        "https://unrelated.com",
        "script",
        configured(),
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://collector.net/track/blocked.js",
        "https://safe.example.org",
        "script",
        configured(),
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://collector.net/track/allowed.js",
        "https://example.org",
        "script",
        configured(),
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://analytics.example.net/v12/pixel",
        "https://example.org",
        "image",
        configured(),
      ),
    ).toBe("trackers");
    expect(
      engine.decide(
        "https://analytics.example.net/v12/pixel",
        "https://example.org",
        "mainFrame",
        configured(),
      ),
    ).toBeNull();
  });
  it("uses registrable-site classification, supports strict first-party matching and retains opt-outs", () => {
    expect(
      networkRequest(
        "https://metrics.example.co.uk/p",
        "https://shop.example.co.uk",
        "xhr",
      ).isThirdParty,
    ).toBe(false);
    const engine = new FilterEngine();
    engine.setPrivacy(
      parseNetworkList("||metrics.example.co.uk/beacon$xmlhttprequest").text,
    );
    const strict = { ...configured(), mode: "strict" as const };
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        configured(),
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        strict,
      ),
    ).toBe("trackers");
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        { ...strict, allowlist: ["example.co.uk"] },
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        { ...strict, trackers: false },
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        { ...strict, enabled: false },
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://metrics.example.co.uk/beacon",
        "https://shop.example.co.uk",
        "xhr",
        { ...strict, filterLists: ["lunar-core"] },
      ),
    ).toBeNull();
  });
  it("does not activate cosmetic, redirect, scriptlet, HTML, removeparam or CSP rules", () => {
    const unsupported =
      "example.org##.advert\nexample.org#?#div:has(.ad)\nexample.org##+js(noop)\n||example.org^$redirect=noopjs\n||example.org^$csp=script-src 'none'\n||example.org^$removeparam=track\nexample.org$$script";
    expect(() => parseNetworkList(unsupported)).toThrow(/No supported/);
    expect(() => parseNetworkList("<html>upstream error</html>")).toThrow(
      /Invalid/,
    );
    expect(
      parseNetworkList(unsupported + "\n||tracker.example.net^$script").count,
    ).toBe(1);
  });
});
describe("privacy policy inputs", () => {
  it("upgrades only eligible public HTTP URLs and never weakens HTTPS or local/custom-port navigation", () => {
    expect(httpsUpgrade("http://www.example.com/path?q=one#frag")).toBe(
      "https://www.example.com/path?q=one#frag",
    );
    for (const url of [
      "https://example.com/",
      "http://localhost/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://service.local/",
      "http://intranet/",
      "http://site.test/",
      "http://example.com:8000/",
      "http://user:pass@example.com/",
      "file:///secret",
      "nonsense",
    ])
      expect(httpsUpgrade(url)).toBeNull();
  });
  it("rejects unsafe origins, unsupported grants and arbitrary fields at the IPC boundary", () => {
    expect(
      requestSchemas["privacy:site"].safeParse(["https://example.org/page"])
        .success,
    ).toBe(true);
    for (const url of [
      "file:///secret",
      "lunar://settings",
      "https://user:pass@example.org",
      "javascript:alert(1)",
    ])
      expect(
        requestSchemas["privacy:clearOrigin"].safeParse([url]).success,
      ).toBe(false);
    expect(
      requestSchemas["permissions:denySite"].safeParse([
        "https://example.org",
        "display-capture",
        false,
      ]).success,
    ).toBe(false);
    expect(
      requestSchemas["wallpaper:choose"].safeParse(["/secret"]).success,
    ).toBe(false);
  });
});

it("applies WebSocket resource rules and accepts a valid IPv6 site opt-out without accepting paths", () => {
  const engine = new FilterEngine();
  engine.setPrivacy(
    parseNetworkList("||socket-collector.net^$websocket,third-party").text,
  );
  expect(
    engine.decide(
      "wss://socket-collector.net/stream",
      "https://example.org",
      "webSocket",
      configured(),
    ),
  ).toBe("trackers");
  expect(
    engine.decide(
      "https://socket-collector.net/script",
      "https://example.org",
      "script",
      configured(),
    ),
  ).toBeNull();
  expect(
    requestSchemas["settings:update"].safeParse([
      { shield: { ...DEFAULT_SHIELD, allowlist: ["[::1]"] } },
    ]).success,
  ).toBe(true);
  expect(
    requestSchemas["settings:update"].safeParse([
      { shield: { ...DEFAULT_SHIELD, allowlist: ["[::not-ip]/private"] } },
    ]).success,
  ).toBe(false);
});
