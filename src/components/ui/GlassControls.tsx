import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { lunarSpring } from "../../../shared/motion";
import { motion } from "framer-motion";
import {
  GlassSurface,
  useGlassSurface,
  type GlassSurfaceProps,
} from "./GlassSurface";

/** No nested backdrop pass on controls: they share the owner's material and optical texture. */
export const GlassButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function GlassButton({ className = "", ...props }, ref) {
  return (
    <button {...props} ref={ref} className={`glass-button ${className}`} />
  );
});
export function GlassBacking({ className = "", ...props }: GlassSurfaceProps) {
  return (
    <GlassSurface
      {...props}
      aria-hidden="true"
      className={`glass-backing ${className}`}
    />
  );
}
export function GlassToolbar({ children, ...props }: GlassSurfaceProps) {
  return (
    <GlassBacking {...props} level={props.level ?? "light"}>
      {children}
    </GlassBacking>
  );
}
export function GlassPanel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <GlassSurface
      {...props}
      level="deep"
      className={`glass-panel ${className}`}
    >
      {children}
    </GlassSurface>
  );
}
export function GlassSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  output,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  output?: ReactNode;
}) {
  return (
    <label className="glass-slider">
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{output ?? `${Math.round(value * 100)}%`}</output>
    </label>
  );
}

/** Native fieldset/disabled semantics and a single separate optical backing. */
export function GlassFieldset({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const { settings, reduced, foreground } = useGlassMaterial();
  const { style } = useGlassSurface({ level: "deep" });
  return (
    <motion.fieldset
      disabled={disabled}
      className="glass-fieldset"
      data-glass-owner="true"
      style={style}
      initial={reduced || !foreground ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={lunarSpring(settings.animationSpeed, reduced || !foreground)}
    >
      <GlassBacking level="deep" />
      {children}
    </motion.fieldset>
  );
}
/** Finite entry only: changing a settings tab immediately releases its old preview owner. */
export function GlassSectionMotion({ children }: { children: ReactNode }) {
  const { settings, reduced, foreground } = useGlassMaterial();
  return (
    <motion.div
      className="glass-section-motion"
      initial={reduced || !foreground ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={lunarSpring(settings.animationSpeed, reduced || !foreground)}
    >
      {children}
    </motion.div>
  );
}
