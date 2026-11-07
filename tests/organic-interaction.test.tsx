// @vitest-environment jsdom
import React, { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AnimatePresence } from "framer-motion";
import { DEFAULT_GLASS } from "../shared/glass";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
import { createGlassInteractions } from "../src/components/ui/glass-interaction";
import {
  GlassMaterialProvider,
  useGlassMaterial,
} from "../src/state/GlassMaterialProvider";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { GlassMenu } from "../src/components/ui/GlassMenu";
import { Modal } from "../src/components/ui/Modal";
import {
  GlassMaterialControls,
  materialFromGlobal,
} from "../src/components/dashboard/GlassControls";
let clock: number, nextFrame: number, frames: Map<number, FrameRequestCallback>;
const runFrames = () => {
  for (let n = 0; frames.size && n < 300; n++) {
    const batch = [...frames.values()];
    frames.clear();
    clock += 16;
    batch.forEach((callback) => callback(clock));
  }
};
const bounds = (left: number, width = 50) => ({
  left,
  top: 0,
  right: left + width,
  bottom: 100,
  x: left,
  y: 0,
  width,
  height: 100,
  toJSON() {},
});
beforeEach(() => {
  clock = nextFrame = 0;
  frames = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("CSS", { supports: () => true });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine"),
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function Provider({
  children,
  settings = DEFAULT_GLASS,
}: {
  children: React.ReactNode;
  settings?: typeof DEFAULT_GLASS;
}) {
  return (
    <GlassMaterialProvider
      settings={settings}
      wallpaper={DEFAULT_DASHBOARD.wallpaper}
      text="theme"
      category="pastel"
      reducedMotion={false}
    >
      {children}
    </GlassMaterialProvider>
  );
}
describe("one delegated, settling pointer / dock scheduler", () => {
  it("lights the pane without React state and magnifies neighbors continuously within the SAME hovered hit box", () => {
    document.documentElement.dataset.dockMagnify = "true";
    document.body.innerHTML =
      '<div data-glass-light="true" id="pane"></div><nav data-glass-dock="true"><button class="lunar-dock-button"></button><button class="lunar-dock-button"></button><button class="lunar-dock-button"></button></nav>';
    const pane = document.getElementById("pane")!,
      buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
    vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(bounds(0, 200));
    buttons.forEach((button, index) =>
      vi
        .spyOn(button, "getBoundingClientRect")
        .mockReturnValue(bounds(index * 52)),
    );
    const dispose = createGlassInteractions(document, 1);
    fireEvent(
      pane,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 160,
        clientY: 20,
      }),
    );
    runFrames();
    expect(
      Number.parseFloat(pane.style.getPropertyValue("--glass-pointer-x")),
    ).toBeCloseTo(80);
    expect(
      Number(pane.style.getPropertyValue("--glass-pointer-presence")),
    ).toBeGreaterThan(0.99);
    expect(frames.size).toBe(0);
    const move = (x: number) => {
      fireEvent(
        buttons[1],
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: 50,
        }),
      );
      runFrames();
    };
    move(60);
    const left = Number(buttons[0].style.getPropertyValue("--dock-proximity"));
    move(92);
    expect(
      Number(buttons[0].style.getPropertyValue("--dock-proximity")),
    ).toBeLessThan(left);
    expect(
      Number(buttons[2].style.getPropertyValue("--dock-proximity")),
    ).toBeGreaterThan(0);
    expect(frames.size).toBe(0);
    dispose();
    expect(
      buttons.every(
        (button) => !button.style.getPropertyValue("--dock-proximity"),
      ),
    ).toBe(true);
    expect(pane.style.getPropertyValue("--glass-pointer-presence")).toBe("");
    move(76);
    expect(frames.size).toBe(0);
  });
  it("has touch / leave fallbacks and cancels all pending work on unmount", () => {
    const pane = document.createElement("div");
    pane.dataset.glassLight = "true";
    document.body.append(pane);
    vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(bounds(0));
    const dispose = createGlassInteractions(document, 0.5);
    fireEvent(
      pane,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 20,
        clientY: 20,
      }),
    );
    expect(frames.size).toBe(1);
    runFrames();
    fireEvent(window, new Event("blur"));
    runFrames();
    expect(pane.style.getPropertyValue("--glass-pointer-presence")).toBe("");
    const touch = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 20,
      clientY: 20,
    });
    Object.defineProperty(touch, "pointerType", { value: "touch" });
    fireEvent(pane, touch);
    runFrames();
    expect(pane.style.getPropertyValue("--glass-pointer-presence")).toBe("");
    dispose();
    expect(frames.size).toBe(0);
  });
});
describe("actual surface backend, strict overrides and overlay lifecycle", () => {
  it("shares a single filter bank and binds actual SVG URLs only at optical quality", () => {
    const view = render(
      <Provider>
        <GlassSurface data-testid="pane" />
        <GlassSurface />
      </Provider>,
    );
    const surface = screen.getByTestId("pane");
    expect(
      view.container.querySelectorAll("svg.glass-optical-defs"),
    ).toHaveLength(1);
    expect(view.container.querySelectorAll("feDisplacementMap")).toHaveLength(
      10,
    );
    expect(surface.dataset.glassBackend).toBe("svg-backdrop");
    expect(surface.style.getPropertyValue("--glass-refraction-filter")).toMatch(
      /url\("#lunar-optic-/u,
    );
    view.rerender(
      <Provider settings={{ ...DEFAULT_GLASS, performance: "balanced" }}>
        <GlassSurface data-testid="pane" />
        <GlassSurface />
      </Provider>,
    );
    expect(surface.dataset.glassBackend).toBe("css-backdrop");
    expect(surface.style.getPropertyValue("--glass-refraction-filter")).toBe(
      "",
    );
  });
  it("renders the CSS fallback when SVG/WebGL are unavailable and disables the unsupported optical control", () => {
    vi.stubGlobal("CSS", {
      supports: (_key: string, value: string) => value === "blur(1px)",
    });
    vi.stubGlobal("WebGLRenderingContext", undefined);
    render(
      <Provider>
        <GlassSurface data-testid="pane" />
        <GlassMaterialControls
          value={materialFromGlobal(DEFAULT_GLASS)}
          optical
          onChange={() => {}}
        />
      </Provider>,
    );
    expect(screen.getByTestId("pane").dataset.glassBackend).toBe(
      "css-backdrop",
    );
    expect(
      screen
        .getByRole("slider", { name: "Refraction intensity" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(Object.keys(materialFromGlobal(DEFAULT_GLASS))).not.toContain(
      "animationSpeed",
    );
  });
  it.each(["reducedMotion", "simple"])(
    "turns off optics and shared pointer work for %s",
    (mode) => {
      const settings =
        mode === "simple"
          ? { ...DEFAULT_GLASS, performance: "simple" as const }
          : { ...DEFAULT_GLASS, reducedMotion: true };
      render(
        <Provider settings={settings}>
          <GlassSurface data-testid="pane" />
        </Provider>,
      );
      expect(screen.getByTestId("pane").dataset.glassBackend).not.toBe(
        "svg-backdrop",
      );
      expect(document.documentElement.dataset.glassPointer).toBe("false");
    },
  );
  it("keeps a mounted, exiting portal registered and inert until its actual unmount", async () => {
    // This test needs the real animation scheduler, not the pointer scheduler stub.
    vi.unstubAllGlobals();
    function Lifecycle() {
      const [open, setOpen] = useState(true),
        { overlayCount } = useGlassMaterial();
      return (
        <>
          <output data-testid="count">{overlayCount}</output>
          <AnimatePresence>
            {open && (
              <Modal
                key="dialog"
                title="Lifecycle"
                onClose={() => setOpen(false)}
              >
                Real panel
              </Modal>
            )}
          </AnimatePresence>
        </>
      );
    }
    render(
      <Provider>
        <Lifecycle />
      </Provider>,
    );
    expect(screen.getByTestId("count").textContent).toBe("1");
    act(() =>
      fireEvent.click(screen.getByRole("button", { name: "Close Lifecycle" })),
    );
    expect(
      document.querySelector(".modal-backdrop")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(
      (document.querySelector(".modal-backdrop") as HTMLElement).inert,
    ).toBe(true);
    expect(screen.getByTestId("count").textContent).toBe("1");
    await waitFor(
      () => expect(document.querySelector(".modal-backdrop")).toBeNull(),
      { timeout: 2000 },
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});

it("does not retain a detached panel or keep scheduling work after a stationary-pointer unmount", async () => {
  const pane = document.createElement("div");
  pane.dataset.glassLight = "true";
  document.body.append(pane);
  vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(bounds(0));
  const dispose = createGlassInteractions(document, 1);
  fireEvent(
    pane,
    new MouseEvent("pointermove", { bubbles: true, clientX: 20, clientY: 20 }),
  );
  runFrames();
  expect(pane.style.getPropertyValue("--glass-pointer-presence")).not.toBe("");
  pane.remove();
  await Promise.resolve();
  expect(pane.style.getPropertyValue("--glass-pointer-presence")).toBe("");
  expect(frames.size).toBe(0);
  dispose();
});

it("does not let an exiting menu clear the ref / keyboard target of a newly opened menu", async () => {
  vi.unstubAllGlobals();
  const ref = createRef<HTMLDivElement>();
  const scene = (id: string) => (
    <Provider>
      <AnimatePresence>
        <GlassMenu key={id} ref={ref} data-testid={id}>
          <button>{id}</button>
        </GlassMenu>
      </AnimatePresence>
    </Provider>
  );
  const view = render(scene("first"));
  view.rerender(scene("second"));
  expect(ref.current).toBe(screen.getByTestId("second"));
  await waitFor(() => expect(screen.queryByTestId("first")).toBeNull(), {
    timeout: 2000,
  });
  expect(ref.current).toBe(screen.getByTestId("second"));
  expect(ref.current?.inert).toBe(false);
});
