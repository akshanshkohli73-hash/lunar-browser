import {
  forwardRef,
  memo,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import {
  resolveGlass,
  glassDepth,
  MATERIAL_COLORS,
  type GlassLevel,
  type GlassSettings,
  type GlassTone,
  type WidgetGlass,
} from "../../../shared/glass";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { useWorkspaceActivity } from "../../state/WorkspaceActivity";
import "./glass.css";
export type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  material?: GlassSettings;
  override?: WidgetGlass;
  tone?: GlassTone;
  active?: boolean;
  level?: GlassLevel;
  scope?: "workspace" | "overlay";
  variant?: "pane" | "clock" | "search" | "notes" | "calendar" | "weather";
};
/** Used by both actual surfaces and semantic chrome backings. No renderer privileges. */
export function useGlassSurface({
  material,
  override,
  tone: explicitTone,
  active = true,
  level = "standard",
  scope = "workspace",
}: Pick<
  GlassSurfaceProps,
  "material" | "override" | "tone" | "active" | "level" | "scope"
> = {}) {
  const context = useGlassMaterial(),
    workspace = useWorkspaceActivity();
  const tone = explicitTone ?? context.tone;
  const available = scope === "overlay" ? context.foreground : workspace;
  const tokens = useMemo(
    () =>
      resolveGlass(material ?? context.settings, override, active && available),
    [material, context.settings, override, active, available],
  );
  const depth = useMemo(
    () => glassDepth(tokens, level, tone),
    [tokens, level, tone],
  );
  const fallback =
    context.preferences.transparency || context.preferences.forcedColors;
  const mode = fallback ? "solid" : tokens.mode;
  const optical =
    mode === "glass" &&
    context.preferences.svg &&
    context.filterPrefix &&
    tokens.refraction > 0 &&
    !context.reduced;
  const filter = optical
    ? `url("#${context.filterPrefix}-${Math.max(1, Math.round(tokens.refraction * 10))}")`
    : "";
  const colors = MATERIAL_COLORS[tone];
  const style = useMemo(
    () =>
      ({
        "--glass-opacity": tokens.opacity,
        "--glass-alpha": depth.alpha,
        "--glass-wash-start": `${(depth.wash + 0.08) * 100}%`,
        "--glass-wash-end": `${depth.wash * 100}%`,
        "--glass-effective-blur": `${mode === "glass" ? depth.blur : 0}px`,
        "--glass-saturation": depth.saturation,
        "--glass-elevation": `${depth.elevation}px`,
        "--glass-spread": `${depth.spread}px`,
        "--glass-blur": `${tokens.blur}px`,
        "--glass-tint": tokens.tint,
        "--glass-adaptive-tint": (material ?? context.settings).adaptive
          ? context.appearance.color
          : tokens.tint,
        "--glass-border": tokens.border,
        "--glass-reflection": mode === "glass" ? tokens.reflection : 0,
        "--glass-shadow": tokens.shadow,
        "--glass-refraction-filter": filter,
        "--glass-refraction": optical ? tokens.refraction : 0,
        "--glass-refraction-strength": tokens.refraction,
        "--glass-paper": colors.paper,
        "--glass-ink": colors.ink,
        "--glass-muted": colors.muted,
        "--glass-edge": colors.edge,
        "--glass-depth": colors.depth,
      }) as CSSProperties,
    [
      tokens,
      depth,
      mode,
      filter,
      optical,
      colors,
      material,
      context.settings,
      context.appearance.color,
    ],
  );
  return {
    style,
    "data-glass-mode": mode,
    "data-glass-tone": tone,
    "data-glass-level": level,
    "data-glass-active": String(active && available),
    "data-glass-light": String(
      mode === "glass" && active && available && !context.reduced,
    ),
    "data-glass-environment": context.appearance.source,
    "data-glass-scope": scope,
    "data-glass-fallback": optical
      ? "svg-backdrop"
      : mode === "glass" && context.preferences.blur
        ? "css-backdrop"
        : "fallback",
    "data-glass-backend": optical
      ? "svg-backdrop"
      : mode === "glass" && context.preferences.blur
        ? "css-backdrop"
        : "fallback",
  } as const;
}
export const GlassSurface = memo(
  forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
    {
      material,
      override,
      tone,
      active,
      level,
      scope,
      variant = "pane",
      children,
      className = "",
      style,
      ...props
    },
    ref,
  ) {
    const surface = useGlassSurface({
      material,
      override,
      tone,
      active,
      level,
      scope,
    });
    return (
      <div
        {...props}
        {...surface}
        ref={ref}
        className={`glass-surface glass-${variant} ${className}`}
        style={{ ...surface.style, ...style }}
      >
        {children}
      </div>
    );
  }),
);
