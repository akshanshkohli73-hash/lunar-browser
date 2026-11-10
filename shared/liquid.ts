import { z } from "zod";

/** Engine-wide settings, never admitted to a sparse per-widget material override. */
export const liquidSchema = z
  .object({
    quality: z.enum(["performance", "balanced", "high", "experimental"]),
    edgeLensing: z.number().min(0).max(1),
    specular: z.number().min(0).max(1),
    curvature: z.number().min(0).max(1),
    elasticity: z.number().min(0).max(1),
    responsiveness: z.number().min(0.25).max(2),
  })
  .strict();
export type LiquidSettings = z.infer<typeof liquidSchema>;
export const DEFAULT_LIQUID: LiquidSettings = {
  quality: "high",
  edgeLensing: 0.7,
  specular: 0.65,
  curvature: 0.55,
  elasticity: 0.45,
  responsiveness: 1,
};
export const LIQUID_QUALITY = {
  performance: { scale: 0, fps: 0, samples: 0, surfaces: 0, atlasPixels: 0 },
  balanced: {
    scale: 0.65,
    fps: 30,
    samples: 5,
    surfaces: 24,
    atlasPixels: 2097152,
  },
  high: { scale: 1, fps: 60, samples: 9, surfaces: 32, atlasPixels: 4194304 },
  experimental: {
    scale: 1.25,
    fps: 60,
    samples: 13,
    surfaces: 40,
    atlasPixels: 8388608,
  },
} as const;
export type Rect = { x: number; y: number; width: number; height: number };
export type Spring = { value: number; velocity: number };
/** Exact critically-damped solution: bounded time, no numerical explosion or idle wobble. */
export function springStep(
  state: Spring,
  target: number,
  seconds: number,
  response = 1,
): Spring {
  const dt = Math.max(0, Math.min(0.05, seconds));
  const omega = 22 * Math.max(0.125, Math.min(3.5, response));
  const offset = state.value - target,
    c = state.velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  const value = target + (offset + c * dt) * decay;
  const velocity = (state.velocity - omega * c * dt) * decay;
  return Math.abs(value - target) < 0.0001 && Math.abs(velocity) < 0.001
    ? { value: target, velocity: 0 }
    : { value, velocity };
}
export function morphEase(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return (1 - (1 + 7 * t) * Math.exp(-7 * t)) / (1 - 8 * Math.exp(-7));
}
export function mixRect(a: Rect, b: Rect, t: number): Rect {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}
export function objectFitRect(
  box: Rect,
  width: number,
  height: number,
  fit: string,
  position: string,
): Rect {
  const scale = (fit === "contain" ? Math.min : Math.max)(
    box.width / Math.max(1, width),
    box.height / Math.max(1, height),
  );
  const w = width * scale,
    h = height * scale;
  return {
    x: box.x + (box.width - w) / 2,
    y:
      box.y +
      (position === "top"
        ? 0
        : position === "bottom"
          ? box.height - h
          : (box.height - h) / 2),
    width: w,
    height: h,
  };
}
export type AtlasTile = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
/** Bounded shelf packing. Scale is reduced rather than allocating an unbounded framebuffer. */
export function packAtlas(
  rects: Rect[],
  requestedScale: number,
  maxSize: number,
  maxPixels: number,
) {
  let scale = Math.max(0.2, requestedScale);
  for (let attempt = 0; attempt < 14; attempt++, scale *= 0.82) {
    const width = Math.min(
      maxSize,
      Math.max(
        64,
        ...rects.map((rect) => Math.ceil(rect.width * scale)),
        Math.ceil(
          Math.sqrt(
            rects.reduce(
              (sum, r) => sum + r.width * r.height * scale * scale,
              0,
            ),
          ) * 1.25,
        ),
      ),
    );
    let x = 0,
      y = 0,
      row = 0,
      usedWidth = 1;
    const tiles: AtlasTile[] = [];
    for (let index = 0; index < rects.length; index++) {
      const w = Math.max(1, Math.ceil(rects[index].width * scale)),
        h = Math.max(1, Math.ceil(rects[index].height * scale));
      if (w > width || h > maxSize) break;
      if (x + w > width) {
        x = 0;
        y += row;
        row = 0;
      }
      if (y + h > maxSize) break;
      tiles.push({ index, x, y, width: w, height: h });
      x += w;
      row = Math.max(row, h);
      usedWidth = Math.max(usedWidth, x);
    }
    const height = Math.max(1, y + row);
    if (tiles.length === rects.length && usedWidth * height <= maxPixels)
      return { width: usedWidth, height, scale, tiles };
  }
  return null;
}
