import { z } from "zod";

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
  })
  .strict();
export const glassSchema = glassMaterialSchema
  .extend({
    performance: z.enum(["balanced", "simple"]),
  })
  .strict();
export const widgetGlassSchema = glassMaterialSchema.partial().strict();
export type GlassSettings = z.infer<typeof glassSchema>;
export type WidgetGlass = z.infer<typeof widgetGlassSchema>;
export type GlassTone = "light" | "dark";
export const DEFAULT_GLASS: GlassSettings = {
  enabled: true,
  opacity: 0.72,
  blur: 14,
  tint: "#b8d6b4",
  border: 0.4,
  reflection: 0.3,
  shadow: 0.32,
  performance: "balanced",
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
    saturation: depth.saturation,
    elevation: depth.elevation,
    spread: depth.spread,
  };
}
