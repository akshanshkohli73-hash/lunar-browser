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
