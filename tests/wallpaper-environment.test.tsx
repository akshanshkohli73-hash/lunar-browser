// @vitest-environment jsdom
// DOM lifecycle tests only. Actual codec, painted frame and native-window proof
// stays in scripts/native-smoke.mjs and the real WebGL browser checks.
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  WallpaperEnvironment,
  useWallpaperControls,
} from "../src/components/dashboard/WallpaperEnvironment";
import { Wallpaper } from "../src/components/dashboard/Wallpaper";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
const wallpaper = {
  ...DEFAULT_DASHBOARD.wallpaper,
  kind: "video" as const,
  mediaId: "12345678-1234-1234-1234-123456789012.webm",
  audioControls: true,
};
let play: ReturnType<typeof vi.spyOn>, pause: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
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
function Host({ active, name }: { active: boolean; name: string }) {
  const { controlsRef, shared } = useWallpaperControls(active);
  return (
    <section aria-label={name} hidden={!active} data-shared={String(shared)}>
      <div ref={controlsRef} />
    </section>
  );
}
function Scene({
  view,
  active = true,
}: {
  view: "dashboard" | "desktop" | "studio";
  active?: boolean;
}) {
  return (
    <WallpaperEnvironment
      value={wallpaper}
      active={active}
      reduced={false}
      resumeKey={view}
    >
      <Host name="Dashboard controls" active={view === "dashboard"} />
      <Host name="Desktop controls" active={view === "desktop"} />
      <Host name="Studio controls" active={view === "studio"} />
      {view === "studio" && (
        <div className="dashboard-preview">
          <Wallpaper value={wallpaper} active preview />
        </div>
      )}
    </WallpaperEnvironment>
  );
}
it("keeps exactly one identical video through desktop/dashboard/Studio, and moves only its working controls", () => {
  const rendered = render(<Scene view="dashboard" />),
    video = rendered.container.querySelector("video")!;
  expect(rendered.container.querySelectorAll("video")).toHaveLength(1);
  expect(
    screen
      .getByRole("region", { name: "Dashboard controls" })
      .querySelector("button"),
  ).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Unmute wallpaper" }));
  expect(video.muted).toBe(false);
  for (const view of ["desktop", "studio", "dashboard"] as const) {
    rendered.rerender(<Scene view={view} />);
    expect(rendered.container.querySelectorAll("video")).toHaveLength(1);
    expect(rendered.container.querySelector("video")).toBe(video);
    expect(video.muted).toBe(true);
    const name = `${view[0].toUpperCase() + view.slice(1)} controls`;
    expect(
      screen.getByRole("region", { name }).querySelector("button"),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector("[data-liquid-view]") !== null,
    ).toBe(view === "studio");
  }
});
it("pauses the same owner when covered/inactive, resumes muted, retains fit/position/loop and disposes playback", () => {
  const rendered = render(<Scene view="dashboard" />),
    video = rendered.container.querySelector("video")!;
  expect(play).toHaveBeenCalled();
  expect(video.style.objectFit).toBe(wallpaper.fit);
  expect(video.style.objectPosition).toBe(wallpaper.position);
  expect(video.loop).toBe(wallpaper.loop);
  fireEvent.click(screen.getByRole("button", { name: "Unmute wallpaper" }));
  const before = pause.mock.calls.length;
  rendered.rerender(<Scene view="dashboard" active={false} />);
  expect(pause.mock.calls.length).toBeGreaterThan(before);
  expect(video.muted).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Unmute wallpaper" })
      .hasAttribute("disabled"),
  ).toBe(true);
  rendered.rerender(<Scene view="desktop" active />);
  expect(rendered.container.querySelector("video")).toBe(video);
  expect(video.muted).toBe(true);
  const beforeClose = pause.mock.calls.length;
  rendered.unmount();
  expect(pause.mock.calls.length).toBeGreaterThan(beforeClose);
});
