import type { GlassTone, glassDepth, resolveGlass } from "./glass";

/** Rendering intent is independent of component geometry and saved preferences.
 * liquid-webgl opts into actual wallpaper optics; the other two are CSS only. */
export type MaterialVariant = "liquid-webgl" | "pearl-css" | "clear-surface";

/** One restrained Aqua Coquette palette. No noise maps or spectral/rainbow paint. */
export const PEARL_COLORS = {
  light: { aqua: "#b9dcd4", sheen: "#fffef6", rim: "#edf9f3", highlightCap: 1 },
  dark: {
    aqua: "#28574e",
    sheen: "#83afa0",
    rim: "#b3d7c8",
    highlightCap: 0.12,
  },
} as const;

/** Paint-only hierarchy. Caps are CSS sampling radii, not shader blur limits.
 * Text controls share their owner's backdrop instead of nesting filter passes. */
export const MATERIAL_PROFILES = {
  widget: {
    blurCap: 10,
    alpha: { light: 0.52, dark: 0.64 },
    sheen: 0.52,
    shadow: 1,
    edge: 1,
  },
  clock: {
    blurCap: 8,
    alpha: { light: 0.48, dark: 0.62 },
    sheen: 0.65,
    shadow: 0.85,
    edge: 0.9,
  },
  search: {
    blurCap: 8,
    alpha: { light: 0.55, dark: 0.68 },
    sheen: 0.48,
    shadow: 0.8,
    edge: 1,
  },
  readable: {
    blurCap: 6,
    alpha: { light: 0.63, dark: 0.74 },
    sheen: 0.2,
    shadow: 0.9,
    edge: 0.75,
  },
  dock: {
    blurCap: 12,
    alpha: { light: 0.5, dark: 0.7 },
    sheen: 1,
    shadow: 1.2,
    edge: 1.15,
  },
  toolbar: {
    blurCap: 6,
    alpha: { light: 0.46, dark: 0.62 },
    sheen: 0.25,
    shadow: 0.12,
    edge: 0.55,
  },
  menubar: {
    blurCap: 4,
    alpha: { light: 0.48, dark: 0.64 },
    sheen: 0.18,
    shadow: 0,
    edge: 0.45,
  },
  address: {
    blurCap: 0,
    alpha: { light: 0.32, dark: 0.48 },
    sheen: 0.15,
    shadow: 0.1,
    edge: 0.7,
  },
  menu: {
    blurCap: 10,
    alpha: { light: 0.72, dark: 0.8 },
    sheen: 0.4,
    shadow: 1.15,
    edge: 1,
  },
  panel: {
    blurCap: 10,
    alpha: { light: 0.64, dark: 0.76 },
    sheen: 0.38,
    shadow: 1.05,
    edge: 0.9,
  },
  control: {
    blurCap: 0,
    alpha: { light: 0.5, dark: 0.68 },
    sheen: 0.1,
    shadow: 0,
    edge: 0.55,
  },
} as const;
export type MaterialRole = keyof typeof MATERIAL_PROFILES;
export function widgetMaterialRole(kind: string | undefined): MaterialRole {
  return kind === "search"
    ? "search"
    : kind === "notes"
      ? "readable"
      : kind === "clock"
        ? "clock"
        : "widget";
}
export function cssMaterialVariant(
  request: string | undefined,
): "pearl-css" | "clear-surface" {
  return request === "clear-surface" ? "clear-surface" : "pearl-css";
}
export function wantsLiquid(request: string | undefined) {
  // Legacy/preview surfaces without an explicit intent still opt into the engine.
  return request !== "pearl-css" && request !== "clear-surface";
}
export function pearlMaterial(
  material: ReturnType<typeof resolveGlass>,
  depth: ReturnType<typeof glassDepth>,
  role: MaterialRole,
  tone: GlassTone,
  variant: MaterialVariant,
  blurSupported: boolean,
) {
  const profile = MATERIAL_PROFILES[role];
  const amount = Math.pow(
    Math.max(0, Math.min(1, (material.opacity - 0.6) / 0.4)),
    1.6,
  );
  const clear = variant === "clear-surface";
  const floor = !blurSupported
    ? Math.max(profile.alpha[tone], tone === "dark" ? 0.86 : 0.84)
    : clear && role !== "address"
      ? Math.max(profile.alpha[tone], tone === "dark" ? 0.76 : 0.62)
      : profile.alpha[tone];
  const alpha = floor + (1 - floor) * amount;
  return {
    alpha: clear ? alpha : Math.max(alpha, depth.alpha),
    backdrop:
      material.mode === "glass" &&
      blurSupported &&
      !clear &&
      profile.blurCap > 0,
    blur:
      material.mode === "glass" && blurSupported && !clear
        ? Math.min(depth.blur, profile.blurCap)
        : 0,
    sheen: profile.sheen,
    shadow: profile.shadow,
    edge: profile.edge,
  };
}
