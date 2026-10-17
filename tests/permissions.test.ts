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
