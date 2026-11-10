import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLASS,
  MATERIAL_COLORS,
  glassSchema,
  widgetGlassSchema,
  resolveGlass,
  glassTone,
  GLASS_LEVELS,
  glassDepth,
  type GlassLevel,
  type GlassTone,
} from "../shared/glass";
import { DEFAULT_DASHBOARD, dashboardPatchSchema } from "../shared/dashboard";
import { StorageService } from "../electron/services/storage";

describe("validated, persistent glass materials", () => {
  it("constrains every token and rejects arbitrary CSS, URLs and unknown override fields", () => {
    expect(glassSchema.parse(DEFAULT_GLASS)).toEqual(DEFAULT_GLASS);
    for (const patch of [
      { opacity: 0.1 },
      { opacity: 1.1 },
      { blur: 25 },
      { blur: 0.5 },
      { border: -1 },
      { reflection: 2 },
      { shadow: 2 },
      { tint: "url(file:///secret)" },
      { tint: "#fff" },
      { performance: "gpu-unlimited" },
    ])
      expect(
        glassSchema.safeParse({ ...DEFAULT_GLASS, ...patch }).success,
      ).toBe(false);
    expect(
      widgetGlassSchema.safeParse({ blur: 9, tint: "#AABBCC" }).success,
    ).toBe(true);
    expect(
      widgetGlassSchema.safeParse({ background: "url(https://example.org)" })
        .success,
    ).toBe(false);
    expect(
      widgetGlassSchema.safeParse({ performance: "balanced" }).success,
    ).toBe(false);
  });
  it("honors sparse overrides while global off, simple mode and inactivity cannot be bypassed", () => {
    expect(
      resolveGlass(DEFAULT_GLASS, { opacity: 0.63, blur: 22 }, true),
    ).toMatchObject({ mode: "glass", opacity: 0.63, blur: 22 });
    expect(
      resolveGlass(
        { ...DEFAULT_GLASS, enabled: false },
        { enabled: true },
        true,
      ),
    ).toMatchObject({ mode: "solid", blur: 0, reflection: 0 });
    expect(resolveGlass(DEFAULT_GLASS, { enabled: false }, true).mode).toBe(
      "solid",
    );
    expect(
      resolveGlass(
        { ...DEFAULT_GLASS, performance: "simple" },
        { blur: 24 },
        true,
      ),
    ).toMatchObject({ mode: "simple", blur: 0, reflection: 0 });
    expect(resolveGlass(DEFAULT_GLASS, undefined, false)).toMatchObject({
      mode: "simple",
      blur: 0,
      reflection: 0,
    });
    expect(glassTone("light", "pastel")).toBe("dark");
    expect(glassTone("dark", "dark")).toBe("light");
    expect(glassTone("theme", "dark")).toBe("dark");
  });
  it("migrates a real version-one file without losing layout, content, opacity or wallpaper", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-glass-migrate-"));
    try {
      const { glass: _glass, ...legacy } = structuredClone(DEFAULT_DASHBOARD);
      legacy.note = "Do not lose my note";
      legacy.events = [
        { id: "event", date: "2026-11-03", title: "Keep my event" },
      ];
      legacy.widgetOpacity = 0.83;
      const raw = { ...legacy, version: 1 };
      fs.writeFileSync(path.join(dir, "dashboard.json"), JSON.stringify(raw));
      const store = new StorageService(dir),
        loaded = store.getDashboard();
      expect(loaded).toMatchObject({
        version: 4,
        glass: { ...DEFAULT_GLASS, opacity: 0.83, performance: "balanced" },
        note: raw.note,
        events: raw.events,
        wallpaper: raw.wallpaper,
        widgets: raw.widgets,
      });
      expect(store.warnings).toEqual([]);
      store.updateDashboard({
        glass: { ...loaded.glass, tint: "#e2c9cf", blur: 21, reflection: 0.5 },
        widgets: loaded.widgets.map((widget, i) =>
          i === 0 ? { ...widget, glass: { blur: 3, shadow: 0.8 } } : widget,
        ),
      });
      store.updateDashboard({ note: "A later note-only save" });
      const restarted = new StorageService(dir).getDashboard();
      expect(restarted.glass).toMatchObject({
        tint: "#e2c9cf",
        blur: 21,
        reflection: 0.5,
      });
      expect(restarted.widgets[0].glass).toEqual({ blur: 3, shadow: 0.8 });
      expect(
        restarted.widgets.map(({ glass: _override, ...rest }) => rest),
      ).toEqual(raw.widgets);
      expect(restarted.events).toEqual(raw.events);
      expect(restarted.wallpaper).toEqual(raw.wallpaper);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("does not insert glass defaults into unrelated patches or allow malformed style writes", () => {
    expect(dashboardPatchSchema.parse({ note: "preserve style" })).toEqual({
      note: "preserve style",
    });
    expect(dashboardPatchSchema.parse({})).toEqual({});
    expect(
      dashboardPatchSchema.safeParse({ glass: { opacity: 0.7 } }).success,
    ).toBe(false);
    expect(
      dashboardPatchSchema.safeParse({
        glass: { ...DEFAULT_GLASS, tint: "red;background:url(x)" },
      }).success,
    ).toBe(false);
  });
  it("shares three bounded depths without changing saved material preferences", () => {
    expect(Object.keys(GLASS_LEVELS)).toEqual(["light", "standard", "deep"]);
    for (const level of Object.keys(GLASS_LEVELS) as GlassLevel[])
      for (const tone of ["light", "dark"] as GlassTone[])
        for (const opacity of [0.6, 0.72, 1]) {
          const settings = { ...DEFAULT_GLASS, opacity, blur: 24 };
          const before = structuredClone(settings);
          const depth = glassDepth(
            resolveGlass(settings, undefined, true),
            level,
            tone,
          );
          expect(depth.blur).toBeLessThanOrEqual(24);
          expect(depth.alpha).toBeGreaterThan(0.45);
          expect(depth.alpha).toBeLessThanOrEqual(1);
          if (opacity === 1) expect(depth.alpha).toBe(1);
          expect(
            glassDepth(resolveGlass(settings, undefined, false), level, tone)
              .blur,
          ).toBe(0);
          expect(settings).toEqual(before);
        }
    const material = resolveGlass(
      { ...DEFAULT_GLASS, blur: 14 },
      undefined,
      true,
    );
    const depths = (Object.keys(GLASS_LEVELS) as GlassLevel[]).map((level) =>
      glassDepth(material, level, "light"),
    );
    expect(depths.map((d) => d.blur)).toEqual([11, 14, 16]);
    expect(depths[0].alpha).toBeLessThan(depths[1].alpha);
    expect(depths[1].alpha).toBeLessThan(depths[2].alpha);
  });
  it("maintains conservative text contrast at both wallpaper extremes and extreme tint choices", () => {
    const light = "light",
      dark = "dark";
    const hex = (value: string) =>
      [0, 2, 4].map((i) =>
        parseInt(value.replace("#", "").slice(i, i + 2), 16),
      );
    const token = (tone: "light" | "dark", key: "paper" | "ink" | "muted") =>
      MATERIAL_COLORS[tone][key];
    const mix = (a: number[], b: number[], alpha: number) =>
      a.map((v, i) => v * alpha + b[i] * (1 - alpha));
    const luminance = (rgb: number[]) =>
      rgb
        .map((value) => {
          const n = value / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    for (const block of [light, dark] as const)
      for (const tint of ["#000000", "#ffffff", "#ff00ff", "#00ff00"])
        for (const wallpaper of ["#000000", "#ffffff"]) {
          for (const level of Object.keys(GLASS_LEVELS) as GlassLevel[])
            for (const opacity of [0.6, 0.72, 1]) {
              const tone = block === dark ? "dark" : "light";
              const depth = glassDepth(
                resolveGlass({ ...DEFAULT_GLASS, opacity }, undefined, true),
                level,
                tone,
              );
              const paper = hex(token(block, "paper"));
              const material = mix(paper, hex(tint), 0.94);
              const base = mix(
                mix(material, hex(wallpaper), depth.alpha),
                paper,
                1 - depth.wash,
              );
              // Maximum dark-tone specular overlays together are less than 3% white.
              const guarded =
                block === dark ? mix([255, 255, 255], base, 0.03) : base;
              for (const name of ["ink", "muted"] as const) {
                const a = luminance(guarded),
                  b = luminance(hex(token(block, name)));
                expect(
                  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                  `${name} / ${tone} / ${level} / ${opacity} / ${tint} / ${wallpaper}`,
                ).toBeGreaterThanOrEqual(4.5);
              }
            }
        }
  });
});
