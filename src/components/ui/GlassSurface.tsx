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
import {
  PEARL_COLORS,
  cssMaterialVariant,
  pearlMaterial,
  widgetMaterialRole,
  type MaterialRole,
  type MaterialVariant,
} from "../../../shared/materials";
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
  materialVariant?: MaterialVariant;
  materialRole?: MaterialRole;
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
  materialVariant = "liquid-webgl",
  materialRole = "widget",
}: Pick<
  GlassSurfaceProps,
  | "material"
  | "override"
  | "tone"
  | "active"
  | "level"
  | "scope"
  | "materialVariant"
  | "materialRole"
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
  const pearl = useMemo(
    () =>
      pearlMaterial(
        tokens,
        depth,
        materialRole,
        tone,
        materialVariant,
        context.preferences.blur,
      ),
    [
      tokens,
      depth,
      materialRole,
      tone,
      materialVariant,
      context.preferences.blur,
    ],
  );
  const cssVariant = cssMaterialVariant(materialVariant);
  const backdrop = mode === "glass" && pearl.backdrop;
  const backend = backdrop ? "css-backdrop" : "css";
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
        "--glass-refraction": 0,
        "--glass-refraction-strength": tokens.refraction,
        "--glass-paper": colors.paper,
        "--glass-ink": colors.ink,
        "--glass-muted": colors.muted,
        "--glass-edge": colors.edge,
        "--glass-depth": colors.depth,
        "--pearl-alpha": pearl.alpha,
        "--pearl-blur": `${pearl.blur}px`,
        "--pearl-sheen": pearl.sheen,
        "--pearl-shadow": pearl.shadow,
        "--pearl-edge": pearl.edge,
        "--pearl-aqua": PEARL_COLORS[tone].aqua,
        "--pearl-highlight": PEARL_COLORS[tone].sheen,
        "--pearl-rim": PEARL_COLORS[tone].rim,
        "--pearl-light-cap": PEARL_COLORS[tone].highlightCap,
      }) as CSSProperties,
    [
      tokens,
      depth,
      mode,
      pearl,
      tone,
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
    "data-material-request": materialVariant,
    // CSS is always painted first. Only the engine promotes an individual surface
    // after a successful pixel composition (not just a WebGL capability probe).
    "data-material-variant": cssVariant,
    "data-material-role": materialRole,
    "data-glass-backdrop": String(backdrop),
    "data-glass-fallback": backend,
    "data-glass-backend": backend,
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
      materialVariant,
      materialRole,
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
      materialVariant,
      materialRole: materialRole ?? widgetMaterialRole(variant),
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
