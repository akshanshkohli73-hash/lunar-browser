/** Aqua Coquette's shared palette, independent of renderer or persistence.
 * Readability inks are intentionally deeper than the decorative pastel accents. */
export const AQUA_COLORS = {
  mint: "#bdeae2",
  pearl: "#e6f7f3",
  aqua: "#b9dceb",
  lilac: "#d9c9e9",
  teal: "#253f43",
} as const;

export const AQUA_MATERIAL_TONES = {
  light: {
    paper: AQUA_COLORS.pearl,
    ink: "#102a2d",
    muted: "#102b2f",
    edge: "#ffffff",
    depth: "#183d43",
  },
  dark: {
    paper: "#152e32",
    ink: "#f3fbf9",
    muted: "#e6f4f1",
    edge: "#d5f0ed",
    depth: "#030e12",
  },
} as const;

/** Fresh-profile Water Lens values. Existing saved materials are never reset. */
export const AQUA_WATER_LENS = {
  opacity: 0.68,
  blur: 4,
  tint: AQUA_COLORS.mint,
  border: 0.4,
  reflection: 0.45,
  shadow: 0.28,
  saturation: 1,
  refraction: 0.32,
  elevation: 1,
} as const;

/** Bounded optical, not DOM-transform, interaction budgets (CSS pixels/seconds). */
export const AQUA_OPTICS = {
  rippleSeconds: 0.85,
  ripplePixels: 1.4,
  flowPixels: 0.22,
  dispersionPixels: 0.32,
} as const;

export function aquaGreeting(hour: number): string {
  return hour < 5
    ? "A quiet orbit."
    : hour < 12
      ? "Good morning."
      : hour < 18
        ? "Good afternoon."
        : "Good evening.";
}
