import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, Session, WebContents } from "electron";
import type { PermissionEntry } from "../shared/shield";
const dialogs = vi.hoisted(() => ({
  show: vi.fn<() => Promise<{ response: number }>>(),
}));
vi.mock("electron", () => ({
  dialog: { showMessageBox: dialogs.show },
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
  entries: PermissionEntry[],
  url: string,
  active: boolean;
const save =
  vi.fn<
    (
      origin: string,
      permission: PermissionEntry["permission"],
      mode: PermissionEntry["mode"],
    ) => Promise<void>
  >();
const reset = vi.fn<(origin?: string) => Promise<void>>();
const wc = {
  id: 7,
  isDestroyed: () => false,
  getURL: () => url,
} as WebContents;
const create = () =>
  new PermissionManager(
    {
      setPermissionRequestHandler: (handler: RequestHandler) => {
        request = handler;
      },
      setPermissionCheckHandler: (handler: CheckHandler) => {
        check = handler;
      },
      setDevicePermissionHandler: () => {},
      setDisplayMediaRequestHandler: () => {},
    } as unknown as Session,
    {
      isDestroyed: () => false,
      isVisible: () => true,
      isMinimized: () => false,
    } as BrowserWindow,
    () => active,
    { get: () => structuredClone(entries), set: save, reset },
  );
beforeEach(() => {
  entries = [];
  active = true;
  url = "https://secure.example.org/page";
  dialogs.show.mockReset().mockResolvedValue({ response: 0 });
  save.mockReset().mockImplementation(async (origin, permission, mode) => {
    entries = entries.filter(
      (entry) => entry.origin !== origin || entry.permission !== permission,
    );
    if (mode !== "ask") entries.push({ origin, permission, mode });
  });
  reset.mockReset().mockImplementation(async (origin) => {
    entries = origin ? entries.filter((entry) => entry.origin !== origin) : [];
  });
  manager = create();
});
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
describe("native-confirmed persisted Ask/Allow/Block policies", () => {
  it("preserves user-activated delegated fullscreen for a visible secure embed without granting sensitive iframe permissions", () => {
    const result = vi.fn<(allowed: boolean) => void>();
    expect(
      check(wc, "fullscreen", "https://www.youtube.com", {
        isMainFrame: false,
      }),
    ).toBe(true);
    request(wc, "fullscreen", result, {
      isMainFrame: false,
      requestingUrl: "https://www.youtube.com/embed/fixture",
    });
    expect(result).toHaveBeenLastCalledWith(true);
    for (const permission of [
      "notifications",
      "clipboard-read",
      "media",
    ] as const)
      expect(
        check(wc, permission, "https://www.youtube.com", {
          isMainFrame: false,
          mediaType: "video",
        }),
      ).toBe(false);
    expect(
      check(wc, "fullscreen", "http://insecure.example.net", {
        isMainFrame: false,
      }),
    ).toBe(false);
    active = false;
    expect(
      check(wc, "fullscreen", "https://www.youtube.com", {
        isMainFrame: false,
      }),
    ).toBe(false);
    active = true;
    url = "http://insecure.example.org";
    expect(
      check(wc, "fullscreen", "https://www.youtube.com", {
        isMainFrame: false,
      }),
    ).toBe(false);
    expect(dialogs.show).not.toHaveBeenCalled();
  });
  it("requires explicit native confirmation for persistent Allow and grants only that exact eligible main-frame origin", async () => {
    await expect(
      manager.setSitePolicy(
        "https://secure.example.org",
        "media:video",
        "allow",
      ),
    ).rejects.toThrow(/cancelled/);
    expect(save).not.toHaveBeenCalled();
    expect(manager.status(url).grants).toEqual([]);
    dialogs.show.mockResolvedValue({ response: 1 });
    await manager.setSitePolicy(
      "https://secure.example.org",
      "media:video",
      "allow",
    );
    expect(dialogs.show).toHaveBeenCalledTimes(2);
    expect(entries).toEqual([
      {
        origin: "https://secure.example.org",
        permission: "media:video",
        mode: "allow",
      },
    ]);
    expect(
      check(wc, "media", "https://secure.example.org", {
        isMainFrame: true,
        mediaType: "video",
      }),
    ).toBe(true);
    expect(
      check(wc, "media", "https://secure.example.org", {
        isMainFrame: true,
        mediaType: "audio",
      }),
    ).toBe(false);
    expect(
      check(wc, "media", "https://secure.example.org", {
        isMainFrame: false,
        mediaType: "video",
      }),
    ).toBe(false);
    expect(
      check(wc, "media", "https://secure.example.org:8443", {
        isMainFrame: true,
        mediaType: "video",
      }),
    ).toBe(false);
    active = false;
    expect(
      check(wc, "media", "https://secure.example.org", {
        isMainFrame: true,
        mediaType: "video",
      }),
    ).toBe(false);
  });
  it("blocks without a prompt, restores Ask without silently granting and does not affect another origin", async () => {
    entries.push({
      origin: "https://unrelated.example.com",
      permission: "notifications",
      mode: "allow",
    });
    await manager.setSitePolicy(url, "notifications", "block");
    const result = vi.fn<(allowed: boolean) => void>();
    request(wc, "notifications", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    expect(result).toHaveBeenCalledWith(false);
    expect(dialogs.show).not.toHaveBeenCalled();
    await manager.setSitePolicy(url, "notifications", "ask");
    expect(
      check(wc, "notifications", "https://secure.example.org", {
        isMainFrame: true,
      }),
    ).toBe(false);
    expect(entries).toEqual([
      {
        origin: "https://unrelated.example.com",
        permission: "notifications",
        mode: "allow",
      },
    ]);
    dialogs.show.mockResolvedValue({ response: 1 });
    request(wc, "notifications", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    await settle();
    expect(result).toHaveBeenLastCalledWith(true);
    expect(entries).toHaveLength(1);
  });
  it("invalidates an outstanding native request if a policy changes or the page switches before the answer", async () => {
    let answer!: (value: { response: number }) => void;
    dialogs.show.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const result = vi.fn<(allowed: boolean) => void>();
    request(wc, "clipboard-read", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    await manager.setSitePolicy(url, "clipboard-read", "block");
    answer({ response: 1 });
    await settle();
    expect(result).toHaveBeenLastCalledWith(false);
    await manager.setSitePolicy(url, "clipboard-read", "ask");
    request(wc, "clipboard-read", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    url = "https://other.example.com";
    answer({ response: 1 });
    await settle();
    expect(result).toHaveBeenLastCalledWith(false);
  });
  it("propagates a policy-save failure and never turns a failed remembered grant into a temporary grant", async () => {
    dialogs.show.mockResolvedValue({ response: 1 });
    save.mockRejectedValueOnce(new Error("profile unavailable"));
    await expect(
      manager.setSitePolicy(url, "geolocation", "allow"),
    ).rejects.toThrow("profile unavailable");
    expect(manager.status(url).grants).toEqual([]);
    expect(
      check(wc, "geolocation", "https://secure.example.org", {
        isMainFrame: true,
      }),
    ).toBe(false);
  });
  it("keeps previously confirmed saved choices across manager disposal, but invalidates unanswered requests", async () => {
    dialogs.show.mockResolvedValue({ response: 1 });
    await manager.setSitePolicy(url, "notifications", "allow");
    let answer!: (value: { response: number }) => void;
    dialogs.show.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const result = vi.fn<(allowed: boolean) => void>();
    request(wc, "geolocation", result, {
      isMainFrame: true,
      requestingUrl: url,
    });
    manager.dispose();
    answer({ response: 1 });
    await settle();
    expect(result).toHaveBeenLastCalledWith(false);
    expect(entries).toHaveLength(1);
    expect(reset).not.toHaveBeenCalled();
    manager = create();
    expect(
      check(wc, "notifications", "https://secure.example.org", {
        isMainFrame: true,
      }),
    ).toBe(true);
  });
  it("resets only genuine YouTube-origin policies and rejects insecure or unsupported sensitive configurations", async () => {
    entries.push(
      {
        origin: "https://www.youtube.com",
        permission: "media:audio",
        mode: "allow",
      },
      {
        origin: "https://youtube.com.attacker.test",
        permission: "media:audio",
        mode: "block",
      },
    );
    const { youtubeHost } = await import("../shared/shield");
    await manager.resetMatching(youtubeHost);
    expect(entries).toEqual([
      {
        origin: "https://youtube.com.attacker.test",
        permission: "media:audio",
        mode: "block",
      },
    ]);
    await expect(
      manager.setSitePolicy(
        "http://insecure.example.org",
        "notifications",
        "allow",
      ),
    ).rejects.toThrow(/secure/);
    await expect(
      manager.setSitePolicy(url, "display-capture" as "notifications", "allow"),
    ).rejects.toThrow();
    expect(dialogs.show).not.toHaveBeenCalled();
  });
});
