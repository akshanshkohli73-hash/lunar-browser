import { AQUA_OPTICS } from "../../shared/aqua";
import { springStep, type Rect, type Spring } from "../../shared/liquid";
export type SurfacePhysics = { x: Spring; y: Spring; press: Spring };
export const freshPhysics = (): SurfacePhysics => ({
  x: { value: 0, velocity: 0 },
  y: { value: 0, velocity: 0 },
  press: { value: 0, velocity: 0 },
});
/** Event delegation only. Does not capture/prevent pointers, move controls or change focus. */
export class LiquidInteractionController {
  x = -10000;
  y = -10000;
  down = false;
  dragging = false;
  fine = true;
  private target: EventTarget | null = null;
  private remove: () => void = () => {};
  private serial = 0;
  private impulse: {
    serial: number;
    at: number;
    x: number;
    y: number;
    allowed: boolean;
  } | null = null;
  private ripples = new WeakMap<
    SurfacePhysics,
    {
      serial: number;
      at: number;
      age: number;
      x: number;
      y: number;
      allowed: boolean;
    }
  >();
  private pulse() {
    this.impulse = {
      serial: ++this.serial,
      at: performance.now(),
      x: this.x,
      y: this.y,
      allowed: !(
        this.target instanceof Element &&
        this.target.closest("input,textarea,[contenteditable=true],[inert]")
      ),
    };
  }
  clearRipples() {
    this.impulse = null;
    this.ripples = new WeakMap();
  }
  constructor(private invalidate: () => void) {}
  move = (event: PointerEvent | DragEvent) => {
    this.x = event.clientX;
    this.y = event.clientY;
    this.target = event.target;
    this.invalidate();
  };
  reset = () => {
    this.x = this.y = -10000;
    this.down = false;
    this.dragging = false;
    this.target = null;
    this.clearRipples();
    this.invalidate();
  };
  mount(root: Document) {
    const down = (event: PointerEvent) => {
      this.move(event);
      this.down = true;
      this.pulse();
      this.invalidate();
    };
    const up = () => {
      this.down = false;
      this.dragging = false;
      this.invalidate();
    };
    const drag = (event: DragEvent) => {
      this.move(event);
      this.dragging = true;
      this.down = true;
      this.invalidate();
    };
    const key = (event: KeyboardEvent) => {
      if (
        !["Enter", " "].includes(event.key) ||
        !(event.target instanceof HTMLElement) ||
        event.target.matches("input,textarea,[contenteditable=true]")
      )
        return;
      const rect = event.target.getBoundingClientRect();
      this.x = rect.x + rect.width / 2;
      this.y = rect.y + rect.height / 2;
      this.target = event.target;
      this.down = event.type === "keydown";
      if (this.down && !event.repeat) this.pulse();
      this.invalidate();
    };
    root.addEventListener("pointerdown", down, {
      passive: true,
      capture: true,
    });
    root.addEventListener("pointerup", up, { passive: true, capture: true });
    root.addEventListener("pointercancel", up, {
      passive: true,
      capture: true,
    });
    root.addEventListener("dragstart", drag, { passive: true, capture: true });
    root.addEventListener("dragover", drag, { passive: true, capture: true });
    root.addEventListener("dragend", up, true);
    root.addEventListener("drop", up, true);
    root.addEventListener("keydown", key, true);
    root.addEventListener("keyup", key, true);
    window.addEventListener("blur", this.reset);
    this.remove = () => {
      root.removeEventListener("pointerdown", down, true);
      root.removeEventListener("pointerup", up, true);
      root.removeEventListener("pointercancel", up, true);
      root.removeEventListener("dragstart", drag, true);
      root.removeEventListener("dragover", drag, true);
      root.removeEventListener("dragend", up, true);
      root.removeEventListener("drop", up, true);
      root.removeEventListener("keydown", key, true);
      root.removeEventListener("keyup", key, true);
      window.removeEventListener("blur", this.reset);
    };
  }
  advance(
    state: SurfacePhysics,
    rect: Rect,
    seconds: number,
    response: number,
    enabled: boolean,
    now = performance.now(),
  ) {
    const localX = ((this.x - rect.x) / Math.max(1, rect.width)) * 2 - 1,
      localY = ((this.y - rect.y) / Math.max(1, rect.height)) * 2 - 1;
    const distance = Math.hypot(
      Math.max(rect.x - this.x, 0, this.x - rect.x - rect.width),
      Math.max(rect.y - this.y, 0, this.y - rect.y - rect.height),
    );
    const near = Math.max(0, 1 - distance / 96);
    const inside = Math.abs(localX) <= 1 && Math.abs(localY) <= 1;
    const editable =
      this.target instanceof Element &&
      !!this.target.closest("input,textarea,[contenteditable=true],[inert]");
    const press = enabled && inside && this.down && !editable ? 1 : 0;
    const bend =
      enabled && (this.fine || this.down)
        ? near * (this.dragging ? 0.85 : 0.32)
        : 0;
    state.x = springStep(
      state.x,
      bend ? Math.max(-1, Math.min(1, localX)) * bend : 0,
      seconds,
      response,
    );
    state.y = springStep(
      state.y,
      bend ? Math.max(-1, Math.min(1, localY)) * bend : 0,
      seconds,
      response,
    );
    state.press = springStep(state.press, press, seconds, response);
    if (
      this.impulse &&
      this.ripples.get(state)?.serial !== this.impulse.serial
    ) {
      const x = (this.impulse.x - rect.x) / Math.max(1, rect.width),
        y = (this.impulse.y - rect.y) / Math.max(1, rect.height);
      this.ripples.set(state, {
        serial: this.impulse.serial,
        at: this.impulse.at,
        age: 0,
        x,
        y,
        allowed:
          enabled &&
          this.impulse.allowed &&
          x >= 0 &&
          x <= 1 &&
          y >= 0 &&
          y <= 1,
      });
    }
    const ripple = this.ripples.get(state);
    if (ripple)
      ripple.age = Math.min(
        AQUA_OPTICS.rippleSeconds,
        // Also age in real time: a hidden/new surface must not replay an old
        // press merely because it did not participate in previous frames.
        Math.max(
          ripple.age +
            Math.max(0, Math.min(0.05, seconds)) *
              Math.max(0.25, Math.min(3.5, response)),
          (Math.max(0, now - ripple.at) / 1000) *
            Math.max(0.25, Math.min(3.5, response)),
        ),
      );
    const rippling =
      !!ripple?.allowed && ripple.age < AQUA_OPTICS.rippleSeconds;
    const envelope = rippling
      ? Math.sin((Math.PI * ripple.age) / AQUA_OPTICS.rippleSeconds) *
        Math.exp(-ripple.age * 3)
      : 0;
    const settling =
      rippling || [state.x, state.y, state.press].some((s) => s.velocity !== 0);
    return {
      bend: [state.x.value, state.y.value, state.press.value] as [
        number,
        number,
        number,
      ],
      pointer: [state.x.value, state.y.value] as [number, number],
      ripple: (rippling
        ? [ripple.x, ripple.y, ripple.age, envelope]
        : [0.5, 0.5, 0, 0]) as [number, number, number, number],
      settling,
    };
  }
  dispose() {
    this.remove();
    this.remove = () => {};
    this.reset();
  }
}
