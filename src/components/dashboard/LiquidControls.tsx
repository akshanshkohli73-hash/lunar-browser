import { useEffect, useState } from "react";
import {
  DEFAULT_LIQUID,
  liquidSchema,
  type LiquidSettings,
} from "../../../shared/liquid";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { GlassSlider } from "../ui/GlassControls";
const controls = [
  ["edgeLensing", "Edge lensing", 0, 1, 0.05],
  ["specular", "Specular intensity", 0, 1, 0.05],
  ["curvature", "Glass curvature", 0, 1, 0.05],
  ["elasticity", "Surface elasticity", 0, 1, 0.05],
  ["responsiveness", "Motion responsiveness", 0.25, 2, 0.05],
] as const;
export function LiquidControls({
  value,
  onChange,
  disabled,
}: {
  value: LiquidSettings;
  onChange: (patch: Partial<LiquidSettings>) => void;
  disabled: boolean;
}) {
  const { liquidStatus, reduced, preferences, settings } = useGlassMaterial();
  const [expanded, setExpanded] = useState(false),
    [metrics, setMetrics] = useState("");
  useEffect(() => {
    if (!expanded) return;
    const update = () => {
      const raw = document.querySelector<HTMLCanvasElement>(
        "canvas[data-liquid-renderer]",
      )?.dataset.metrics;
      if (!raw) {
        setMetrics("No GPU frame measured. Pearl CSS remains functional.");
        return;
      }
      try {
        const m = JSON.parse(raw) as {
          atlasWidth: number;
          atlasHeight: number;
          resolutionScale: number;
          surfaces: number;
          cpuSubmitComposeMs: number;
          gpuMs: number | null;
          textureUploads: number;
        };
        setMetrics(
          `${m.surfaces} surfaces · atlas ${m.atlasWidth} × ${m.atlasHeight} · scale ${m.resolutionScale.toFixed(2)} · last CPU submission/composition ${m.cpuSubmitComposeMs.toFixed(2)} ms · ${m.gpuMs === null ? "GPU timer unavailable" : `GPU ${m.gpuMs.toFixed(2)} ms`} · ${m.textureUploads} source uploads. This is a measurement, not a hardware FPS guarantee.`,
        );
      } catch {
        setMetrics("Measurement unavailable.");
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expanded]);
  const unavailable =
    disabled ||
    reduced ||
    preferences.transparency ||
    preferences.forcedColors ||
    !liquidStatus.supported ||
    !liquidStatus.active ||
    value.quality === "performance" ||
    settings.performance !== "optical" ||
    liquidStatus.reason === "background-origin";
  return (
    <section
      className="liquid-engine-controls"
      aria-label="Liquid Engine controls"
    >
      <h4>Liquid Engine</h4>
      <label>
        Render quality
        <select
          aria-label="Render quality"
          value={value.quality}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              quality: liquidSchema.shape.quality.parse(event.target.value),
            })
          }
        >
          <option value="performance">Performance · Pearl CSS</option>
          <option value="balanced">
            Balanced · shared GPU, scaled / 30 Hz cap
          </option>
          <option value="high">High · shared GPU, up to 60 Hz</option>
          <option value="experimental">
            Experimental · higher resolution / sampling
          </option>
        </select>
      </label>
      <p className="liquid-engine-status" role="status">
        {liquidStatus.active
          ? "WebGL2 · one shared wallpaper texture and renderer. Shader lensing is active."
          : `Pearl CSS · ${liquidStatus.reason.replaceAll("-", " ")}. A non-refractive pearl-aqua material; shader-only controls are retained but disabled when unavailable.`}{" "}
        Wallpaper pixels only; native webpages are not captured. Refraction,
        tint, blur and animation speed use the shared controls below.
      </p>
      <div className="glass-control-grid">
        {controls.map(([key, label, min, max, step]) => (
          <GlassSlider
            key={key}
            label={label}
            value={value[key]}
            min={min}
            max={max}
            step={step}
            disabled={unavailable}
            onChange={(amount) => onChange({ [key]: amount })}
          />
        ))}
      </div>
      <button disabled={disabled} onClick={() => onChange(DEFAULT_LIQUID)}>
        Reset Liquid Engine
      </button>
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>Rendering measurements</summary>
        <output className="liquid-telemetry">{metrics}</output>
      </details>
    </section>
  );
}
