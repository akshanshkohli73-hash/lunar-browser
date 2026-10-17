import { describe, expect, it, vi } from "vitest";
import { loadShellWindow } from "../electron/main/shell-loader";

function target(loadURL: (url: string) => Promise<void>) {
  return {
    loadURL: vi.fn(loadURL),
    webContents: {
      setZoomFactor: vi.fn<(factor: number) => void>(),
      setVisualZoomLevelLimits: vi
        .fn<(min: number, max: number) => Promise<void>>()
        .mockResolvedValue(undefined),
    },
  };
}

describe("shell renderer startup ordering", () => {
  it("loads the actual renderer before waiting for renderer-side visual zoom IPC", async () => {
    const loaded = Promise.withResolvers<void>();
    const window = target(() => loaded.promise);
    const startup = loadShellWindow(window, "file:///app/index.html");
    expect(window.webContents.setZoomFactor).toHaveBeenCalledWith(1);
    expect(window.loadURL).toHaveBeenCalledWith("file:///app/index.html");
    expect(window.webContents.setVisualZoomLevelLimits).not.toHaveBeenCalled();
    loaded.resolve();
    await startup;
    expect(
      window.webContents.setVisualZoomLevelLimits,
    ).toHaveBeenCalledExactlyOnceWith(1, 1);
  });

  it("propagates failed page loads without waiting on an unavailable renderer", async () => {
    const failure = new Error("The application entry could not be loaded");
    const window = target(() => Promise.reject(failure));
    await expect(
      loadShellWindow(window, "file:///app/index.html"),
    ).rejects.toBe(failure);
    expect(window.webContents.setVisualZoomLevelLimits).not.toHaveBeenCalled();
  });

  it("does not report successful startup if the loaded renderer rejects zoom setup", async () => {
    const window = target(() => Promise.resolve());
    const failure = new Error("Renderer zoom setup failed");
    window.webContents.setVisualZoomLevelLimits.mockRejectedValue(failure);
    await expect(
      loadShellWindow(window, "file:///app/index.html"),
    ).rejects.toBe(failure);
  });
});
