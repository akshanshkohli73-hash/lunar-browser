import {
  glassMaterialSchema,
  type GlassMaterial,
  type GlassSettings,
  type WidgetGlass,
} from "../../../shared/glass";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { GlassSlider } from "../ui/GlassControls";
const sliders = [
  ["opacity", "Glass opacity", 0.6, 1, 0.01],
  ["blur", "Blur intensity", 0, 24, 1],
  ["saturation", "Glass saturation", 0.5, 1.5, 0.05],
  ["refraction", "Refraction intensity", 0, 1, 0.1],
  ["reflection", "Reflection intensity", 0, 1, 0.05],
  ["border", "Border intensity", 0, 1, 0.05],
  ["shadow", "Shadow strength", 0, 1, 0.05],
  ["elevation", "Glass elevation", 0, 1.5, 0.05],
] as const;
/** Material keys only: global motion/quality must never leak into a strict sparse override. */
export function materialFromGlobal(global: GlassSettings): GlassMaterial {
  return glassMaterialSchema.parse(
    Object.fromEntries(
      Object.keys(glassMaterialSchema.shape).map((key) => [
        key,
        global[key as keyof GlassMaterial],
      ]),
    ),
  );
}
export function GlassMaterialControls({
  value,
  onChange,
  disabled = false,
  simple = false,
  optical = false,
  prefix = "",
}: {
  value: GlassMaterial;
  onChange: (value: WidgetGlass) => void;
  disabled?: boolean;
  simple?: boolean;
  optical?: boolean;
  prefix?: string;
}) {
  const { preferences, reduced } = useGlassMaterial();
  const solid = preferences.transparency || preferences.forcedColors;
  const noOptics = !optical || !preferences.svg || reduced || solid;
  return (
    <div className="glass-control-grid">
      {sliders.map(([key, label, min, max, step]) => (
        <GlassSlider
          key={key}
          label={`${prefix}${label}`}
          value={value[key]}
          min={min}
          max={max}
          step={step}
          disabled={
            disabled ||
            ((simple || solid) &&
              ["blur", "reflection", "refraction", "saturation"].includes(
                key,
              )) ||
            (solid && key === "opacity") ||
            (!preferences.blur && key === "blur") ||
            (noOptics && key === "refraction")
          }
          onChange={(amount) => onChange({ [key]: amount })}
          output={
            key === "blur"
              ? `${value[key]}px`
              : `${Math.round(value[key] * 100)}%`
          }
        />
      ))}
      <label>
        <span>Glass tint</span>
        <span className="glass-tint-input">
          <input
            type="color"
            aria-label={`${prefix}Glass tint`}
            value={value.tint}
            disabled={disabled}
            onChange={(event) => onChange({ tint: event.target.value })}
          />
          <code>{value.tint.toUpperCase()}</code>
        </span>
      </label>
      {!preferences.blur && (
        <p className="muted-text">
          Backdrop blur is unavailable. The readable CSS fallback is active.
        </p>
      )}
      {noOptics && (
        <p className="muted-text">
          Refraction needs Optical quality, SVG backdrop support and normal
          motion/transparency preferences. Your saved intensity is kept.
        </p>
      )}
      {simple && (
        <p className="muted-text">
          Simple mode keeps tint, opacity, edges and soft shadows; blur, pointer
          lighting and optical effects are off.
        </p>
      )}
      {solid && (
        <p className="muted-text">
          Your system requests solid / high-contrast materials. Translucency
          settings are retained for when that preference is off.
        </p>
      )}
    </div>
  );
}
export function WidgetGlassControls({
  global,
  value,
  title,
  onChange,
}: {
  global: GlassSettings;
  value: WidgetGlass | undefined;
  title: string;
  onChange: (value: WidgetGlass | undefined) => void;
}) {
  const material = { ...materialFromGlobal(global), ...value };
  return (
    <section
      className="widget-glass-settings"
      aria-label={`${title} glass settings`}
    >
      <h4>Material for this widget</h4>
      <label className="setting-toggle">
        Use global glass settings
        <input
          type="checkbox"
          aria-label={`Use global glass for ${title}`}
          checked={!value}
          onChange={(event) => onChange(event.target.checked ? undefined : {})}
        />
      </label>
      {value && (
        <>
          <label className="setting-toggle">
            Enable glass on this widget
            <input
              type="checkbox"
              aria-label={`Enable glass for ${title}`}
              checked={material.enabled}
              disabled={!global.enabled}
              onChange={(event) =>
                onChange({ ...value, enabled: event.target.checked })
              }
            />
          </label>
          <GlassMaterialControls
            value={material}
            prefix={`${title} `}
            disabled={!global.enabled || !material.enabled}
            simple={global.performance === "simple"}
            optical={global.performance === "optical"}
            onChange={(patch) => onChange({ ...value, ...patch })}
          />
          <button onClick={() => onChange(undefined)}>
            Reset {title} glass to global
          </button>
        </>
      )}
      {!global.enabled && (
        <p className="muted-text">
          Global glass is off. All widgets use the solid material until it is
          enabled.
        </p>
      )}
    </section>
  );
}
