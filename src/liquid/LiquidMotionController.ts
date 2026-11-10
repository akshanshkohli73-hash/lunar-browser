import { mixRect, morphEase, type Rect } from "../../shared/liquid";
import type { LiquidMaterial } from "./LiquidMaterial";
export type Morph = {
  owner: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  source: Rect;
  radius: number;
  start: number;
  exit: boolean;
  duration: number;
  elapsed: number;
  last: number;
};
/** Material-only proxies: final DOM hit boxes/focus controllers never follow the morph. */
export class LiquidMotionController {
  private seen = new WeakSet<HTMLElement>();
  private exiting = new WeakSet<HTMLElement>();
  private morphs = new Map<HTMLElement, Morph>();
  constructor(private invalidate: () => void) {}
  maybeStart(node: HTMLElement, box: Rect, speed: number, exiting = false) {
    const owner = node.closest<HTMLElement>("[data-liquid-morph]");
    if (
      !owner ||
      (!exiting && this.seen.has(owner)) ||
      (exiting && this.exiting.has(owner))
    )
      return;
    this.seen.add(owner);
    if (exiting) this.exiting.add(owner);
    const id = owner.dataset.liquidMorph;
    const trigger = [
      ...document.querySelectorAll<HTMLElement>("[data-liquid-trigger]"),
    ].find(
      (e) =>
        e.dataset.liquidTrigger === id && e.getBoundingClientRect().width > 0,
    );
    if (!trigger) return;
    this.stop(owner);
    const source = trigger.getBoundingClientRect(),
      canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.className = "liquid-morph-proxy";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.liquidProxy = "true";
    canvas.dataset.liquidMorphTarget = id;
    document.body.append(canvas);
    const radius =
      parseFloat(getComputedStyle(trigger).borderRadius) ||
      Math.min(source.width, source.height) / 2;
    const morph = {
      owner,
      canvas,
      context,
      source: {
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
      },
      radius,
      start: performance.now(),
      exit: exiting,
      duration: (exiting ? 110 : 280) / speed,
      elapsed: 0,
      last: performance.now(),
    };
    if (exiting) morph.source = box;
    this.morphs.set(owner, morph);
    owner.dataset.liquidMorphing = "true";
    this.invalidate();
  }
  frame(node: HTMLElement, box: Rect, material: LiquidMaterial, now: number) {
    const owner = node.closest<HTMLElement>("[data-liquid-morph]"),
      morph = owner ? this.morphs.get(owner) : undefined;
    if (!morph) return null;
    // Do not skip the entire shape transition after a driver/context-recovery
    // hitch. Entry time is bounded-stepped; exits still honor native occlusion's
    // short wall-clock deadline and never outlive their mounted portal.
    morph.elapsed += Math.max(0, Math.min(40, now - morph.last));
    morph.last = Math.max(morph.last, now);
    const progress = Math.min(
      1,
      Math.max(
        0,
        (morph.exit ? now - morph.start : morph.elapsed) / morph.duration,
      ),
    );
    if (!morph.exit && now - morph.start > 900) {
      this.stop(morph.owner);
      return null;
    }
    if (progress >= 1) {
      this.stop(morph.owner);
      return null;
    }
    let target = box;
    if (morph.exit) {
      const trigger = [
        ...document.querySelectorAll<HTMLElement>("[data-liquid-trigger]"),
      ].find((e) => e.dataset.liquidTrigger === owner?.dataset.liquidMorph);
      const r = trigger?.getBoundingClientRect();
      if (r) target = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    const t = morphEase(progress),
      rect = mixRect(morph.source, target, t);
    Object.assign(morph.canvas.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    morph.owner.style.setProperty(
      "--liquid-content-opacity",
      String(morph.exit ? 1 - t : Math.max(0, (t - 0.45) / 0.55)),
    );
    return {
      morph,
      rect,
      material: {
        ...material,
        radii: material.radii.map((r) =>
          morph.exit
            ? r + (morph.radius - r) * t
            : morph.radius + (r - morph.radius) * t,
        ) as LiquidMaterial["radii"],
      },
    };
  }
  stop(owner: HTMLElement) {
    const morph = this.morphs.get(owner);
    if (!morph) return;
    morph.canvas.width = morph.canvas.height = 1;
    morph.canvas.remove();
    owner.removeAttribute("data-liquid-morphing");
    owner.style.removeProperty("--liquid-content-opacity");
    this.morphs.delete(owner);
  }
  prune() {
    for (const owner of this.morphs.keys())
      if (!owner.isConnected) this.stop(owner);
  }
  dispose() {
    for (const owner of [...this.morphs.keys()]) this.stop(owner);
    this.seen = new WeakSet();
    this.exiting = new WeakSet();
  }
}
