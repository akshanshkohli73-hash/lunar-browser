import { DEFAULT_GLASS, type GlassSettings } from "../../shared/glass";
import {
  LIQUID_QUALITY,
  objectFitRect,
  packAtlas,
  type Rect,
} from "../../shared/liquid";
import { FrameClock } from "./FrameClock";
import {
  BackgroundTextureProvider,
  type Background,
  type BackgroundNode,
  type BackgroundOptions,
} from "./BackgroundTextureProvider";
import { LiquidRenderer, type DrawSurface } from "./LiquidRenderer";
import { readMaterial, type LiquidMaterial } from "./LiquidMaterial";
import {
  freshPhysics,
  LiquidInteractionController,
  type SurfacePhysics,
} from "./LiquidInteractionController";
import { LiquidMotionController } from "./LiquidMotionController";

type Surface = {
  node: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  box: Rect;
  material: LiquidMaterial;
  physics: SurfacePhysics;
  view: boolean;
  signature: string;
};
export type LiquidStatus = {
  supported: boolean;
  active: boolean;
  reason: string;
};
export type EngineOptions = {
  settings: GlassSettings;
  reduced: boolean;
  foreground: boolean;
  transparency: boolean;
  forcedColors: boolean;
  finePointer: boolean;
  identity: string;
};
export class LiquidEngine {
  readonly clock = new FrameClock();
  readonly background = new BackgroundTextureProvider(() => this.invalidate());
  readonly interaction = new LiquidInteractionController(() =>
    this.invalidate(),
  );
  private motion = new LiquidMotionController(() => this.invalidate());
  private options: EngineOptions = {
    settings: DEFAULT_GLASS,
    reduced: false,
    foreground: true,
    transparency: false,
    forcedColors: false,
    finePointer: true,
    identity: "",
  };
  private renderer: LiquidRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private surfaces = new Map<HTMLElement, Surface>();
  private observer: MutationObserver | null = null;
  private resize: ResizeObserver | null = null;
  private frame = 0;
  private alive = false;
  private dirty = true;
  private layoutDirty = true;
  private materialDirty = true;
  private lastTime = 0;
  private lastDraw = 0;
  private hasTexture = false;
  private cached:
    (Omit<Background, "node"> & { kind: "image" | "video" }) | null = null;
  private lost = false;
  private uploadPending = false;
  private generation = 0;
  private scale = 1;
  private slow = 0;
  private fast = 0;
  private ema = 0;
  private draws = 0;
  private sourceUploads = 0;
  private uploadedStamp = "";
  private renderFailed = false;
  private uploadError: string | null = null;
  private status: LiquidStatus = {
    supported: false,
    active: false,
    reason: "initializing",
  };
  private subscribers = new Set<(status: LiquidStatus) => void>();
  private removeEvents: () => void = () => {};
  private layoutSignatures = new WeakMap<HTMLElement, string>();
  registerBackground = (node: BackgroundNode, options: BackgroundOptions) =>
    this.background.register(node, options);
  subscribe = (callback: (status: LiquidStatus) => void) => {
    this.subscribers.add(callback);
    callback(this.status);
    return () => {
      this.subscribers.delete(callback);
    };
  };
  private publish(active: boolean, reason: string) {
    const next = { supported: !!this.renderer && !this.lost, active, reason };
    document.documentElement.dataset.liquidEngine = active ? "webgl2" : "css";
    document.documentElement.dataset.liquidReason = reason;
    if (
      next.supported !== this.status.supported ||
      next.active !== this.status.active ||
      next.reason !== this.status.reason
    ) {
      this.status = next;
      for (const callback of this.subscribers) callback(next);
    }
  }
  mount(root: Document) {
    this.alive = true;
    if (typeof WebGL2RenderingContext !== "undefined") {
      this.canvas = root.createElement("canvas");
      this.canvas.className = "liquid-atlas";
      this.canvas.dataset.liquidRenderer = "true";
      this.canvas.setAttribute("aria-hidden", "true");
      root.body.append(this.canvas);
      const create = () => {
        try {
          this.renderer = new LiquidRenderer(this.canvas!);
          this.renderFailed = false;
          this.uploadError = null;
          this.lost = false;
          this.hasTexture = false;
          this.background.dirty = true;
          this.invalidate(true);
        } catch (error) {
          this.renderer = null;
          if (this.canvas)
            this.canvas.dataset.error =
              error instanceof Error ? error.message : "webgl2-unavailable";
          this.publish(false, "webgl2-unavailable");
        }
      };
      const lost = (event: Event) => {
        event.preventDefault();
        this.lost = true;
        this.generation++;
        this.hasTexture = false;
        this.background.setRunning(false);
        for (const surface of this.surfaces.values())
          surface.canvas.width = surface.canvas.height = 1;
        this.fallback("context-lost");
      };
      const restored = () => {
        // Lost-context resources were invalidated by the browser. Deleting old
        // handles after restoration would poison the new context's error state.
        this.renderer = null;
        create();
      };
      this.canvas.addEventListener("webglcontextlost", lost);
      this.canvas.addEventListener("webglcontextrestored", restored);
      create();
      this.removeEvents = () => {
        this.canvas?.removeEventListener("webglcontextlost", lost);
        this.canvas?.removeEventListener("webglcontextrestored", restored);
      };
    } else this.publish(false, "webgl2-unavailable");
    this.interaction.mount(root);
    if (typeof ResizeObserver !== "undefined")
      this.resize = new ResizeObserver(() => this.invalidate(true));
    const rescan = (parent: ParentNode) => {
      if (
        parent instanceof HTMLElement &&
        parent.matches(".glass-surface[data-glass-mode],[data-liquid-view]")
      )
        this.add(parent);
      for (const node of parent.querySelectorAll<HTMLElement>(
        ".glass-surface[data-glass-mode],[data-liquid-view]",
      ))
        this.add(node);
    };
    rescan(root);
    this.observer = new MutationObserver((mutations) => {
      let layout = false,
        material = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes)
            if (
              node instanceof HTMLElement &&
              !node.matches("canvas,[data-liquid-proxy]")
            )
              rescan(node);
          layout = true;
          continue;
        }
        const target = mutation.target;
        if (
          !(target instanceof HTMLElement) ||
          target.matches("canvas") ||
          target === document.documentElement
        )
          continue;
        if (mutation.attributeName === "style") {
          const signature = [
            target.style.transform,
            target.style.width,
            target.style.height,
            target.style.display,
            target.style.getPropertyValue("--cell-x"),
            target.style.getPropertyValue("--cell-y"),
          ].join("|");
          if (signature !== this.layoutSignatures.get(target)) {
            this.layoutSignatures.set(target, signature);
            layout = true;
          }
          const surface = this.surfaces.get(target);
          if (surface) {
            const signature = this.materialSignature(target);
            if (surface.signature !== signature) {
              surface.signature = signature;
              material = true;
            }
          }
        } else {
          layout = true;
          material = true;
        }
      }
      for (const [node, surface] of this.surfaces)
        if (!node.isConnected) this.remove(surface);
      this.motion.prune();
      if (layout || material) {
        this.layoutDirty ||= layout;
        this.materialDirty ||= material;
        this.invalidate();
      }
    });
    this.observer.observe(root.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "data-glass-mode",
        "data-glass-active",
        "data-glass-fallback",
        "data-liquid-exiting",
        "data-liquid-morph",
      ],
    });
    const moved = () => this.invalidate(true),
      hidden = () => this.invalidate(true);
    root.addEventListener("scroll", moved, { passive: true, capture: true });
    window.addEventListener("resize", moved, { passive: true });
    root.addEventListener("visibilitychange", hidden);
    const old = this.removeEvents;
    this.removeEvents = () => {
      old();
      root.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
      root.removeEventListener("visibilitychange", hidden);
    };
    this.invalidate(true);
  }
  update(options: EngineOptions) {
    if (
      options.settings.liquid.quality !== this.options.settings.liquid.quality
    )
      this.renderFailed = false;
    if (options.identity !== this.options.identity) {
      this.hasTexture = false;
      this.cached = null;
      this.uploadError = null;
      this.renderFailed = false;
      this.generation++;
      this.background.dirty = true;
    }
    this.options = options;
    if (
      !options.foreground ||
      options.reduced ||
      options.transparency ||
      options.forcedColors
    )
      this.background.setRunning(false);
    this.interaction.fine = options.finePointer;
    this.materialDirty = true;
    this.invalidate(true);
  }
  private materialSignature(node: HTMLElement) {
    return [
      "--glass-opacity",
      "--glass-effective-blur",
      "--glass-saturation",
      "--glass-refraction",
      "--glass-reflection",
      "--glass-border",
      "--glass-tint",
      "--glass-adaptive-tint",
    ]
      .map((key) => node.style.getPropertyValue(key))
      .join("|");
  }
  private add(node: HTMLElement) {
    if (!this.renderer || this.surfaces.has(node)) return;
    const canvas = document.createElement("canvas");
    canvas.className = "liquid-surface-canvas";
    canvas.dataset.liquidOutput = "true";
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    node.prepend(canvas);
    const box = node.getBoundingClientRect();
    this.surfaces.set(node, {
      node,
      canvas,
      context,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      material: readMaterial(node, box),
      physics: freshPhysics(),
      view: node.hasAttribute("data-liquid-view"),
      signature: this.materialSignature(node),
    });
    this.resize?.observe(node);
    this.invalidate(true);
  }
  private remove(surface: Surface) {
    this.resize?.unobserve(surface.node);
    surface.canvas.width = surface.canvas.height = 1;
    surface.canvas.remove();
    this.surfaces.delete(surface.node);
    delete surface.node.dataset.liquidBackend;
  }
  invalidate = (layout = false) => {
    if (!this.alive) return;
    this.dirty = true;
    this.layoutDirty ||= layout;
    if (!this.frame) this.frame = this.clock.requestFrame(this.tick);
  };
  private reason() {
    const o = this.options;
    return this.renderFailed
      ? "render-unavailable"
      : this.lost
        ? "context-lost"
        : !this.renderer
          ? "webgl2-unavailable"
          : !o.foreground || document.hidden
            ? "inactive"
            : o.reduced
              ? "reduced-motion"
              : o.transparency || o.forcedColors
                ? "accessibility"
                : !o.settings.enabled
                  ? "disabled"
                  : o.settings.performance !== "optical"
                    ? "material-fallback"
                    : o.settings.liquid.quality === "performance"
                      ? "performance-quality"
                      : "";
  }
  private fallback(reason: string) {
    this.background.setRunning(false);
    this.motion.dispose();
    for (const surface of this.surfaces.values()) this.fallbackSurface(surface);
    this.publish(false, reason);
  }
  private fallbackSurface(surface: Surface) {
    if (surface.node.dataset.liquidBackend !== "css")
      surface.node.dataset.liquidBackend = "css";
    if (surface.node.dataset.glassFallback)
      surface.node.dataset.glassBackend = surface.node.dataset.glassFallback;
    surface.canvas.hidden = true;
  }
  private async upload(source: Background) {
    if (!this.renderer || this.uploadPending) return;
    const generation = this.generation,
      renderer = this.renderer;
    const image = source.node instanceof HTMLImageElement;
    const stamp = this.background.stamp(source.node);
    const metadata = {
      options: { ...source.options },
      box: { ...source.box },
      width: source.width,
      height: source.height,
      kind: image ? ("image" as const) : ("video" as const),
    };
    if (this.hasTexture && stamp === this.uploadedStamp) {
      this.background.dirty = false;
      this.cached = metadata;
      return;
    }
    try {
      if (image) {
        this.uploadPending = true;
        // A single origin-clean bitmap per image fixes SVG raster dimensions
        // (DOM SVG uploads otherwise use layout size, not naturalWidth).
        const factor = Math.min(
          1,
          2048 / Math.max(source.width, source.height),
        );
        const bitmap = await createImageBitmap(source.node, {
          resizeWidth: Math.max(1, Math.round(source.width * factor)),
          resizeHeight: Math.max(1, Math.round(source.height * factor)),
        });
        if (generation !== this.generation || !this.alive) {
          bitmap.close();
          return;
        }
        try {
          renderer.upload(bitmap, bitmap.width, bitmap.height);
        } finally {
          bitmap.close();
        }
      } else renderer.upload(source.node, source.width, source.height);
      this.hasTexture = true;
      this.uploadError = null;
      this.sourceUploads++;
      this.background.dirty = false;
      this.uploadedStamp = stamp;
      this.cached = metadata;
    } catch (error) {
      this.hasTexture = false;
      this.background.dirty = false;
      if (this.canvas)
        this.canvas.dataset.textureError =
          error instanceof Error
            ? error.message.slice(0, 240)
            : "texture-unavailable";
      this.uploadError =
        error instanceof DOMException && error.name === "SecurityError"
          ? "background-origin"
          : "texture-unavailable";
      this.publish(false, this.uploadError);
    } finally {
      this.uploadPending = false;
      if (image) this.invalidate();
    }
  }

  private tick = (time: number) => {
    this.frame = 0;
    if (!this.alive) return;
    const reason = this.reason();
    if (reason) {
      this.fallback(reason);
      return;
    }
    const renderer = this.renderer!,
      quality = LIQUID_QUALITY[this.options.settings.liquid.quality];
    // Keep a single scheduled loop for settling; GPU/video work is capped separately.
    if (time - this.lastDraw < 1000 / quality.fps - 1) {
      this.frame = this.clock.requestFrame(this.tick);
      return;
    }
    const start = performance.now();
    const seconds = this.lastTime
      ? Math.min(0.05, (time - this.lastTime) / 1000)
      : 1 / 60;
    this.lastTime = time;
    const source = this.background.select();
    if (
      source?.node instanceof HTMLVideoElement &&
      !source.node.paused &&
      !source.node.requestVideoFrameCallback
    ) {
      this.fallback("video-frame-events-unavailable");
      return;
    }
    this.background.setRunning(true);
    if (source && this.background.dirty && !this.uploadPending)
      void this.upload(source);

    if (!this.hasTexture || !this.cached) {
      this.fallback(this.uploadError ?? "background-not-ready");
      return;
    }
    const background = source ?? this.cached;
    const scene = objectFitRect(
      background.box,
      background.width,
      background.height,
      background.options.fit,
      background.options.position,
    );
    const selected: Surface[] = [];
    for (const surface of this.surfaces.values()) {
      if (this.layoutDirty) {
        const box = surface.node.getBoundingClientRect();
        surface.box = {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }
      if (this.materialDirty || this.layoutDirty)
        surface.material = readMaterial(surface.node, surface.box);
      const r = surface.box;
      const visible =
        r.width > 1 &&
        r.height > 1 &&
        r.x < innerWidth &&
        r.y < innerHeight &&
        r.x + r.width > 0 &&
        r.y + r.height > 0;
      const eligible =
        surface.view || surface.node.dataset.glassMode === "glass";
      if (visible && eligible) selected.push(surface);
      else this.fallbackSurface(surface);
    }
    selected.sort(
      (a, b) =>
        Number(b.node.classList.contains("glass-backing")) -
        Number(a.node.classList.contains("glass-backing")),
    );
    const surfaces = selected.slice(0, quality.surfaces);
    for (const s of selected.slice(quality.surfaces)) this.fallbackSurface(s);
    const entries: DrawSurface[] = [],
      outputs: {
        canvas: HTMLCanvasElement;
        context: CanvasRenderingContext2D;
      }[] = [];
    let settling = false;
    for (const surface of surfaces) {
      const state = this.interaction.advance(
        surface.physics,
        surface.box,
        seconds,
        this.options.settings.liquid.responsiveness *
          this.options.settings.animationSpeed,
        this.options.settings.hoverMotion ||
          this.interaction.down ||
          this.interaction.dragging,
      );
      settling ||= state.settling;
      surface.canvas.dataset.deformation = JSON.stringify(
        state.bend.map((value) => Number(value.toFixed(5))),
      );
      const owner = surface.node.closest<HTMLElement>("[data-liquid-morph]");
      const morphable =
        !surface.view &&
        surface.node.classList.contains("glass-backing") &&
        owner?.querySelector(":scope > .glass-backing") === surface.node;
      if (morphable) {
        this.motion.maybeStart(
          surface.node,
          surface.box,
          this.options.settings.animationSpeed,
          owner?.dataset.liquidExiting === "true",
        );
      }
      const morph = morphable
        ? this.motion.frame(surface.node, surface.box, surface.material, time)
        : null;
      const box = morph?.rect ?? surface.box;
      let material = morph?.material ?? surface.material;
      if (surface.view)
        material = {
          ...material,
          opacity: 0.6,
          blur: 0,
          saturation: 1,
          refraction: 0,
          reflection: 0,
          edge: 0,
          radii: [12, 12, 12, 12],
        };
      const preview = surface.node.closest<HTMLElement>(".dashboard-preview");
      const previewBox = preview?.getBoundingClientRect();
      const localScene =
        surface.view || previewBox
          ? objectFitRect(
              surface.view ? surface.box : previewBox!,
              background.width,
              background.height,
              background.options.fit,
              background.options.position,
            )
          : scene;
      entries.push({
        rect: box,
        scene: localScene,
        material,
        bend: state.bend,
        pointer: state.pointer,
        view: surface.view,
        shade: background.options.shade,
        backgroundBlur: background.options.blur,
        contain: background.options.fit === "contain",
      });
      outputs.push(
        morph
          ? { canvas: morph.morph.canvas, context: morph.morph.context }
          : surface,
      );
      surface.canvas.hidden = !!morph;
      if (morph) settling = true;
      surface.node.dataset.liquidBackend = "webgl2";
      surface.node.dataset.glassBackend = "webgl2";
    }
    const atlas = packAtlas(
      entries.map((e) => e.rect),
      quality.scale * Math.min(devicePixelRatio || 1, 1.5) * this.scale,
      renderer.maxSize,
      quality.atlasPixels,
    );
    if (!atlas) {
      this.fallback("surface-budget");
      return;
    }
    try {
      renderer.render(
        atlas.width,
        atlas.height,
        atlas.tiles,
        entries,
        this.options.settings.liquid,
        quality.samples,
      );
      for (const tile of atlas.tiles) {
        const output = outputs[tile.index];
        if (output.canvas.width !== tile.width)
          output.canvas.width = tile.width;
        if (output.canvas.height !== tile.height)
          output.canvas.height = tile.height;
        output.context.clearRect(0, 0, tile.width, tile.height);
        output.context.drawImage(
          renderer.canvas,
          tile.x,
          tile.y,
          tile.width,
          tile.height,
          0,
          0,
          tile.width,
          tile.height,
        );
      }
    } catch {
      this.renderFailed = true;
      this.fallback("render-unavailable");
      return;
    }
    const elapsed = performance.now() - start;
    this.ema = this.ema ? this.ema * 0.9 + elapsed * 0.1 : elapsed;
    if (this.ema > (1000 / quality.fps) * 0.8) {
      this.slow++;
      this.fast = 0;
    } else {
      this.fast++;
      this.slow = 0;
    }
    if (
      (this.slow > 12 ||
        elapsed > 80 ||
        (this.draws < 3 && elapsed > (1000 / quality.fps) * 1.8)) &&
      this.scale > 0.4
    ) {
      this.scale = Math.max(0.4, this.scale * (this.draws < 3 ? 0.65 : 0.82));
      this.slow = 0;
      this.layoutDirty = true;
    }
    if (this.fast > 120 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.fast = 0;
    }
    this.draws++;
    this.lastDraw = time;
    this.dirty = false;
    this.layoutDirty = false;
    this.materialDirty = false;
    renderer.canvas.dataset.metrics = JSON.stringify({
      backend: "webgl2",
      surfaces: surfaces.length,
      contexts: 1,
      atlasWidth: atlas.width,
      atlasHeight: atlas.height,
      resolutionScale: atlas.scale,
      cpuSubmitComposeMs: elapsed,
      cpuEmaMs: this.ema,
      gpuMs: renderer.gpuMs,
      draws: this.draws,
      textureUploads: this.sourceUploads,
      videoPresentedFrames: this.background.presentedFrames,
      source: source
        ? source.node instanceof HTMLVideoElement
          ? "video"
          : "image"
        : this.cached.kind,
      sourceLive: !!source,
      quality: this.options.settings.liquid.quality,
      blurSamples: quality.samples,
    });
    this.publish(true, source ? "ready" : "environment-paused");
    if (settling) this.invalidate();
  };
  dispose() {
    this.alive = false;
    this.generation++;
    if (this.frame) this.clock.cancelFrame(this.frame);
    this.frame = 0;
    this.observer?.disconnect();
    this.resize?.disconnect();
    this.removeEvents();
    this.interaction.dispose();
    this.motion.dispose();
    this.background.dispose();
    for (const surface of [...this.surfaces.values()]) this.remove(surface);
    this.renderer?.dispose();
    this.renderer = null;
    this.canvas?.remove();
    this.canvas = null;
    this.cached = null;
    this.hasTexture = false;
    this.clock.dispose();
  }
}
