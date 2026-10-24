import { describe, expect, it, vi } from "vitest";
import { executeBrowserCommand } from "../electron/browser/commands";
import { requestSchemas } from "../shared/api";
const editing = () => ({
  undo: vi.fn(),
  redo: vi.fn(),
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  selectAll: vi.fn(),
});
function target(url = "https://example.org/") {
  const page = editing(),
    chrome = editing();
  const ctx = {
    window: {
      webContents: chrome,
      isFullScreen: () => false,
      setFullScreen: vi.fn(),
    },
    tabs: {
      getActiveTab: () => ({ info: { url }, view: { webContents: page } }),
      zoomActive: vi.fn(),
    },
  };
  return { ctx, page, chrome };
}
describe("fixed browser command dispatch behind authorized main-process IPC", () => {
  it.each(["undo", "redo", "cut", "copy", "paste", "selectAll"] as const)(
    "dispatches %s to the chosen editing context without returning clipboard data",
    (command) => {
      const { ctx, page, chrome } = target();
      expect(executeBrowserCommand(ctx, command, "page")).toBeUndefined();
      expect(page[command]).toHaveBeenCalledOnce();
      expect(chrome[command]).not.toHaveBeenCalled();
      executeBrowserCommand(ctx, command, "chrome");
      expect(chrome[command]).toHaveBeenCalledOnce();
    },
  );
  it("uses website-only zoom and the owning window's fullscreen operation", () => {
    const { ctx } = target();
    for (const command of ["zoomIn", "zoomOut", "zoomReset"] as const) {
      executeBrowserCommand(ctx, command, "page");
      expect(ctx.tabs.zoomActive).toHaveBeenLastCalledWith(command);
    }
    executeBrowserCommand(ctx, "fullscreen", "chrome");
    expect(ctx.window.setFullScreen).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("rejects editing an internal destination as a webpage", () => {
    const { ctx, page } = target("lunar://settings");
    expect(() => executeBrowserCommand(ctx, "paste", "page")).toThrow(
      "website tab",
    );
    expect(page.paste).not.toHaveBeenCalled();
  });
  it("rejects arbitrary commands, targets, paths and info arguments at the boundary", () => {
    expect(
      requestSchemas["browser:command"].safeParse(["executeJavaScript", "page"])
        .success,
    ).toBe(false);
    expect(
      requestSchemas["browser:command"].safeParse(["paste", "unowned-tab-id"])
        .success,
    ).toBe(false);
    expect(
      requestSchemas["browser:info"].safeParse(["/private/file"]).success,
    ).toBe(false);
    expect(
      requestSchemas["shield:get"].safeParse(["file:///private/file"]).success,
    ).toBe(false);
  });
});
