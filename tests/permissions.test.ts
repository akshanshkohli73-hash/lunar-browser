import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, Session, WebContents } from "electron";
const dialogs = vi.hoisted(() => ({ decision: 0, prompts: 0 }));
vi.mock("electron", () => ({
  dialog: {
    showMessageBox: async () => {
      dialogs.prompts++;
      return { response: dialogs.decision };
    },
  },
  shell: {},
}));
const { PermissionManager } = await import("../electron/security");
type RequestHandler = NonNullable<
  Parameters<Session["setPermissionRequestHandler"]>[0]
>;
type CheckHandler = NonNullable<
  Parameters<Session["setPermissionCheckHandler"]>[0]
>;
let request: RequestHandler,
  check: CheckHandler,
  manager: InstanceType<typeof PermissionManager>,
  url: string,
  active: boolean;
const wc = {
  id: 7,
  isDestroyed: () => false,
  getURL: () => url,
} as WebContents;
beforeEach(() => {
  dialogs.decision = 0;
  dialogs.prompts = 0;
  active = true;
  url = "https://example.com/page";
  const session = {
    setPermissionCheckHandler: (handler: CheckHandler) => {
      check = handler;
    },
    setPermissionRequestHandler: (handler: RequestHandler) => {
      request = handler;
    },
    setDevicePermissionHandler: () => {},
    setDisplayMediaRequestHandler: () => {},
  } as unknown as Session;
  manager = new PermissionManager(
    session,
    {
      isDestroyed: () => false,
      isVisible: () => true,
      isMinimized: () => false,
    } as BrowserWindow,
    () => active,
  );
});
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
describe("actual permission-handler integration", () => {
  it("requires confirmation for camera/microphone, records only approved media types, and resets grants", async () => {
    const result = vi.fn<(allowed: boolean) => void>();
    dialogs.decision = 1;
    request(wc, "media", result, {
      isMainFrame: true,
      requestingUrl: url,
      mediaTypes: ["audio"],
    });
    await settle();
    expect(result).toHaveBeenCalledWith(true);
    expect(dialogs.prompts).toBe(1);
    expect(
      check(wc, "media", "https://example.com", {
        isMainFrame: true,
        mediaType: "audio",
      }),
    ).toBe(true);
    expect(
      check(wc, "media", "https://example.com", {
        isMainFrame: true,
        mediaType: "video",
      }),
    ).toBe(false);
    manager.reset();
    expect(
      check(wc, "media", "https://example.com", {
        isMainFrame: true,
        mediaType: "audio",
      }),
    ).toBe(false);
  });
  it("denies untrusted frames, switched pages and unsupported permissions", async () => {
    const result = vi.fn<(allowed: boolean) => void>();
    dialogs.decision = 1;
    request(wc, "geolocation", result, {
      isMainFrame: false,
      requestingUrl: "https://other.com",
    });
    expect(result).toHaveBeenLastCalledWith(false);
    expect(dialogs.prompts).toBe(0);
    request(wc, "display-capture", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    expect(result).toHaveBeenLastCalledWith(false);
    request(wc, "clipboard-read", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    url = "https://other.com/page";
    await settle();
    expect(result).toHaveBeenLastCalledWith(false);
    active = false;
    request(wc, "notifications", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    expect(result).toHaveBeenLastCalledWith(false);
  });
  it("uses deny as the native default rather than granting notifications or clipboard silently", async () => {
    const result = vi.fn<(allowed: boolean) => void>();
    request(wc, "notifications", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    await settle();
    expect(dialogs.prompts).toBe(1);
    expect(result).toHaveBeenLastCalledWith(false);
    request(wc, "notifications", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    await settle();
    expect(dialogs.prompts).toBe(1);
    expect(
      check(wc, "notifications", "https://example.com", { isMainFrame: true }),
    ).toBe(false);
  });
});

it("reports and resets only the selected origin, and an Ask-again action never silently grants a permission", async () => {
  manager.denySite("https://example.com/page", "media:audio", true);
  expect(manager.status("https://example.com/other")).toEqual({
    grants: [],
    denials: ["media:audio"],
  });
  expect(manager.status("https://another.org")).toEqual({
    grants: [],
    denials: [],
  });
  const result = vi.fn<(allowed: boolean) => void>();
  request(wc, "media", result, {
    isMainFrame: true,
    requestingUrl: url,
    mediaTypes: ["audio"],
  });
  expect(result).toHaveBeenLastCalledWith(false);
  expect(dialogs.prompts).toBe(0);
  manager.denySite(url, "media:audio", false);
  expect(
    check(wc, "media", "https://example.com", {
      isMainFrame: true,
      mediaType: "audio",
    }),
  ).toBe(false);
  dialogs.decision = 1;
  request(wc, "media", result, {
    isMainFrame: true,
    requestingUrl: url,
    mediaTypes: ["audio"],
  });
  await settle();
  expect(manager.status(url).grants).toEqual(["media:audio"]);
  manager.denySite("https://another.org", "notifications", true);
  manager.resetSite(url);
  expect(manager.status(url)).toEqual({ grants: [], denials: [] });
  expect(manager.status("https://another.org").denials).toEqual([
    "notifications",
  ]);
});
it("does not offer configurable sensitive grants to insecure origins", () => {
  expect(() =>
    manager.denySite("http://public.example.org", "notifications", true),
  ).toThrow(/secure website/);
  expect(manager.status("file:///secret")).toEqual({ grants: [], denials: [] });
});
