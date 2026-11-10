/** Shared motion grammar; no animation clocks or mutable state in the token layer. */
export const LUNAR_MOTION = {
  spring: { type: "spring", stiffness: 360, damping: 34, mass: 0.8 },
  panel: { type: "spring", stiffness: 420, damping: 38, mass: 0.85 },
  hoverY: -2,
  pressScale: 0.985,
  lightingSettleMs: 40,
  dockRadius: 82,
  dockScale: 0.16,
  crossfadeMs: 200,
} as const;
export function lunarSpring(speed = 1, reduced = false, panel = false) {
  return reduced
    ? { duration: 0 }
    : {
        ...(panel ? LUNAR_MOTION.panel : LUNAR_MOTION.spring),
        stiffness:
          (panel
            ? LUNAR_MOTION.panel.stiffness
            : LUNAR_MOTION.spring.stiffness) *
          speed *
          speed,
        damping:
          (panel ? LUNAR_MOTION.panel.damping : LUNAR_MOTION.spring.damping) *
          speed,
      };
}
export function dockProximity(
  distance: number,
  radius = LUNAR_MOTION.dockRadius,
): number {
  const amount = Math.max(0, 1 - Math.abs(distance) / radius);
  return amount * amount * (3 - 2 * amount);
}
export function interpolate(
  current: number,
  target: number,
  elapsed: number,
  speed = 1,
): number {
  return (
    current +
    (target - current) *
      (1 -
        Math.exp(
          (-Math.min(40, elapsed) * speed) / LUNAR_MOTION.lightingSettleMs,
        ))
  );
}
