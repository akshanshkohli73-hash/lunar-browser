import {
  glassMaterialSchema,
  type GlassSettings,
  type WidgetGlass,
} from "../../../shared/glass";
const sliders = [
  ["opacity", "Glass opacity", 0.6, 1, 0.01],
  ["blur", "Blur intensity", 0, 24, 1],
  ["border", "Border intensity", 0, 1, 0.05],
  ["reflection", "Reflection intensity", 0, 1, 0.05],
  ["shadow", "Shadow strength", 0, 1, 0.05],
] as const;
/** Used for global materials and the selected widget's sparse override. */
export function GlassMaterialControls({
  value,
  onChange,
  disabled = false,
  simple = false,
  prefix = "",
}: {
  value: Omit<GlassSettings, "performance">;
  onChange: (value: WidgetGlass) => void;
  disabled?: boolean;
  simple?: boolean;
  prefix?: string;
}) {
  const supportsBlur =
    typeof CSS === "undefined" ||
    typeof CSS.supports !== "function" ||
    CSS.supports("backdrop-filter", "blur(1px)") ||
    CSS.supports("-webkit-backdrop-filter", "blur(1px)");
  return (
    <div className="glass-control-grid">
      {sliders.map(([key, label, min, max, step]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            type="range"
            aria-label={`${prefix}${label}`}
            min={min}
            max={max}
            step={step}
            value={value[key]}
            disabled={
              disabled ||
              (simple && (key === "blur" || key === "reflection")) ||
              (!supportsBlur && key === "blur")
            }
            onChange={(event) =>
              onChange({ [key]: Number(event.target.value) })
            }
          />
          <output>
            {key === "blur"
              ? `${value[key]}px`
              : `${Math.round(value[key] * 100)}%`}
          </output>
        </label>
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
      {!supportsBlur && (
        <p className="muted-text">
          Backdrop blur is unavailable in this renderer. The readable solid
          fallback is active.
        </p>
      )}
      {simple && (
        <p className="muted-text">
          Simple mode keeps tint, opacity, borders and soft shadows; blur and
          reflections are off.
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
  const material = { ...global, ...value };
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
          onChange={(event) =>
            onChange(
              event.target.checked
                ? undefined
                : glassMaterialSchema.parse(globalWithoutPerformance(global)),
            )
          }
        />
      </label>
      {value && (
        <>
          <label className="setting-toggle">
            Enable glass on this widget
            <input
              type="checkbox"
              aria-label={`Enable glass for ${title}`}
              checked={value.enabled ?? true}
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
function globalWithoutPerformance({
  performance: _performance,
  ...material
}: GlassSettings) {
  return material;
}
