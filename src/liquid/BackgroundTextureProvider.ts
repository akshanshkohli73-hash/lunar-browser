import type { Rect } from "../../shared/liquid";
export type BackgroundNode = HTMLImageElement | HTMLVideoElement;
export type BackgroundOptions = {
  identity: string;
  active: boolean;
  priority: number;
  fit: string;
  position: string;
  blur: number;
  shade: number;
};
export type Background = {
  node: BackgroundNode;
  options: BackgroundOptions;
  box: Rect;
  width: number;
  height: number;
};
/** Owns listeners/frame notifications, never playback, video elements or filesystem APIs. */
export class BackgroundTextureProvider {
  private sources = new Map<
    BackgroundNode,
    { options: BackgroundOptions; cleanup: () => void }
  >();
  private frame = 0;
  private watched: HTMLVideoElement | null = null;
  private running = false;
  dirty = true;
  current: Background | null = null;
  presentedFrames = 0;
  private revisions = new WeakMap<BackgroundNode, number>();
  private revision = 0;
  stamp(node: BackgroundNode) {
    return `${node.currentSrc || node.src}|${this.revisions.get(node) ?? 0}|${node instanceof HTMLVideoElement ? node.currentTime : "image"}`;
  }
  constructor(private invalidate: () => void) {}
  register(node: BackgroundNode, options: BackgroundOptions) {
    if (!this.revisions.has(node)) this.revisions.set(node, ++this.revision);
    const changed = (event: Event) => {
      if (["load", "loadeddata", "seeked", "resize"].includes(event.type))
        this.revisions.set(node, ++this.revision);
      this.dirty = true;
      this.invalidate();
      this.watch();
    };
    for (const name of [
      "load",
      "loadeddata",
      "seeked",
      "play",
      "pause",
      "resize",
      "error",
    ])
      node.addEventListener(name, changed);
    this.sources.set(node, {
      options,
      cleanup: () => {
        for (const name of [
          "load",
          "loadeddata",
          "seeked",
          "play",
          "pause",
          "resize",
          "error",
        ])
          node.removeEventListener(name, changed);
      },
    });
    this.dirty = true;
    this.invalidate();
    return () => {
      this.sources.get(node)?.cleanup();
      this.sources.delete(node);
      if (this.current?.node === node) {
        this.current = null;
        this.stopVideo();
      }
      this.invalidate();
    };
  }
  select(): Background | null {
    const candidates = [...this.sources]
      .filter(([node]) => node.isConnected)
      .sort(
        (a, b) =>
          Number(b[1].options.active) * 100 +
          b[1].options.priority -
          (Number(a[1].options.active) * 100 + a[1].options.priority),
      );
    for (const [node, { options }] of candidates) {
      const width =
        node instanceof HTMLVideoElement ? node.videoWidth : node.naturalWidth;
      const height =
        node instanceof HTMLVideoElement
          ? node.videoHeight
          : node.naturalHeight;
      const box = node.getBoundingClientRect();
      if (!width || !height || !box.width || !box.height) continue;
      if (
        this.current?.node !== node ||
        this.current.options.identity !== options.identity
      ) {
        this.dirty = true;
        this.stopVideo();
      }
      this.current = {
        node,
        options,
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        width,
        height,
      };
      this.watch();
      return this.current;
    }
    this.stopVideo();
    return null;
  }
  setRunning(value: boolean) {
    this.running = value;
    if (!value) this.stopVideo();
    else this.watch();
  }
  private stopVideo() {
    if (this.watched && this.frame)
      this.watched.cancelVideoFrameCallback?.(this.frame);
    this.frame = 0;
    this.watched = null;
  }
  private watch() {
    const source = this.current;
    const video = source?.node instanceof HTMLVideoElement ? source.node : null;
    if (
      !this.running ||
      !source?.options.active ||
      !video ||
      video.paused ||
      video.ended
    ) {
      this.stopVideo();
      return;
    }
    if (this.watched !== video) this.stopVideo();
    if (this.frame || !video.requestVideoFrameCallback) return;
    this.watched = video;
    this.frame = video.requestVideoFrameCallback((_now, metadata) => {
      this.frame = 0;
      this.presentedFrames = metadata.presentedFrames;
      this.dirty = true;
      this.invalidate();
      this.watch();
    });
  }
  dispose() {
    this.stopVideo();
    for (const source of this.sources.values()) source.cleanup();
    this.sources.clear();
    this.current = null;
  }
}
