import { AQUA_COLORS, AQUA_WATER_LENS } from "./aqua";
import { glassSchema, type GlassSettings } from "./glass";

/** Presets are atomic patches of real saved controls, not a second material engine
 * or persisted labels which can disagree with hand-adjusted values. */
export const AQUA_MATERIAL_PRESETS = {
  "water-lens": {
    name: "Water Lens",
    description: "Clear mint, curved lensing and a quiet water edge.",
    material: AQUA_WATER_LENS,
    optics: { edgeLensing: 0.7, specular: 0.65, curvature: 0.55 },
  },
  "pearl-glass": {
    name: "Pearl Glass",
    description: "Soft pearl, delicate pastel reflections and gentler optics.",
    material: {
      opacity: 0.76,
      blur: 9,
      tint: AQUA_COLORS.pearl,
      border: 0.48,
      reflection: 0.62,
      shadow: 0.3,
      saturation: 1.04,
      refraction: 0.14,
      elevation: 0.9,
    },
    optics: { edgeLensing: 0.46, specular: 0.55, curvature: 0.42 },
  },
  crystal: {
    name: "Crystal",
    description:
      "Precise aqua edges, crisp reflections and almost no diffusion.",
    material: {
      opacity: 0.64,
      blur: 0,
      tint: AQUA_COLORS.aqua,
      border: 0.6,
      reflection: 0.72,
      shadow: 0.3,
      saturation: 1,
      refraction: 0.43,
      elevation: 1.1,
    },
    optics: { edgeLensing: 0.9, specular: 0.9, curvature: 0.7 },
  },
} as const;
export type AquaMaterialPreset = keyof typeof AQUA_MATERIAL_PRESETS;

export const AQUA_MOTION_PRESETS = {
  subtle: {
    name: "Subtle",
    animationSpeed: 0.85,
    elasticity: 0.18,
    responsiveness: 0.85,
  },
  gentle: {
    name: "Gentle",
    animationSpeed: 1,
    elasticity: 0.45,
    responsiveness: 1,
  },
  dynamic: {
    name: "Dynamic",
    animationSpeed: 1.2,
    elasticity: 0.65,
    responsiveness: 1.2,
  },
} as const;
export type AquaMotionPreset = keyof typeof AQUA_MOTION_PRESETS;

export function applyMaterialPreset(
  value: GlassSettings,
  id: AquaMaterialPreset,
): GlassSettings {
  const preset = AQUA_MATERIAL_PRESETS[id];
  return glassSchema.parse({
    ...value,
    ...preset.material,
    liquid: { ...value.liquid, ...preset.optics },
  });
}
export function applyMotionPreset(
  value: GlassSettings,
  id: AquaMotionPreset,
): GlassSettings {
  const { animationSpeed, elasticity, responsiveness } =
    AQUA_MOTION_PRESETS[id];
  return glassSchema.parse({
    ...value,
    animationSpeed,
    liquid: { ...value.liquid, elasticity, responsiveness },
  });
}
function same(value: object, patch: object) {
  return Object.entries(patch).every(([key, expected]) => {
    const actual = (value as Record<string, unknown>)[key];
    return typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) < 0.00001
      : actual === expected;
  });
}
export function matchingMaterialPreset(
  value: GlassSettings,
): AquaMaterialPreset | "custom" {
  return (
    (Object.keys(AQUA_MATERIAL_PRESETS) as AquaMaterialPreset[]).find((id) => {
      const preset = AQUA_MATERIAL_PRESETS[id];
      return same(value, preset.material) && same(value.liquid, preset.optics);
    }) ?? "custom"
  );
}
export function matchingMotionPreset(
  value: GlassSettings,
): AquaMotionPreset | "custom" {
  return (
    (Object.keys(AQUA_MOTION_PRESETS) as AquaMotionPreset[]).find((id) => {
      const {
        name: _name,
        animationSpeed,
        ...liquid
      } = AQUA_MOTION_PRESETS[id];
      return same(value, { animationSpeed }) && same(value.liquid, liquid);
    }) ?? "custom"
  );
}
