import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLASS,
  MATERIAL_COLORS,
  glassDepth,
  resolveGlass,
  type GlassLevel,
  type GlassTone,
} from "../shared/glass";
import {
  MATERIAL_PROFILES,
  PEARL_COLORS,
  pearlMaterial,
  type MaterialRole,
} from "../shared/materials";

type RGB = [number, number, number];
const rgb = (hex: string): RGB =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
const over = (foreground: RGB, background: RGB, alpha: number): RGB =>
  foreground.map((c, i) => c * alpha + background[i] * (1 - alpha)) as RGB;
function luminance(color: RGB) {
  return color
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const levels: Record<MaterialRole, GlassLevel> = {
  dock: "light",
  clock: "light",
  menubar: "light",
  toolbar: "light",
  address: "light",
  search: "standard",
  widget: "standard",
  readable: "deep",
  panel: "deep",
  menu: "standard",
  control: "deep",
};
/** Conservative interior-paint model: black/white wallpaper extremes, worst 6%
 * manual/adaptive tint, all stops and maximum overlapping decorative highlights.
 * Address is deliberately nested in the toolbar; Clear Surface adds no filter.
 * This is a token guard, not universal certification of custom content/themes. */
function painted(
  role: MaterialRole,
  tone: GlassTone,
  opacity: number,
  tint: string,
  wallpaper: RGB,
  clear: boolean,
  blur: boolean,
): RGB[] {
  const material = resolveGlass(
    { ...DEFAULT_GLASS, opacity, tint, reflection: 1 },
    undefined,
    true,
  );
  const depth = glassDepth(material, levels[role], tone);
  const pearl = pearlMaterial(
    material,
    depth,
    role,
    tone,
    clear ? "clear-surface" : "pearl-css",
    blur,
  );
  const paper = rgb(MATERIAL_COLORS[tone].paper);
  const tinted = over(rgb(tint), paper, 0.06);
  const underneath =
    role === "address"
      ? painted("toolbar", tone, opacity, tint, wallpaper, false, blur)
      : [wallpaper];
  const stops: [RGB, number][] = clear
    ? [
        [paper, 0],
        [paper, 0.2],
      ]
    : role === "dock"
      ? [
          [paper, 0.42],
          [paper, 0.22],
          [over(rgb(PEARL_COLORS[tone].aqua), paper, 0.25), 0.27],
        ]
      : [
          [paper, depth.wash],
          [paper, depth.wash + 0.08],
        ];
  return underneath.flatMap((background) =>
    stops.flatMap(([wash, alpha]) => {
      const base = over(wash, over(tinted, background, pearl.alpha), alpha);
      // The three reflection layers could not all peak at one pixel, but bounding
      // them together is stricter than the actual radial/diagonal field.
      const highlight = clear
        ? 0
        : (1 - (1 - 0.26) * (1 - 0.7) * (1 - 0.24)) *
          PEARL_COLORS[tone].highlightCap *
          MATERIAL_PROFILES[role].sheen;
      return [base, over(rgb(PEARL_COLORS[tone].sheen), base, highlight)];
    }),
  );
}
describe("Pearl CSS interior readability bounds", () => {
  it.each([true, false])(
    "retains primary/muted text contrast with backdrop support=%s at minimum/full opacity and reflection extremes",
    (blur) => {
      for (const role of Object.keys(MATERIAL_PROFILES) as MaterialRole[])
        for (const tone of ["light", "dark"] as const)
          for (const opacity of [0.6, 0.72, 1])
            for (const tint of ["#000000", "#ffffff"])
              for (const wallpaper of [
                [0, 0, 0],
                [255, 255, 255],
              ] as RGB[]) {
                const clear = role === "address" || role === "control";
                for (const background of painted(
                  role,
                  tone,
                  opacity,
                  tint,
                  wallpaper,
                  clear,
                  blur,
                ))
                  for (const ink of [
                    MATERIAL_COLORS[tone].ink,
                    MATERIAL_COLORS[tone].muted,
                  ]) {
                    const a = luminance(rgb(ink)),
                      b = luminance(background);
                    expect(
                      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                      `${role} / ${tone} / opacity=${opacity} / ${tint} / wallpaper=${wallpaper} / background=${background}`,
                    ).toBeGreaterThanOrEqual(4.5);
                  }
              }
    },
  );
});
