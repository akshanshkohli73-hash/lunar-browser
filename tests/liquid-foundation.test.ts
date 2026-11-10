import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LIQUID,
  liquidSchema,
  packAtlas,
  springStep,
  morphEase,
  objectFitRect,
} from "../shared/liquid";
import {
  DEFAULT_DASHBOARD,
  dashboardSchema,
  dashboardPatchSchema,
  migrateDashboard,
} from "../shared/dashboard";
import { widgetGlassSchema } from "../shared/glass";
import { FrameClock } from "../src/liquid/FrameClock";
import {
  WallpaperStore,
  wallpaperTextureOrigin,
} from "../electron/services/wallpaper-store";

describe("Liquid foundation", () => {
  it("validates real engine controls without per-widget global overrides or patch defaults", () => {
    expect(liquidSchema.parse(DEFAULT_LIQUID)).toEqual(DEFAULT_LIQUID);
    for (const patch of [
      { quality: "ultra" },
      { edgeLensing: 1.01 },
      { specular: -1 },
      { curvature: 2 },
      { elasticity: 2 },
      { responsiveness: 0 },
      { unknown: 1 },
    ])
      expect(
        liquidSchema.safeParse({ ...DEFAULT_LIQUID, ...patch }).success,
      ).toBe(false);
    expect(
      widgetGlassSchema.safeParse({ liquid: DEFAULT_LIQUID }).success,
    ).toBe(false);
    expect(dashboardPatchSchema.parse({ note: "Only a note" })).toEqual({
      note: "Only a note",
    });
  });
  it.each(["simple", "balanced", "optical"] as const)(
    "preserves a v3 %s profile while adding only validated engine defaults",
    (performance) => {
      const current = structuredClone(DEFAULT_DASHBOARD);
      const { liquid: _liquid, ...glass } = current.glass;
      const old = {
        ...current,
        version: 3,
        glass: { ...glass, performance },
        note: "Keep me",
      };
      const snapshot = structuredClone(old);
      const result = dashboardSchema.parse(migrateDashboard(old));
      expect(result.version).toBe(4);
      const { liquid, ...retained } = result.glass;
      expect(retained).toEqual(old.glass);
      expect(liquid.quality).toBe(
        performance === "optical" ? "balanced" : "performance",
      );
      expect(result.widgets).toEqual(old.widgets);
      expect(result.wallpaper).toEqual(old.wallpaper);
      expect(result.note).toBe("Keep me");
      expect(old).toEqual(snapshot);
      expect(migrateDashboard(DEFAULT_DASHBOARD)).toBe(DEFAULT_DASHBOARD);
    },
  );
  it("packs bounded non-overlapping surfaces and scales down rather than exceeding texture/memory limits", () => {
    const rects = Array.from({ length: 20 }, () => ({
      x: 0,
      y: 0,
      width: 700,
      height: 350,
    }));
    const atlas = packAtlas(rects, 2, 2048, 2097152)!;
    expect(atlas).not.toBeNull();
    expect(atlas.width * atlas.height).toBeLessThanOrEqual(2097152);
    expect(atlas.tiles).toHaveLength(20);
    expect(atlas.scale).toBeLessThan(2);
    for (const tile of atlas.tiles) {
      expect(tile.x + tile.width).toBeLessThanOrEqual(atlas.width);
      expect(tile.y + tile.height).toBeLessThanOrEqual(atlas.height);
      for (const other of atlas.tiles)
        if (other.index !== tile.index)
          expect(
            tile.x >= other.x + other.width ||
              other.x >= tile.x + tile.width ||
              tile.y >= other.y + other.height ||
              other.y >= tile.y + tile.height,
          ).toBe(true);
    }
  });
  it("fits wide navigation bars alongside cards instead of rejecting every scale", () => {
    expect(
      packAtlas(
        [
          { x: 0, y: 0, width: 1280, height: 28 },
          { x: 0, y: 28, width: 1280, height: 64 },
          { x: 10, y: 100, width: 360, height: 200 },
        ],
        1,
        2048,
        4194304,
      )?.tiles,
    ).toHaveLength(3);
  });
  it("settles press/drag springs without oscillation, instability or permanent idle frames", () => {
    let state = { value: 1, velocity: 0 };
    let before = 1;
    for (let i = 0; i < 180; i++) {
      state = springStep(state, 0, i === 0 ? 10 : 1 / 60, 1.2);
      expect(state.value).toBeLessThanOrEqual(before);
      expect(state.value).toBeGreaterThanOrEqual(0);
      before = state.value;
    }
    expect(state).toEqual({ value: 0, velocity: 0 });
    expect(morphEase(0)).toBe(0);
    expect(morphEase(1)).toBe(1);
    expect(
      objectFitRect(
        { x: 10, y: 20, width: 200, height: 100 },
        100,
        100,
        "cover",
        "bottom",
      ),
    ).toEqual({ x: 10, y: -80, width: 200, height: 200 });
  });
  it("multiplexes requesters through exactly one RAF and cancels when idle", () => {
    const browser = new Map<number, FrameRequestCallback>();
    let id = 0;
    const request = vi.fn((callback: FrameRequestCallback) => {
      browser.set(++id, callback);
      return id;
    });
    const cancel = vi.fn((key: number) => browser.delete(key));
    const clock = new FrameClock(request, cancel),
      a = vi.fn(),
      b = vi.fn();
    clock.requestFrame(a);
    clock.requestFrame(b);
    expect(request).toHaveBeenCalledTimes(1);
    const fn = browser.get(1)!;
    browser.delete(1);
    fn(16);
    expect(a).toHaveBeenCalledWith(16);
    expect(b).toHaveBeenCalledWith(16);
    expect(browser.size).toBe(0);
    const pending = clock.requestFrame(a);
    clock.cancelFrame(pending);
    expect(browser.size).toBe(0);
    clock.dispose();
  });
});
it("serves origin-clean private textures only for the exact configured UI origin, never wildcard/credential access", async () => {
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "lunar-texture-origin-"),
  );
  try {
    const selected = path.join(profile, "selected.png");
    fs.writeFileSync(
      selected,
      Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(32)]),
    );
    const origin = wallpaperTextureOrigin(
      "file:///application/dist/renderer/index.html",
    );
    expect(origin).toBe("file://");
    expect(wallpaperTextureOrigin("http://localhost:5173/index.html")).toBe(
      "http://localhost:5173",
    );
    const store = new WallpaperStore(profile, origin);
    const asset = await store.importSelectedFile(selected);
    const url = `lunar-media://wallpaper/${asset.id}`;
    const allowed = store.response(
      new Request(url, { method: "HEAD", headers: { Origin: "file://" } }),
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("file://");
    expect(allowed.headers.get("vary")).toBe("Origin");
    expect(allowed.headers.has("access-control-allow-credentials")).toBe(false);
    for (const origin of [
      "https://example.com",
      "http://localhost:5173",
      "null",
    ])
      expect(
        store.response(new Request(url, { headers: { Origin: origin } }))
          .status,
      ).toBe(403);
    expect(
      store
        .response(new Request(url, { method: "HEAD" }))
        .headers.has("access-control-allow-origin"),
    ).toBe(false);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
