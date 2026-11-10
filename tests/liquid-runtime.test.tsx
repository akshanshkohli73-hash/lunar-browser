import { readMaterial } from "../src/liquid/LiquidMaterial";
import { LiquidMotionController } from "../src/liquid/LiquidMotionController";
// @vitest-environment jsdom
// Lifecycle/control tests only. Painted shader/image/video proof is in actual Chromium/Electron scripts.
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  LiquidInteractionController,
  freshPhysics,
} from "../src/liquid/LiquidInteractionController";
import { BackgroundTextureProvider } from "../src/liquid/BackgroundTextureProvider";
import { FrameClock } from "../src/liquid/FrameClock";
import { Wallpaper } from "../src/components/dashboard/Wallpaper";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
it("keeps deformation bounded, uses a pixel proximity radius and fully settles outside it", () => {
  const controller = new LiquidInteractionController(() => {}),
    state = freshPhysics(),
    rect = { x: 250, y: 100, width: 780, height: 600 };
  controller.move(
    new MouseEvent("pointermove", {
      clientX: 800,
      clientY: 400,
    }) as PointerEvent,
  );
  controller.down = true;
  for (let i = 0; i < 120; i++)
    controller.advance(state, rect, 1 / 60, 1, true);
  expect(state.press.value).toBe(1);
  expect(Math.abs(state.x.value)).toBeLessThanOrEqual(1);
  controller.down = false;
  controller.move(
    new MouseEvent("pointermove", { clientX: 1, clientY: 1 }) as PointerEvent,
  );
  for (let i = 0; i < 120; i++)
    controller.advance(state, rect, 1 / 60, 1, true);
  expect(state).toEqual(freshPhysics());
});
it("does not invoke native window scheduling methods with a FrameClock receiver", () => {
  const request = vi.fn(function (this: unknown) {
    expect(this).not.toBe(clock);
    return 10;
  });
  const cancel = vi.fn(function (this: unknown) {
    expect(this).not.toBe(clock);
  });
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const clock = new FrameClock();
  const id = clock.requestFrame(() => {});
  clock.cancelFrame(id);
  expect(request).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("uses one available-video-frame notification, never owns playback, and cancels on pause/disposal", () => {
  const video = document.createElement("video");
  document.body.append(video);
  let paused = false;
  Object.defineProperties(video, {
    videoWidth: { value: 160 },
    videoHeight: { value: 90 },
    paused: { get: () => paused },
  });
  vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  } as DOMRect);
  let sequence = 0;
  const pending = new Map<number, VideoFrameRequestCallback>();
  video.requestVideoFrameCallback = (callback) => {
    pending.set(++sequence, callback);
    return sequence;
  };
  video.cancelVideoFrameCallback = (id) => {
    pending.delete(id);
  };
  const invalidate = vi.fn(),
    provider = new BackgroundTextureProvider(invalidate);
  const options = {
    identity: "same-video",
    active: true,
    priority: 10,
    fit: "cover",
    position: "center",
    blur: 0,
    shade: 0,
  };
  const unregister = provider.register(video, options);
  provider.select();
  provider.setRunning(true);
  expect(pending.size).toBe(1);
  const frame = pending.get(1)!;
  pending.delete(1);
  frame(16, {
    presentedFrames: 1,
    width: 160,
    height: 90,
    mediaTime: 0.1,
    presentationTime: 16,
    expectedDisplayTime: 16,
    processingDuration: 0,
  });
  expect(provider.presentedFrames).toBe(1);
  expect(pending.size).toBe(1);
  paused = true;
  video.dispatchEvent(new Event("pause"));
  expect(pending.size).toBe(0);
  const stamp = provider.stamp(video);
  unregister();
  provider.register(video, { ...options, fit: "contain" });
  expect(provider.stamp(video)).toBe(stamp);
  provider.dispose();
  expect(pending.size).toBe(0);
  expect(video.isConnected).toBe(true);
});
it("shares the existing desktop video with Studio and transfers ownership only after the desktop unmounts", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const value = {
    ...DEFAULT_DASHBOARD.wallpaper,
    kind: "video" as const,
    mediaId: "12345678-1234-1234-1234-123456789012.webm",
  };
  const scene = (desktop: boolean) => (
    <>
      {desktop && (
        <section key="main" className="new-tab-dashboard">
          <Wallpaper value={value} active />
        </section>
      )}
      <div key="preview">
        <Wallpaper value={value} active preview />
      </div>
    </>
  );
  const view = render(scene(true));
  expect(view.container.querySelectorAll("video")).toHaveLength(1);
  expect(view.container.querySelector("[data-liquid-view]")).not.toBeNull();
  const original = view.container.querySelector("video");
  view.rerender(scene(false));
  await waitFor(() =>
    expect(view.container.querySelectorAll("video")).toHaveLength(1),
  );
  await waitFor(() =>
    expect(view.container.querySelector("[data-liquid-view]")).toBeNull(),
  );
  expect(view.container.querySelector("video")).not.toBe(original);
  expect(original?.isConnected).toBe(false);
});

