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
  type GlassLevel,
  type GlassSettings,
  type GlassTone,
  type WidgetGlass,
} from "../../../shared/glass";
import "./glass.css";

type Props = HTMLAttributes<HTMLDivElement> & {
  material: GlassSettings;
  override?: WidgetGlass;
  tone?: GlassTone;
  active?: boolean;
  level?: GlassLevel;
  variant?: "pane" | "clock" | "search" | "notes" | "calendar" | "weather";
};
/** Static composited material. No pointer tracking, animation loop, canvas or nested blur. */
export const GlassSurface = memo(
  forwardRef<HTMLDivElement, Props>(function GlassSurface(
    {
      material,
      override,
      tone = "light",
      active = true,
      variant = "pane",
      level = "standard",
      children,
      className = "",
      style,
      ...props
    },
    ref,
  ) {
    const tokens = useMemo(
      () => resolveGlass(material, override, active),
      [material, override, active],
    );
    const depth = useMemo(
      () => glassDepth(tokens, level, tone),
      [tokens, level, tone],
    );
    const variables = useMemo(
      () =>
        ({
          "--glass-opacity": tokens.opacity,
          "--glass-alpha": depth.alpha,
          "--glass-wash-start": `${(depth.wash + 0.08) * 100}%`,
          "--glass-wash-end": `${depth.wash * 100}%`,
          "--glass-effective-blur": `${depth.blur}px`,
          "--glass-saturation": depth.saturation,
          "--glass-elevation": `${depth.elevation}px`,
          "--glass-spread": `${depth.spread}px`,
          "--glass-blur": `${tokens.blur}px`,
          "--glass-tint": tokens.tint,
          "--glass-border": tokens.border,
          "--glass-reflection": tokens.reflection,
          "--glass-shadow": tokens.shadow,
          ...style,
        }) as CSSProperties,
      [tokens, depth, style],
    );
    return (
      <div
        {...props}
        ref={ref}
        className={`glass-surface glass-${variant} ${className}`}
        data-glass-mode={tokens.mode}
        data-glass-level={level}
        data-glass-tone={tone}
        data-glass-active={String(active)}
        style={variables}
      >
        {children}
      </div>
    );
  }),
);
