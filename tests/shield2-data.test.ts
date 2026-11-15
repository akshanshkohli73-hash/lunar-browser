import type { Session } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  clearSelectedData,
  historyCutoff,
  privacyOverview,
} from "../electron/services/privacy-data";
const webFixture = () => ({
  clearData: vi.fn<Session["clearData"]>().mockResolvedValue(),
  clearCache: vi.fn<Session["clearCache"]>().mockResolvedValue(),
});
describe("actual supported selected-data API mapping (not Chromium deletion proof)", () => {
  it("returns real cookie counts/cache bytes without exposing values or pretending to know per-site storage sizes", async () => {
    const overview = await privacyOverview(
      {
        cookies: {
          get: vi.fn().mockResolvedValue([
            {
              domain: ".example.org",
              name: "private",
              value: "secret-session",
              secure: true,
            },
            {
              domain: ".example.org",
              name: "private2",
              value: "secret-two",
              secure: true,
            },
            {
              domain: "another.net",
              name: "x",
              value: "secret",
              secure: false,
            },
          ]),
        } as unknown as Session["cookies"],
        getCacheSize: vi.fn<Session["getCacheSize"]>().mockResolvedValue(12345),
      },
      ["https://observed.example.com"],
      [],
    );
    expect(overview.cookies).toBe(3);
    expect(overview.cacheBytes).toBe(12345);
    expect(overview.cookieDomains).toEqual([
      { hostname: "example.org", cookies: 2 },
      { hostname: "another.net", cookies: 1 },
    ]);
    expect(overview.storageBytesAvailable).toBe(false);
    expect(overview.origins).toContain("https://observed.example.com");
    expect(JSON.stringify(overview)).not.toMatch(/secret|session|private/);
  });
  it("uses explicit selected-origin data types and documented cookie-domain semantics, without a fabricated since parameter", async () => {
    const web = webFixture(),
      history = { clear: vi.fn() };
    await clearSelectedData(
      web,
      {
        origin: "https://sub.example.org:8443",
        range: "all",
        types: ["cookies", "storage", "cache"],
      },
      history,
    );
    expect(web.clearData).toHaveBeenCalledExactlyOnceWith({
      origins: ["https://sub.example.org:8443"],
      originMatchingMode: "origin-in-all-contexts",
      dataTypes: [
        "cookies",
        "localStorage",
        "indexedDB",
        "serviceWorkers",
        "fileSystems",
        "cache",
      ],
    });
    expect(web.clearCache).not.toHaveBeenCalled();
    expect(history.clear).not.toHaveBeenCalled();
  });
  it("supports genuine time ranges for recorded history and all-time HTTP cache independently", async () => {
    const web = webFixture(),
      history = { clear: vi.fn() },
      now = Date.UTC(2026, 9, 15, 12);
    await clearSelectedData(
      web,
      { range: "hour", types: ["history"] },
      history,
      now,
    );
    expect(history.clear).toHaveBeenCalledWith(now - 3600000);
    expect(web.clearData).not.toHaveBeenCalled();
    expect(web.clearCache).not.toHaveBeenCalled();
    await clearSelectedData(
      web,
      { range: "all", types: ["cache"] },
      history,
      now,
    );
    expect(web.clearCache).toHaveBeenCalledExactlyOnceWith();
    expect(historyCutoff("all", now)).toBe(0);
    expect(historyCutoff("week", now)).toBe(now - 7 * 86400000);
  });
  it("rejects unsupported ranges, duplicates, unsafe origins and site-scoped history before invoking any native deletion", async () => {
    const web = webFixture(),
      history = { clear: vi.fn() };
    for (const request of [
      { range: "day", types: ["cookies"] },
      { range: "hour", types: ["cache"] },
      { origin: "https://example.org/path", range: "all", types: ["storage"] },
      { origin: "https://example.org", range: "all", types: ["history"] },
      { range: "all", types: ["cache", "cache"] },
    ])
      await expect(
        clearSelectedData(
          web,
          request as Parameters<typeof clearSelectedData>[1],
          history,
        ),
      ).rejects.toThrow();
    expect(web.clearData).not.toHaveBeenCalled();
    expect(web.clearCache).not.toHaveBeenCalled();
    expect(history.clear).not.toHaveBeenCalled();
  });
  it("propagates partial native failure rather than reporting successful clearing or deleting unrelated history", async () => {
    const web = webFixture(),
      history = { clear: vi.fn() };
    web.clearData.mockRejectedValueOnce(new Error("native deletion failed"));
    await expect(
      clearSelectedData(
        web,
        { range: "all", types: ["cookies", "cache", "history"] },
        history,
      ),
    ).rejects.toThrow("native deletion failed");
    expect(web.clearCache).not.toHaveBeenCalled();
    expect(history.clear).not.toHaveBeenCalled();
  });
});
