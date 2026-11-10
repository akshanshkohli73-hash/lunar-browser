import {
  AQUA_MATERIAL_PRESETS,
  AQUA_MOTION_PRESETS,
  applyMaterialPreset,
  applyMotionPreset,
  matchingMaterialPreset,
  matchingMotionPreset,
  type AquaMotionPreset,
} from "../../../shared/material-presets";
import { AQUA_COLORS } from "../../../shared/aqua";
import type { GlassSettings } from "../../../shared/glass";
import { Icon } from "../ui/Icon";

export function MaterialPresets({
  value,
  onChange,
  disabled = false,
}: {
  value: GlassSettings;
  onChange: (value: GlassSettings) => void;
  disabled?: boolean;
}) {
  const selected = matchingMaterialPreset(value);
  return (
    <section
      className="aqua-material-presets"
      aria-label="Aqua Coquette material presets"
    >
      <div className="aqua-section-caption">
        <span className="eyebrow">Aqua Coquette</span>
        <strong>Choose your glass.</strong>
      </div>
      <div className="aqua-material-options">
        {Object.entries(AQUA_MATERIAL_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            className={`aqua-material-option aqua-material-${id}`}
            aria-label={preset.name}
            aria-pressed={selected === id}
            disabled={disabled}
            onClick={() =>
              onChange(
                applyMaterialPreset(
                  value,
                  id as keyof typeof AQUA_MATERIAL_PRESETS,
                ),
              )
            }
          >
            <span className="aqua-material-glyph" aria-hidden="true">
              <Icon
                name={
                  id === "pearl-glass"
                    ? "moon"
                    : id === "crystal"
                      ? "star"
                      : "droplet"
                }
                size={23}
              />
            </span>
            <strong>{preset.name}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
      <p className="muted-text">
        {selected === "custom"
          ? "Custom material · your individual adjustments are retained."
          : `${AQUA_MATERIAL_PRESETS[selected].name} · the controls below hold the actual values.`}{" "}
        Quality, accessibility preferences and per-widget overrides are not
        reset. In Pearl CSS these are non-refractive paint choices.
      </p>
      <label>
        Material motion
        <select
          aria-label="Material motion"
          value={matchingMotionPreset(value)}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value !== "custom")
              onChange(
                applyMotionPreset(
                  value,
                  event.target.value as AquaMotionPreset,
                ),
              );
          }}
        >
          <option value="custom" disabled>
            Custom motion
          </option>
          {Object.entries(AQUA_MOTION_PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted-text">
        Finite springs and local ripples, not an always-running wobble. Reduced
        motion takes priority.
      </p>
      <div
        className="aqua-tint-choices"
        role="group"
        aria-label="Material tint palette"
      >
        {(["mint", "aqua", "lilac"] as const).map((name) => (
          <button
            key={name}
            disabled={disabled}
            aria-label={`${name[0].toUpperCase() + name.slice(1)} material tint`}
            aria-pressed={value.tint.toLowerCase() === AQUA_COLORS[name]}
            onClick={() => onChange({ ...value, tint: AQUA_COLORS[name] })}
          >
            <i aria-hidden="true" style={{ background: AQUA_COLORS[name] }} />
            {name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
    </section>
  );
}
