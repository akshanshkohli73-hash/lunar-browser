import {
  forwardRef,
  memo,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import {
  resolveGlass,
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
    const variables = useMemo(
      () =>
        ({
          "--glass-opacity": tokens.opacity,
          "--glass-blur": `${tokens.blur}px`,
          "--glass-tint": tokens.tint,
          "--glass-border": tokens.border,
          "--glass-reflection": tokens.reflection,
          "--glass-shadow": tokens.shadow,
          ...style,
        }) as CSSProperties,
      [tokens, style],
    );
    return (
      <div
        {...props}
        ref={ref}
        className={`glass-surface glass-${variant} ${className}`}
        data-glass-mode={tokens.mode}
        data-glass-tone={tone}
        data-glass-active={String(active)}
        style={variables}
      >
        {children}
      </div>
    );
  }),
);
