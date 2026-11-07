// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Wallpaper } from "../src/components/dashboard/Wallpaper";
import {
  GlassMaterialProvider,
  useGlassMaterial,
} from "../src/state/GlassMaterialProvider";
import { DEFAULT_GLASS } from "../shared/glass";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
const value = {
  ...DEFAULT_DASHBOARD.wallpaper,
  kind: "video" as const,
  mediaId: "12345678-1234-1234-1234-123456789012.webm",
  audioControls: true,
};
let play: ReturnType<typeof vi.spyOn>,
  pause: ReturnType<typeof vi.spyOn>,
  changed: (() => void) | undefined,
  osReduced: boolean;
beforeEach(() => {
  osReduced = false;
  changed = undefined;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return osReduced;
    },
    addEventListener: (_type: string, listener: () => void) => {
      changed = listener;
    },
    removeEventListener: () => {
      changed = undefined;
    },
  }));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("wallpaper playback lifecycle (DOM media methods, not a codec test)", () => {
  it("starts muted, requires a manual unmute and remutes/pauses on hidden or inactive transitions", () => {
    const view = render(<Wallpaper value={value} active />),
      video = view.container.querySelector("video")!;
    expect(play).toHaveBeenCalled();
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(value.loop);
    fireEvent.click(screen.getByRole("button", { name: "Unmute wallpaper" }));
    expect(video.muted).toBe(false);
    view.rerender(
      <Wallpaper value={{ ...value, audioControls: false }} active />,
    );
    expect(video.muted).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Unmute wallpaper" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Unmute wallpaper" })
        .getAttribute("title"),
    ).toContain("Appearance");
    view.rerender(<Wallpaper value={value} active />);
    fireEvent.click(screen.getByRole("button", { name: "Unmute wallpaper" }));
    expect(video.muted).toBe(false);
    view.rerender(<Wallpaper value={value} active={false} />);
    expect(pause).toHaveBeenCalled();
    expect(video.muted).toBe(true);
    expect(video.preload).toBe("none");
    const count = play.mock.calls.length;
    view.rerender(<Wallpaper value={value} active />);
    expect(play.mock.calls.length).toBeGreaterThan(count);
    expect(video.muted).toBe(true);
    fireEvent(window, new Event("blur"));
    expect(
      screen
        .getByRole("button", { name: "Unmute wallpaper" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent(window, new Event("focus"));
    expect(video.muted).toBe(true);
    act(() => {
      vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(
      screen
        .getByRole("button", { name: "Unmute wallpaper" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("pauses for app/OS reduced motion, reacts to live OS changes and still offers an explicit Play", () => {
    const view = render(<Wallpaper value={value} active reduceMotion />);
    expect(play).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Play wallpaper" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Play wallpaper" }));
    expect(play).toHaveBeenCalled();
    view.rerender(<Wallpaper value={value} active />);
    act(() => {
      osReduced = true;
      changed?.();
    });
    expect(
      screen.getByRole("button", { name: "Play wallpaper" }),
    ).toBeDefined();
    expect(view.container.querySelector(".has-drift")).toBeNull();
  });
  it("handles a non-looping video ending and does not show sound controls in the editor preview", () => {
    const view = render(
        <Wallpaper value={{ ...value, loop: false }} active preview />,
      ),
      video = view.container.querySelector("video")!;
    expect(video.loop).toBe(false);
    expect(
      screen.queryByRole("button", { name: "Unmute wallpaper" }),
    ).toBeNull();
    fireEvent.ended(video);
    expect(
      screen.getByRole("button", { name: "Play wallpaper" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Play wallpaper" }));
    expect(play.mock.calls.length).toBeGreaterThan(1);
  });
  it("reports real media errors but ignores a stale play rejection after the dashboard becomes inactive", async () => {
    let reject: (failure: Error) => void = () => {
      throw new Error("Missing playback promise");
    };
    play.mockImplementation(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const view = render(<Wallpaper value={value} active />);
    view.rerender(<Wallpaper value={value} active={false} />);
    await act(async () => reject(new Error("Playback interrupted by pause")));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.error(view.container.querySelector("video")!);
    expect(screen.getByRole("status").textContent).toContain(
      "could not load or play",
    );
    view.rerender(<Wallpaper value={DEFAULT_DASHBOARD.wallpaper} active />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(view.container.querySelector("img")?.getAttribute("src")).toMatch(
      /^data:image\/svg\+xml,/,
    );
    expect(view.container.querySelector("video")).toBeNull();
  });
});

it("offers a genuine Play retry after NotAllowedError instead of claiming playback is still running", async () => {
  play.mockRejectedValueOnce(
    new DOMException("User gesture required", "NotAllowedError"),
  );
  render(<Wallpaper value={value} active />);
  await act(async () => {});
  expect(screen.getByRole("status").textContent).toContain("autoplay policy");
  const count = play.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Play wallpaper" }));
  expect(play.mock.calls.length).toBeGreaterThan(count); // Called synchronously inside the user gesture.
});
it("surfaces a decoder error and reloads the same local source on an explicit Play retry", () => {
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const view = render(<Wallpaper value={value} active />),
    video = view.container.querySelector("video")!;
  Object.defineProperty(video, "error", {
    configurable: true,
    value: { code: 4, message: "DEMUXER_ERROR" },
  });
  fireEvent.error(video);
  expect(screen.getByRole("status").textContent).toContain("H.264 MP4");
  fireEvent.click(screen.getByRole("button", { name: "Play wallpaper" }));
  expect(load).toHaveBeenCalledOnce();
  expect(video.muted).toBe(true);
});

describe("bounded wallpaper environment / transition resources", () => {
  it("samples a loaded video source only once, with no frame callbacks or video copies", () => {
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray([32, 64, 32, 255]),
    }));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({ drawImage, getImageData }) as unknown as CanvasRenderingContext2D,
    );
    const wallpaper = {
      ...value,
      mediaId: "12345678-1234-1234-1234-123456789111.webm",
    };
    function Probe() {
      const { appearance } = useGlassMaterial();
      return (
        <output data-testid="appearance">
          {appearance.source}:{appearance.color}
        </output>
      );
    }
    const view = render(
      <GlassMaterialProvider
        settings={DEFAULT_GLASS}
        wallpaper={wallpaper}
        text="theme"
        category="pastel"
        reducedMotion={false}
      >
        <Wallpaper value={wallpaper} active />
        <Probe />
      </GlassMaterialProvider>,
    );
    const video = view.container.querySelector("video")!;
    for (let n = 0; n < 10; n++) fireEvent.loadedData(video);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("appearance").textContent).toBe("pixels:#204020");
    expect(view.container.querySelectorAll("video")).toHaveLength(1);
  });
  it("catches a tainted private-media canvas and keeps the legible theme fallback instead of relaxing CORS", () => {
    const getImageData = vi.fn(() => {
      throw new DOMException("Private origin", "SecurityError");
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage() {},
          getImageData,
        }) as unknown as CanvasRenderingContext2D,
    );
    const wallpaper = {
      ...value,
      kind: "image" as const,
      mediaId: "12345678-1234-1234-1234-123456789112.png",
    };
    function Probe() {
      return (
        <output data-testid="appearance">
          {useGlassMaterial().appearance.source}
        </output>
      );
    }
    const view = render(
      <GlassMaterialProvider
        settings={DEFAULT_GLASS}
        wallpaper={wallpaper}
        text="theme"
        category="pastel"
        reducedMotion={false}
      >
        <Wallpaper value={wallpaper} active />
        <Probe />
      </GlassMaterialProvider>,
    );
    fireEvent.load(view.container.querySelector("img")!);
    fireEvent.load(view.container.querySelector("img")!);
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("appearance").textContent).toBe("theme");
  });
  it("crossfades images for a bounded interval, but never retains a departing video or a reduced-motion layer", () => {
    vi.useFakeTimers();
    try {
      const wallpaper = { ...DEFAULT_DASHBOARD.wallpaper, effects: true };
      const view = render(<Wallpaper value={wallpaper} active />);
      view.rerender(
        <Wallpaper value={{ ...wallpaper, builtin: "rose" }} active />,
      );
      expect(
        view.container.querySelectorAll(".dashboard-wallpaper img"),
      ).toHaveLength(2);
      act(() => vi.advanceTimersByTime(220));
      expect(
        view.container.querySelectorAll(".dashboard-wallpaper img"),
      ).toHaveLength(1);
      view.rerender(<Wallpaper value={{ ...value, effects: true }} active />);
      expect(view.container.querySelectorAll("video")).toHaveLength(1);
      expect(view.container.querySelector(".wallpaper-outgoing")).toBeNull();
      view.rerender(
        <Wallpaper
          value={{ ...wallpaper, builtin: "midnight" }}
          active
          reduceMotion
        />,
      );
      expect(view.container.querySelectorAll("video")).toHaveLength(0);
      expect(view.container.querySelector(".wallpaper-outgoing")).toBeNull();
      expect(pause).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