it("retains manual background tint contribution even while adaptive environment tint is active", () => {
  const node = document.createElement("div");
  document.body.append(node);
  node.style.setProperty("--glass-tint", "#bbd4b1");
  node.style.setProperty("--glass-adaptive-tint", "#203a2a");
  const first = readMaterial(node, { x: 0, y: 0, width: 300, height: 200 });
  node.style.setProperty("--glass-tint", "#e1bdc4");
  const next = readMaterial(node, { x: 0, y: 0, width: 300, height: 200 });
  expect(next.tint).not.toEqual(first.tint);
  expect(next.tint[0]).toBeCloseTo((225 / 255) * 0.65 + (32 / 255) * 0.35);
});

it("settles lost-GPU morphs immediately and does not replay already-open menus on restoration", () => {
  // Unit lifecycle/resource test only; the browser matrix verifies actual pixels.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  const makeOwner = (id: string) => {
    const owner = document.createElement("div"),
      backing = document.createElement("div"),
      trigger = document.createElement("button");
    owner.dataset.liquidMorph = id;
    trigger.dataset.liquidTrigger = id;
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    } as DOMRect);
    owner.append(backing);
    document.body.append(owner, trigger);
    return { owner, backing };
  };
  const first = makeOwner("menu-first"),
    openedInCss = makeOwner("menu-css"),
    box = { x: 10, y: 50, width: 280, height: 240 };
  const motion = new LiquidMotionController(() => {});
  motion.maybeStart(first.backing, box, 1);
  motion.frame(
    first.backing,
    box,
    readMaterial(first.backing, box),
    performance.now() + 50,
  );
  expect(document.querySelectorAll("canvas[data-liquid-proxy]")).toHaveLength(
    1,
  );
  expect(first.owner.dataset.liquidMorphing).toBe("true");
  motion.suspend([first.owner, openedInCss.owner]);
  expect(document.querySelectorAll("canvas[data-liquid-proxy]")).toHaveLength(
    0,
  );
  expect(first.owner.dataset.liquidMorphing).toBeUndefined();
  expect(first.owner.style.getPropertyValue("--liquid-content-opacity")).toBe(
    "",
  );
  for (const surface of [first, openedInCss])
    motion.maybeStart(surface.backing, box, 1);
  expect(document.querySelectorAll("canvas[data-liquid-proxy]")).toHaveLength(
    0,
  );
  const fresh = makeOwner("menu-fresh");
  motion.maybeStart(fresh.backing, box, 1);
  expect(document.querySelectorAll("canvas[data-liquid-proxy]")).toHaveLength(
    1,
  );
  motion.dispose();
  expect(document.querySelectorAll("canvas[data-liquid-proxy]")).toHaveLength(
    0,
  );
});

it("prioritizes recoverable driver/context loss over a racing submission failure", async () => {
  const { LiquidEngine } = await import("../src/liquid/LiquidEngine");
  const { DEFAULT_GLASS } = await import("../shared/glass");
  const engine = new LiquidEngine();
  // White-box state-transition probe, not a shader mock presented as pixel proof.
  // Real loss/restoration, pixels and retained native geometry are checked in GUI.
  const renderer = {
    gl: { isContextLost: vi.fn(() => true) },
    dispose: vi.fn(),
  };
  Object.assign(engine, { renderer, renderFailed: true });
  const options = {
    settings: DEFAULT_GLASS,
    identity: "",
    reduced: false,
    foreground: true,
    transparency: false,
    forcedColors: false,
    finePointer: true,
  };
  try {
    engine.update(options);
    expect(document.documentElement.dataset.liquidReason).toBe("context-lost");
    renderer.gl.isContextLost.mockReturnValue(false);
    engine.update(options);
    expect(document.documentElement.dataset.liquidReason).toBe(
      "render-unavailable",
    );
    Object.assign(engine, { lost: true });
    engine.update(options);
    expect(document.documentElement.dataset.liquidReason).toBe("context-lost");
  } finally {
    engine.dispose();
  }
  expect(renderer.dispose).toHaveBeenCalledOnce();
});
