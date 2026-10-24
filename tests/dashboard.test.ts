import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DASHBOARD,
  arrangeWidgets,
  createWidget,
  dashboardSchema,
  mediaIdSchema,
  weatherRequestSchema,
} from "../shared/dashboard";
import { StorageService } from "../electron/services/storage";
import {
  WallpaperStore,
  registerWallpaperProtocol,
  byteRange,
  detectMedia,
} from "../electron/services/wallpaper-store";
import { requestSchemas } from "../shared/api";
import { fetchWeather } from "../electron/services/weather";

describe("validated persistent dashboard", () => {
  it("moves and resizes cells without collisions; hidden cells do not consume space", () => {
    let widgets = structuredClone(DEFAULT_DASHBOARD.widgets);
    for (let step = 0; step < 80; step++) {
      const cell = widgets[step % widgets.length];
      widgets = arrangeWidgets(widgets, {
        ...cell,
        x: step % 9,
        y: step % 7,
        w: step % 2 ? 6 : 4,
      });
      expect(
        dashboardSchema.safeParse({ ...DEFAULT_DASHBOARD, widgets }).success,
      ).toBe(true);
    }
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        widgets: [createWidget("clock", "a"), createWidget("notes", "b")],
      }).success,
    ).toBe(false);
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        widgets: [
          createWidget("clock", "a"),
          { ...createWidget("notes", "b"), visible: false },
        ],
      }).success,
    ).toBe(true);
  });
  it("rejects duplicate IDs, unsafe links, invalid dates and arbitrary media paths", () => {
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        widgets: [
          createWidget("clock", "same"),
          { ...createWidget("search", "same"), y: 5 },
        ],
      }).success,
    ).toBe(false);
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        wallpaper: {
          ...DEFAULT_DASHBOARD.wallpaper,
          kind: "image",
          mediaId: "../secret.png",
        },
      }).success,
    ).toBe(false);
    expect(mediaIdSchema.safeParse(`${"a".repeat(36)}.png`).success).toBe(
      false,
    );
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        events: [
          { id: "same", date: "2026-10-17", title: "One" },
          { id: "same", date: "2026-10-18", title: "Two" },
        ],
      }).success,
    ).toBe(false);
    expect(
      requestSchemas["dashboard:update"].safeParse([{ unexpected: "value" }])
        .success,
    ).toBe(false);
    expect(
      dashboardSchema.safeParse({
        ...DEFAULT_DASHBOARD,
        events: [{ id: "event", date: "2026-02-30", title: "Invalid" }],
      }).success,
    ).toBe(false);
  });
  it("survives restart, keeps notes when a layout-only patch is applied and recovers corruption", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-dashboard-"));
    try {
      const store = new StorageService(dir);
      store.updateDashboard({
        note: "A local note",
        wallpaper: { ...DEFAULT_DASHBOARD.wallpaper, builtin: "rose" },
      });
      store.updateDashboard({ alignment: "wide" });
      const restarted = new StorageService(dir);
      expect(restarted.getDashboard()).toMatchObject({
        note: "A local note",
        alignment: "wide",
        wallpaper: { builtin: "rose" },
      });
      expect(() =>
        restarted.updateDashboard({
          widgets: [
            createWidget("clock", "duplicate"),
            createWidget("clock", "duplicate"),
          ],
        }),
      ).toThrow();
      fs.writeFileSync(path.join(dir, "dashboard.json"), "broken");
      const recovered = new StorageService(dir);
      expect(recovered.getDashboard()).toBeDefined();
      expect(recovered.warnings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
describe("profile-owned wallpapers", () => {
  it("copies only supported contents, serves byte ranges and refuses traversal/SVG", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-media-"));
    try {
      const store = new WallpaperStore(dir),
        file = path.join(dir, "selected.png");
      fs.writeFileSync(
        file,
        Buffer.concat([
          Buffer.from("89504e470d0a1a0a", "hex"),
          Buffer.alloc(100),
        ]),
      );
      const asset = await store.importSelectedFile(file);
      expect(asset.kind).toBe("image");
      expect(asset.id).not.toContain(dir);
      const response = store.response(
        new Request(`lunar-media://wallpaper/${asset.id}`, {
          headers: { Range: "bytes=0-7" },
        }),
      );
      expect(response.status).toBe(206);
      expect(Buffer.from(await response.arrayBuffer()).toString("hex")).toBe(
        "89504e470d0a1a0a",
      );
      expect(
        store.response(new Request("lunar-media://wallpaper/secret.txt"))
          .status,
      ).toBe(404);
      expect(
        store.response(
          new Request(`lunar-media://wallpaper/${asset.id}?path=secret`),
        ).status,
      ).toBe(403);
      expect(
        store.response(
          new Request(`lunar-media://wallpaper/${asset.id}`, {
            method: "POST",
          }),
        ).status,
      ).toBe(403);
      fs.writeFileSync(file, "<svg><script>bad()</script></svg>");
      await expect(store.importSelectedFile(file)).rejects.toThrow(
        /Supported wallpapers/,
      );
      expect(store.prune(asset.id)).toBe(0);
      fs.writeFileSync(
        file,
        Buffer.concat([
          Buffer.from("89504e470d0a1a0a", "hex"),
          Buffer.alloc(100),
        ]),
      );
      const interrupted = path.join(
        dir,
        "wallpapers",
        "12345678-1234-1234-1234-123456789012.png.tmp",
      );
      fs.writeFileSync(interrupted, "");
      fs.truncateSync(interrupted, 300 * 1024 * 1024);
      await expect(store.importSelectedFile(file)).rejects.toThrow("300 MB");
      expect(store.prune(asset.id)).toBe(1);
      await store.importSelectedFile(file); // Rejection must not poison the serialization queue.
      expect(store.prune(null)).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("validates range boundaries and media signatures", () => {
    expect(byteRange("bytes=-5", 10)).toEqual({ start: 5, end: 9 });
    expect(byteRange("bytes=2-999", 10)).toEqual({ start: 2, end: 9 });
    for (const range of [
      "bytes=10-",
      "bytes=3-2",
      "bytes=0-1,5-6",
      "bytes=-0",
      "nonsense",
    ])
      expect(byteRange(range, 10)).toBeNull();
    expect(detectMedia(Buffer.from("a fake video.mp4"))).toBeNull();
    expect(
      detectMedia(Buffer.from("000000186674797069736f6d00000000", "hex")),
    ).toBe("mp4");
  });
});
it("requires weather consent and validates real provider-shaped responses and errors", async () => {
  expect(
    weatherRequestSchema.safeParse({
      latitude: 0,
      longitude: 0,
      units: "celsius",
      consent: false,
    }).success,
  ).toBe(false);
  let destination = "";
  const result = await fetchWeather(
    { latitude: 28, longitude: 77, units: "celsius", consent: true },
    async (url, options) => {
      expect(options?.redirect).toBe("error");
      expect(options?.credentials).toBe("omit");
      expect(options?.referrerPolicy).toBe("no-referrer");
      destination = String(url);
      return new Response(
        JSON.stringify({
          current: {
            temperature_2m: 24,
            weather_code: 1,
            time: "2026-10-17T12:00",
          },
        }),
      );
    },
  );
  expect(new URL(destination).hostname).toBe("api.open-meteo.com");
  expect(result.temperature).toBe(24);
  await expect(
    fetchWeather(
      { latitude: 0, longitude: 0, units: "celsius", consent: true },
      async () => new Response("{}", { status: 429 }),
    ),
  ).rejects.toThrow("429");
});

it("serializes concurrent imports under the real file quota and can prune abandoned copies without deleting the active asset", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-media-quota-"));
  try {
    const store = new WallpaperStore(dir),
      selected = path.join(dir, "selected.png");
    fs.writeFileSync(
      selected,
      Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.alloc(100),
      ]),
    );
    const all = await Promise.allSettled(
      Array.from({ length: 21 }, () => store.importSelectedFile(selected)),
    );
    expect(all.filter((result) => result.status === "fulfilled")).toHaveLength(
      20,
    );
    expect(all.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    const first = all[0];
    if (first.status !== "fulfilled")
      throw new Error("Initial import failed unexpectedly.");
    const active = first.value.id;
    fs.writeFileSync(
      path.join(
        dir,
        "wallpapers",
        "12345678-1234-1234-1234-123456789012.png.tmp",
      ),
      "interrupted copy",
    );
    expect(store.prune(active)).toBe(20);
    const head = store.response(
      new Request(`lunar-media://wallpaper/${active}`, { method: "HEAD" }),
    );
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(head.headers.get("content-length")).toBe("108");
    expect(head.headers.get("x-content-type-options")).toBe("nosniff");
    expect(
      store.response({
        url: `lunar-media://user:pass@wallpaper/${active}`,
        method: "GET",
      } as Request).status,
    ).toBe(403);
    expect(
      store.response(new Request(`lunar-media://wallpaper:8888/${active}`))
        .status,
    ).toBe(403);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it("registers private media on first launch without unhandling an absent scheme, and safely replaces a previous handler", async () => {
  const proto = {
    isProtocolHandled: vi.fn().mockResolvedValue(false),
    unhandle: vi.fn(),
    handle: vi.fn(),
  };
  const store = { response: vi.fn(() => new Response("fixture")) };
  await registerWallpaperProtocol(proto, store);
  expect(proto.unhandle).not.toHaveBeenCalled();
  expect(proto.handle).toHaveBeenCalledTimes(1);
  const [scheme, handler] = proto.handle.mock.calls[0];
  expect(scheme).toBe("lunar-media");
  expect(
    await (
      handler(new Request("lunar-media://wallpaper/asset")) as Response
    ).text(),
  ).toBe("fixture");
  proto.isProtocolHandled.mockResolvedValue(true);
  await registerWallpaperProtocol(proto, store);
  expect(proto.unhandle).toHaveBeenCalledExactlyOnceWith("lunar-media");
  expect(proto.handle).toHaveBeenCalledTimes(2);
});
