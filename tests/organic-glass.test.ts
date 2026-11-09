import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLASS,
  chromeGlassMaterial,
  adaptiveGlassTone,
  glassDepth,
  glassSchema,
  resolveGlass,
  rgbAppearance,
  widgetGlassSchema,
} from "../shared/glass";
import {
  DEFAULT_DASHBOARD,
  dashboardPatchSchema,
  dashboardSchema,
  migrateDashboard,
} from "../shared/dashboard";
import { dockProximity, interpolate, lunarSpring } from "../shared/motion";
import { StorageService } from "../electron/services/storage";

describe("Organic Glass strict preferences and non-destructive migration", () => {
  it("validates real optical, color, elevation and motion ranges without adding patch defaults", () => {
    for (const patch of [
      { saturation: 0.49 },
      { saturation: 1.51 },
      { refraction: -0.1 },
      { refraction: 1.01 },
      { elevation: 1.6 },
      { hoverMotion: "yes" },
      { adaptive: 1 },
      { animationSpeed: 0.49 },
      { animationSpeed: 1.8 },
      { reducedMotion: 1 },
    ])
      expect(
        glassSchema.safeParse({ ...DEFAULT_GLASS, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    expect(
      glassSchema.parse({ ...DEFAULT_GLASS, performance: "optical" })
        .refraction,
    ).toBe(0.2);
    expect(widgetGlassSchema.parse({ refraction: 0.5, elevation: 0 })).toEqual({
      refraction: 0.5,
      elevation: 0,
    });
    for (const patch of [
      { hoverMotion: true },
      { animationSpeed: 1 },
      { reducedMotion: false },
      { adaptive: false },
    ])
      expect(widgetGlassSchema.safeParse(patch).success).toBe(false);
    expect(dashboardPatchSchema.parse({ note: "Only notes" })).toEqual({
      note: "Only notes",
    });
    expect(dashboardPatchSchema.parse({})).toEqual({});
    expect(
      dashboardSchema.safeParse({ ...DEFAULT_DASHBOARD, version: 2 }).success,
    ).toBe(false);
  });
  it.each(["simple", "balanced"] as const)(
    "migrates a real v2 %s profile, preserves every old token/override and survives a note-only save/restart",
    (quality) => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "lunar-organic-migration-"),
      );
      try {
        const legacy = structuredClone(DEFAULT_DASHBOARD);
        const glass = {
          enabled: true,
          opacity: 0.64,
          blur: 21,
          tint: "#c6b8b0",
          border: 0.8,
          reflection: 0.35,
          shadow: 0.7,
          performance: quality,
        };
        legacy.widgets[0].glass = { blur: 3, opacity: 0.61 };
        legacy.note = "Keep my local note";
        legacy.events = [
          { id: "organic-event", date: "2026-11-07", title: "Still here" },
        ];
        legacy.dock = { size: "compact", magnify: false, opacity: 0.58 };
        legacy.wallpaper = {
          ...legacy.wallpaper,
          kind: "video",
          mediaId: "12345678-1234-1234-1234-123456789012.webm",
          audioControls: true,
          loop: false,
        };
        const old = { ...legacy, version: 2, glass };
        fs.writeFileSync(
          path.join(directory, "dashboard.json"),
          JSON.stringify(old),
        );
        const storage = new StorageService(directory);
        const migrated = storage.getDashboard();
        expect(migrated.version).toBe(4);
        expect(migrated.glass).toEqual({
          ...DEFAULT_GLASS,
          ...glass,
          liquid: { ...DEFAULT_GLASS.liquid, quality: "performance" },
        });
        expect(migrated.widgets).toEqual(old.widgets);
        expect(migrated.wallpaper).toEqual(old.wallpaper);
        expect(migrated.dock).toEqual(old.dock);
        expect(migrated.events).toEqual(old.events);
        expect(migrated.note).toBe(old.note);
        expect(storage.warnings).toEqual([]);
        storage.updateDashboard({ note: "Only the note changed" });
        expect(new StorageService(directory).getDashboard()).toEqual({
          ...migrated,
          note: "Only the note changed",
        });
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
  );
  it("does not hide malformed legacy settings or mutate already-current documents", () => {
    const bad = migrateDashboard({
      ...DEFAULT_DASHBOARD,
      version: 2,
      glass: { ...DEFAULT_GLASS, opacity: 0.1, untrusted: "url(x)" },
    });
    expect(dashboardSchema.safeParse(bad).success).toBe(false);
    expect(migrateDashboard(DEFAULT_DASHBOARD)).toBe(DEFAULT_DASHBOARD);
    expect(migrateDashboard({ version: 99 })).toEqual({ version: 99 });
  });
});
describe("bounded material and motion math", () => {
  it("applies saturation and elevation to actual depth and gates refraction by quality / activity / global enable", () => {
    const material = {
      ...DEFAULT_GLASS,
      saturation: 0.5,
      elevation: 1.5,
      refraction: 0.8,
    };
    expect(
      glassDepth(resolveGlass(material, undefined, true), "deep", "light"),
    ).toMatchObject({ saturation: 0.56, elevation: 36 });
    expect(resolveGlass(material, undefined, true).refraction).toBe(0.8);
    for (const settings of [
      { ...material, performance: "balanced" as const },
      { ...material, performance: "simple" as const },
      { ...material, enabled: false },
    ])
      expect(resolveGlass(settings, { refraction: 1 }, true).refraction).toBe(
        0,
      );
    expect(resolveGlass(material, undefined, false).refraction).toBe(0);
  });
  it("derives a deterministic alpha-weighted palette without video clocks, and respects explicit tone / fallback", () => {
    expect(rgbAppearance([255, 0, 0, 255, 0, 255, 0, 0])?.color).toBe(
      "#ff0000",
    );
    expect(rgbAppearance([0, 0, 0, 0])).toBeNull();
    expect(rgbAppearance([0, 0])).toBeNull();
    const bright = rgbAppearance([255, 255, 255, 255])!,
      dark = rgbAppearance([0, 0, 0, 255])!;
    expect(bright.luminance).toBe(1);
    expect(dark.luminance).toBe(0);
    expect(adaptiveGlassTone("theme", "pastel", dark, true)).toBe("dark");
    expect(adaptiveGlassTone("theme", "dark", bright, true)).toBe("light");
    expect(adaptiveGlassTone("dark", "dark", dark, true)).toBe("light");
    expect(adaptiveGlassTone("theme", "pastel", dark, false)).toBe("light");
    expect(
      adaptiveGlassTone("theme", "pastel", { ...dark, source: "theme" }, true),
    ).toBe("light");
  });
  it("has a continuous symmetric, bounded proximity field and an interpolation that cannot overshoot", () => {
    expect(dockProximity(0)).toBe(1);
    expect(dockProximity(82)).toBe(0);
    expect(dockProximity(1000)).toBe(0);
    expect(dockProximity(23)).toBe(dockProximity(-23));
    expect(dockProximity(20)).toBeGreaterThan(dockProximity(40));
    for (const elapsed of [0, 16, 10000])
      expect(interpolate(0, 1, elapsed)).toBeGreaterThanOrEqual(0);
    expect(interpolate(0, 1, 10000)).toBeLessThan(1);
    expect(lunarSpring(1, true)).toEqual({ duration: 0 });
    const fast = lunarSpring(1.5),
      slow = lunarSpring(0.5);
    expect(
      "stiffness" in fast &&
        "stiffness" in slow &&
        fast.stiffness > slow.stiffness,
    ).toBe(true);
  });
});

it("keeps existing theme chrome blur effective without altering shared material preferences or widget overrides", () => {
  const before = structuredClone(DEFAULT_GLASS);
  expect(chromeGlassMaterial(DEFAULT_GLASS, 12).blur).toBe(14);
  expect(chromeGlassMaterial(DEFAULT_GLASS, 0).blur).toBe(0);
  expect(chromeGlassMaterial(DEFAULT_GLASS, 32).blur).toBe(24);
  expect(chromeGlassMaterial({ ...DEFAULT_GLASS, blur: 0 }, 32).blur).toBe(0);
  expect(DEFAULT_GLASS).toEqual(before);
});
