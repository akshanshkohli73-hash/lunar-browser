import type { Session } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  clearOriginSiteData,
  clearWebSessionData,
} from "../electron/services/site-data";
describe("native site-data request scoping (adapter test, not Chromium deletion proof)", () => {
  it("uses an origin-only filter, documented origin-in-all-contexts matching and explicit storage types", async () => {
    const web = {
      clearData: vi.fn<Session["clearData"]>().mockResolvedValue(),
    };
    await clearOriginSiteData(
      web,
      "https://sub.example.org:8443/private?not-sent=1#fragment",
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
    await expect(
      clearOriginSiteData(web, "file:///private/file"),
    ).rejects.toThrow("Only an HTTP(S)");
    await expect(
      clearOriginSiteData(web, "https://user:password@example.org"),
    ).rejects.toThrow("Only an HTTP(S)");
    expect(web.clearData).toHaveBeenCalledTimes(1);
  });
  it("clears all web-session storage, HTTP cache and cached HTTP authentication without touching the UI profile", async () => {
    const web = {
      clearStorageData: vi
        .fn<Session["clearStorageData"]>()
        .mockResolvedValue(),
      clearCache: vi.fn<Session["clearCache"]>().mockResolvedValue(),
      clearAuthCache: vi.fn<Session["clearAuthCache"]>().mockResolvedValue(),
    };
    await clearWebSessionData(web);
    expect(web.clearStorageData).toHaveBeenCalledExactlyOnceWith();
    expect(web.clearCache).toHaveBeenCalledExactlyOnceWith();
    expect(web.clearAuthCache).toHaveBeenCalledExactlyOnceWith();
  });
  it("propagates native failures so callers cannot report successful clearing", async () => {
    await expect(
      clearOriginSiteData(
        {
          clearData: vi
            .fn<Session["clearData"]>()
            .mockRejectedValue(new Error("Storage unavailable")),
        },
        "https://example.org/",
      ),
    ).rejects.toThrow("Storage unavailable");
    const web = {
      clearStorageData: vi
        .fn<Session["clearStorageData"]>()
        .mockRejectedValue(new Error("Clear failed")),
      clearCache: vi.fn<Session["clearCache"]>(),
      clearAuthCache: vi.fn<Session["clearAuthCache"]>(),
    };
    await expect(clearWebSessionData(web)).rejects.toThrow("Clear failed");
    expect(web.clearCache).not.toHaveBeenCalled();
    expect(web.clearAuthCache).not.toHaveBeenCalled();
  });
});
