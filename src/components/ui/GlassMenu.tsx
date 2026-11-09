import { forwardRef, useLayoutEffect, useRef, type ReactNode } from "react";
import { motion, useIsPresent, type HTMLMotionProps } from "framer-motion";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { lunarSpring } from "../../../shared/motion";
import { GlassBacking } from "./GlassControls";
/** Menu semantics and keyboard handlers stay with the existing controller. */
export const GlassMenu = forwardRef<
  HTMLDivElement,
  Omit<HTMLMotionProps<"div">, "children"> & { children?: ReactNode }
>(function GlassMenu({ children, ...props }, ref) {
  const { registerOverlay, reduced, settings } = useGlassMaterial();
  const present = useIsPresent(),
    node = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(registerOverlay, [registerOverlay]);
  useLayoutEffect(() => {
    if (node.current) node.current.inert = !present;
  }, [present]);
  return (
    <motion.div
      {...props}
      ref={(element) => {
        const previous = node.current;
        node.current = element;
        if (typeof ref === "function") ref(element);
        // An outgoing keyed menu must not clear a ref already owned by its replacement.
        else if (ref && (element !== null || ref.current === previous))
          ref.current = element;
      }}
      data-glass-owner="true"
      data-liquid-exiting={!present ? "true" : undefined}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0, y: -4, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -3 }}
      transition={lunarSpring(settings.animationSpeed, reduced, true)}
    >
      <GlassBacking scope="overlay" level="standard" />
      {children}
    </motion.div>
  );
});
