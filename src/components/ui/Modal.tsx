import { motion, useIsPresent } from "framer-motion";
import { lunarSpring } from "../../../shared/motion";
import { useGlassMaterial } from "../../state/GlassMaterialProvider";
import { GlassBacking, GlassButton } from "./GlassControls";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { settings, reduced, registerOverlay } = useGlassMaterial();
  const present = useIsPresent(),
    isPresent = useRef(present);
  isPresent.current = present;
  // Lifecycle, not just the caller's open flag: a native WebContentsView must
  // stay covered until the portal's actual animated unmount.
  useLayoutEffect(registerOverlay, [registerOverlay]);
  const backdrop = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (backdrop.current) backdrop.current.inert = !present;
  }, [present]);
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const node = ref.current;
    const focusable = () =>
      [
        ...(node?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? []),
      ].filter(
        (element) => !element.closest('[hidden],[inert],[aria-hidden="true"]'),
      );
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (!isPresent.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable(),
        first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      if (
        previous?.isConnected &&
        (document.activeElement === document.body ||
          node?.contains(document.activeElement))
      )
        previous.focus();
    };
  }, []);
  return createPortal(
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.14 / settings.animationSpeed }}
      aria-hidden={!present || undefined}
      ref={backdrop}
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={reduced ? false : { y: 8, scale: 0.99 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 5, scale: 0.995 }}
        transition={lunarSpring(settings.animationSpeed, reduced, true)}
        data-glass-owner="true"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="lunar-modal"
        ref={ref}
      >
        <GlassBacking level="deep" scope="overlay" />
        <header>
          <h2>{title}</h2>
          <GlassButton onClick={onClose} aria-label={`Close ${title}`}>
            <Icon name="x" />
          </GlassButton>
        </header>
        <div className="lunar-modal-body">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
