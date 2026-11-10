import type { Rect } from "../../shared/liquid";
export type LiquidMaterial = {
  opacity: number;
  blur: number;
  saturation: number;
  refraction: number;
  reflection: number;
  edge: number;
  dark: number;
  tint: [number, number, number];
  radii: [number, number, number, number];
};
export function rgb(hex: string): [number, number, number] {
  const value = /^#([a-f\d]{6})$/iu.exec(hex.trim())?.[1] ?? "b8d6b4";
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}
export function readMaterial(node: HTMLElement, box: Rect): LiquidMaterial {
  const css = getComputedStyle(node);
  const number = (name: string, fallback: number) => {
    const n = parseFloat(css.getPropertyValue(name));
    return Number.isFinite(n) ? n : fallback;
  };
  const radius = (value: string) =>
    Math.max(
      0,
      Math.min(
        Math.min(box.width, box.height) / 2,
        parseFloat(value) *
          (value.endsWith("%") ? Math.min(box.width, box.height) / 100 : 1) ||
          0,
      ),
    );
  const manual = rgb(css.getPropertyValue("--glass-tint"));
  const environment = rgb(
    css.getPropertyValue("--glass-adaptive-tint") ||
      css.getPropertyValue("--glass-tint"),
  );
  return {
    opacity: number("--glass-opacity", 0.72),
    blur: number("--glass-effective-blur", 14),
    saturation: number("--glass-saturation", 1),
    refraction: number(
      "--glass-refraction-strength",
      number("--glass-refraction", 0.2),
    ),
    reflection: number("--glass-reflection", 0.3),
    edge: number("--glass-border", 0.4),
    dark: node.dataset.glassTone === "dark" ? 1 : 0,
    tint: manual.map(
      (channel, index) => channel * 0.65 + environment[index] * 0.35,
    ) as [number, number, number],
    radii: [
      css.borderTopLeftRadius,
      css.borderTopRightRadius,
      css.borderBottomRightRadius,
      css.borderBottomLeftRadius,
    ].map(radius) as LiquidMaterial["radii"],
  };
}
