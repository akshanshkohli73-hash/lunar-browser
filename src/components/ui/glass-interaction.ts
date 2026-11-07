import { dockProximity, interpolate } from "../../../shared/motion";

/** One delegated pointer stream and one settling RAF, shared by every surface and dock.
 * Writes CSS variables only; never changes React state, focus, bounds or pointer capture. */
export function createGlassInteractions(root: Document, speed: number) {
  let frame = 0,
    previousTime = 0,
    alive = true;
  let surface: HTMLElement | null = null,
    retiring: HTMLElement | null = null;
  let targetX = 50,
    targetY = 35,
    x = 50,
    y = 35,
    light = 0,
    retiringLight = 0;
  const dockValues = new Map<HTMLElement, { value: number; target: number }>();
  const clearSurface = (node: HTMLElement | null) => {
    node?.style.removeProperty("--glass-pointer-x");
    node?.style.removeProperty("--glass-pointer-y");
    node?.style.removeProperty("--glass-pointer-presence");
  };
  const tick = (now: number) => {
    frame = 0;
    if (!alive) return;
    const elapsed = previousTime ? now - previousTime : 16;
    previousTime = now;
    let settling = false;
    x = interpolate(x, targetX, elapsed, speed);
    y = interpolate(y, targetY, elapsed, speed);
    light = interpolate(light, surface ? 1 : 0, elapsed, speed);
    if (surface) {
      surface.style.setProperty("--glass-pointer-x", `${x.toFixed(2)}%`);
      surface.style.setProperty("--glass-pointer-y", `${y.toFixed(2)}%`);
      surface.style.setProperty("--glass-pointer-presence", light.toFixed(3));
      settling ||=
        Math.abs(x - targetX) + Math.abs(y - targetY) > 0.08 || light < 0.995;
    }
    if (retiring) {
      retiringLight = interpolate(retiringLight, 0, elapsed, speed);
      retiring.style.setProperty(
        "--glass-pointer-presence",
        retiringLight.toFixed(3),
      );
      if (retiringLight < 0.005) {
        clearSurface(retiring);
        retiring = null;
      } else settling = true;
    }
    for (const [node, state] of dockValues) {
      state.value = interpolate(state.value, state.target, elapsed, speed);
      const done = Math.abs(state.value - state.target) < 0.001;
      node.style.setProperty(
        "--dock-proximity",
        (done ? state.target : state.value).toFixed(4),
      );
      settling ||= !done;
      if (done && !state.target) {
        node.style.removeProperty("--dock-proximity");
        dockValues.delete(node);
      }
    }
    if (settling) schedule();
    else previousTime = 0;
  };
  const schedule = () => {
    if (!frame && alive) frame = requestAnimationFrame(tick);
  };
  const reset = () => {
    clearSurface(retiring);
    retiring = surface;
    retiringLight = light;
    surface = null;
    for (const state of dockValues.values()) state.target = 0;
    schedule();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType && !["mouse", "pen"].includes(event.pointerType)) {
      reset();
      return;
    }
    if (!(event.target instanceof Element)) return;
    const owner = event.target.closest<HTMLElement>(
      '[data-glass-light="true"],[data-glass-owner="true"]',
    );
    const next = owner?.matches("[data-glass-owner]")
      ? owner.querySelector<HTMLElement>(":scope > .glass-backing")
      : owner;
    if (next !== surface) {
      clearSurface(retiring);
      retiring = surface;
      retiringLight = light;
      surface = next ?? null;
      light = 0;
      // Start at the entry point, with intensity eased in rather than a highlight jumping across the pane.
      if (surface) {
        const box = surface.getBoundingClientRect();
        x = targetX = Math.max(
          0,
          Math.min(100, ((event.clientX - box.left) / box.width) * 100),
        );
        y = targetY = Math.max(
          0,
          Math.min(100, ((event.clientY - box.top) / box.height) * 100),
        );
      }
    } else if (surface) {
      const box = surface.getBoundingClientRect();
      targetX = Math.max(
        0,
        Math.min(100, ((event.clientX - box.left) / box.width) * 100),
      );
      targetY = Math.max(
        0,
        Math.min(100, ((event.clientY - box.top) / box.height) * 100),
      );
    }
    for (const state of dockValues.values()) state.target = 0;
    const dock = event.target.closest<HTMLElement>('[data-glass-dock="true"]');
    if (dock && root.documentElement.dataset.dockMagnify !== "false")
      for (const button of dock.querySelectorAll<HTMLElement>(
        ".lunar-dock-button:not(:disabled)",
      )) {
        const box = button.getBoundingClientRect();
        const target = dockProximity(
          event.clientX - (box.left + box.width / 2),
        );
        if (target || dockValues.has(button)) {
          const state = dockValues.get(button) ?? { value: 0, target: 0 };
          state.target = target;
          dockValues.set(button, state);
        }
      }
    if (surface || retiring || dockValues.size) schedule();
  };
  const out = (event: PointerEvent) => {
    if (!event.relatedTarget) reset();
  };
  const hidden = () => {
    if (root.hidden) reset();
  };
  root.addEventListener("pointermove", move, { passive: true });
  root.addEventListener("pointerout", out, { passive: true });
  root.addEventListener("visibilitychange", hidden);
  window.addEventListener("blur", reset);
  window.addEventListener("resize", reset, { passive: true });
  return () => {
    alive = false;
    if (frame) cancelAnimationFrame(frame);
    clearSurface(surface);
    clearSurface(retiring);
    for (const node of dockValues.keys())
      node.style.removeProperty("--dock-proximity");
    dockValues.clear();
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerout", out);
    root.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("blur", reset);
    window.removeEventListener("resize", reset);
  };
}
