import { describe, it, expect } from "vitest";
import {
  authorizeSender,
  permissionKind,
  secureOrigin,
} from "../electron/security/policy";
import { requestSchemas } from "../shared/api";
import {
  FilterEngine,
  parseHostsList,
} from "../electron/blocker/filter-engine";
import { DEFAULT_SHIELD } from "../shared/defaults";
describe("IPC and permissions", () => {
  const sender = {
    senderId: 1,
    shellId: 1,
    isMainFrame: true,
    frameUrl: "file:///app/dist/index.html",
    entryUrl: "file:///app/dist/index.html",
  };
  it("requires the actual shell main frame at its exact entry, not just a file: or matching origin", () => {
    expect(authorizeSender(sender)).toBe(true);
    expect(authorizeSender({ ...sender, senderId: 2 })).toBe(false);
    expect(authorizeSender({ ...sender, isMainFrame: false })).toBe(false);
    expect(authorizeSender({ ...sender, frameUrl: "file:///etc/passwd" })).toBe(
      false,
    );
    expect(
      authorizeSender({ ...sender, frameUrl: "https://example.com" }),
    ).toBe(false);
  });
  it("rejects malformed payloads before privileged operations", () => {
    expect(
      requestSchemas["workspace:layout"].safeParse([
        {
          tabId: "x",
          visible: true,
          bounds: { x: 0, y: 0, width: Infinity, height: 200 },
        },
      ]).success,
    ).toBe(false);
    expect(requestSchemas["tab:close"].safeParse(["../x"]).success).toBe(false);
    expect(requestSchemas["tab:close"].safeParse([null]).success).toBe(false);
    expect(
      requestSchemas["settings:update"].safeParse([
        { aiApiKey: "secret", __proto__: null },
      ]).success,
    ).toBe(false);
    expect(
      requestSchemas["extensions:toggle"].safeParse(["x", "yes"]).success,
    ).toBe(false);
  });
  it("never auto-grants camera, microphone, location, notifications or clipboard reads", () => {
    for (const permission of ["geolocation", "notifications", "clipboard-read"])
      expect(permissionKind(permission)).toBe("prompt");
    expect(permissionKind("media", ["audio", "video"])).toBe("prompt");
    expect(permissionKind("media", [])).toBe("deny");
    for (const permission of ["display-capture", "usb", "serial", "unknown"])
      expect(permissionKind(permission)).toBe("deny");
    expect(secureOrigin("http://example.com")).toBeNull();
    expect(secureOrigin("https://example.com/a")).toBe("https://example.com");
  });
});
describe("real filter decisions", () => {
  const engine = new FilterEngine();
  it("blocks matching subresources only while enabled and honors the top-level site allowlist", () => {
    const url = "https://ad.doubleclick.net/request";
    expect(
      engine.decide(url, "https://example.com", "script", DEFAULT_SHIELD),
    ).toBe("ads");
    expect(
      engine.decide(url, "https://example.com", "script", {
        ...DEFAULT_SHIELD,
        enabled: false,
      }),
    ).toBeNull();
    expect(
      engine.decide(url, "https://example.com", "script", {
        ...DEFAULT_SHIELD,
        allowlist: ["example.com"],
      }),
    ).toBeNull();
    expect(
      engine.decide(url, "https://notexample.com", "script", {
        ...DEFAULT_SHIELD,
        allowlist: ["example.com"],
      }),
    ).toBe("ads");
    expect(
      engine.decide(url, "https://example.com", "mainFrame", DEFAULT_SHIELD),
    ).toBeNull();
  });
  it("does not use broad URL substrings that break ordinary navigation", () => {
    expect(
      engine.decide(
        "https://example.org/ads/file?doubleclick.net",
        "https://example.com",
        "image",
        DEFAULT_SHIELD,
      ),
    ).toBeNull();
    expect(
      engine.decide(
        "https://notdoubleclick.net/a",
        "https://example.com",
        "script",
        DEFAULT_SHIELD,
      ),
    ).toBeNull();
  });
  it("parses maintained hosts files and uses an optional list, not executable filter syntax", () => {
    const domains = parseHostsList(
      "# comment\n0.0.0.0 track.example.org # tracker\n127.0.0.1 localhost\n0.0.0.0 track.example.org\n0.0.0.0 ads.example.org",
    );
    expect(domains).toEqual(["track.example.org", "ads.example.org"]);
    engine.setRemote(domains);
    expect(
      engine.decide(
        "https://track.example.org/p",
        "https://example.com",
        "fetch",
        { ...DEFAULT_SHIELD, filterLists: ["stevenblack"] },
      ),
    ).toBe("trackers");
    expect(() => parseHostsList("<html>an error page</html>")).toThrow();
  });
});
