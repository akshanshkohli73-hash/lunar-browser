import { z } from "zod";
import { AQUA_MATERIAL_TONES, AQUA_WATER_LENS } from "./aqua";
import { liquidSchema, DEFAULT_LIQUID } from "./liquid";

// Constrained material tokens, never arbitrary CSS/URLs from a saved profile.
export const glassMaterialSchema = z
  .object({
    enabled: z.boolean(),
    opacity: z.number().min(0.6).max(1),
    blur: z.number().int().min(0).max(24),
    tint: z.string().regex(/^#[\da-f]{6}$/iu),
    border: z.number().min(0).max(1),
    reflection: z.number().min(0).max(1),
    shadow: z.number().min(0).max(1),
    saturation: z.number().min(0.5).max(1.5),
    refraction: z.number().min(0).max(1),
    elevation: z.number().min(0).max(1.5),
  })
  .strict();
export const glassSchema = glassMaterialSchema
  .extend({
    performance: z.enum(["balanced", "simple", "optical"]),
    hoverMotion: z.boolean(),
    animationSpeed: z.number().min(0.5).max(1.75),
    adaptive: z.boolean(),
    reducedMotion: z.boolean(),
    liquid: liquidSchema,
  })
  .strict();
export const widgetGlassSchema = glassMaterialSchema.partial().strict();
export type GlassMaterial = z.infer<typeof glassMaterialSchema>;
export type GlassSettings = z.infer<typeof glassSchema>;
export type WidgetGlass = z.infer<typeof widgetGlassSchema>;
export type GlassTone = "light" | "dark";
export const DEFAULT_GLASS: GlassSettings = {
  enabled: true,
  ...AQUA_WATER_LENS,
  performance: "optical",
  hoverMotion: true,
  animationSpeed: 1,
  adaptive: true,
  reducedMotion: false,
  liquid: DEFAULT_LIQUID,
};
export function glassTone(
  text: "theme" | "light" | "dark",
  category: string,
): GlassTone {
  return text === "light" ||
    (text === "theme" && ["dark", "cyber"].includes(category))
    ? "dark"
    : "light";
}
export function resolveGlass(
  global: GlassSettings,
  override: WidgetGlass | undefined,
  active: boolean,
) {
  const material = {
    ...global,
    ...override,
    enabled: global.enabled && (override?.enabled ?? true),
  };
  const mode = !material.enabled
    ? "solid"
    : !active || global.performance === "simple"
      ? "simple"
      : "glass";
  return {
    ...material,
    mode,
    blur: mode === "glass" ? material.blur : 0,
    reflection: mode === "glass" ? material.reflection : 0,
    refraction:
      mode === "glass" && global.performance === "optical"
        ? material.refraction
        : 0,
  } as const;
}

/** Presentation-only depths: no saved-profile/schema change or reset of user tokens. */
export const GLASS_LEVELS = {
  light: {
    label: "Light Glass",
    blurScale: 0.75,
    saturation: 1.22,
    alphaFloor: { light: 0.46, dark: 0.54 },
    wash: { light: 0.27, dark: 0.43 },
    elevation: 10,
    spread: -8,
  },
  standard: {
    label: "Standard Glass",
    blurScale: 1,
    saturation: 1.18,
    alphaFloor: { light: 0.49, dark: 0.58 },
    wash: { light: 0.25, dark: 0.38 },
    elevation: 16,
    spread: -11,
  },
  deep: {
    label: "Deep Glass",
    blurScale: 1.15,
    saturation: 1.12,
    alphaFloor: { light: 0.54, dark: 0.62 },
    wash: { light: 0.24, dark: 0.36 },
    elevation: 24,
    spread: -14,
  },
} as const;
export type GlassLevel = keyof typeof GLASS_LEVELS;

export function glassDepth(
  material: ReturnType<typeof resolveGlass>,
  level: GlassLevel,
  tone: GlassTone,
) {
  const depth = GLASS_LEVELS[level];
  // Preserve the saved 60–100% control range, but avoid the old double-opaque wash.
  // At 100% the material really is opaque. At the low end, tone-specific floors
  // protect text over white/black video frames; the rest remains wallpaper-responsive.
  const amount = Math.pow((material.opacity - 0.6) / 0.4, 1.6);
  return {
    alpha: depth.alphaFloor[tone] + (1 - depth.alphaFloor[tone]) * amount,
    wash: depth.wash[tone],
    blur: Math.min(24, Math.round(material.blur * depth.blurScale)),
    saturation: depth.saturation * material.saturation,
    elevation: depth.elevation * material.elevation,
    spread: depth.spread,
  };
}

/** Bounded palette; adaptive tint occupies at most the existing 6% tint contribution. */
export const MATERIAL_COLORS = AQUA_MATERIAL_TONES;

export type WallpaperAppearance = {
  color: string;
  luminance: number;
  source: "pixels" | "preset" | "theme";
};
export function rgbAppearance(
  pixels: ArrayLike<number>,
): WallpaperAppearance | null {
  if (pixels.length < 4 || pixels.length % 4 !== 0) return null;
  let count = 0,
    r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    r += pixels[i] * alpha;
    g += pixels[i + 1] * alpha;
    b += pixels[i + 2] * alpha;
    count += alpha;
  }
  if (!count) return null;
  const rgb = [r, g, b].map((n) => Math.round(n / count));
  const luminance = rgb
    .map((v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    })
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  return {
    color: "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""),
    luminance,
    source: "pixels",
  };
}
export function adaptiveGlassTone(
  preference: "theme" | "light" | "dark",
  category: string,
  appearance: WallpaperAppearance,
  adaptive: boolean,
): GlassTone {
  if (preference !== "theme" || !adaptive || appearance.source === "theme")
    return glassTone(preference, category);
  return appearance.luminance < 0.19 ? "dark" : "light";
}

/** Retain the existing per-theme chrome blur control; material blur remains the
 * shared base and widget overrides remain independent of theme-only chrome scale. */
export function chromeGlassMaterial(
  material: GlassSettings,
  themeBlur = 12,
): GlassSettings {
  return {
    ...material,
    blur: Math.max(
      0,
      Math.min(24, Math.round((material.blur * themeBlur) / 12)),
    ),
  };
}
