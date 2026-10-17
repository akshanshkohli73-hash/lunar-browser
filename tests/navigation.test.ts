import { describe, expect, it } from "vitest";
import {
  normalizeNavigation,
  isWebUrl,
  externalDestination,
} from "../shared/navigation";
import {
  clampBounds,
  nextActiveAfterClose,
  isPermutation,
} from "../electron/browser/geometry";
describe("navigation policy", () => {
  it.each([
    ["example.com", "https://example.com/"],
    [" localhost:8000/a ", "http://localhost:8000/a"],
    ["[::1]:8080/test", "http://[::1]:8080/test"],
    ["127.0.0.1:8080", "http://127.0.0.1:8080/"],
    ["hello lunar", "https://www.google.com/search?q=hello%20lunar"],
    ["about:blank", "lunar://newtab"],
    ["lunar://history", "lunar://history"],
    ["例え.jp", "https://xn--r8jz45g.jp/"],
  ])("normalizes %s", (input, url) =>
    expect(normalizeNavigation(input)).toBe(url),
  );
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "file:///etc/passwd",
    "lunar://unknown",
    "data:text/html,x",
    "chrome://settings",
    "https://user:password@example.com",
    "https://exa\nmple.com",
  ])("rejects %s", (input) =>
    expect(() => normalizeNavigation(input)).toThrow(),
  );
  it("respects search preference and external allowlist", () => {
    expect(normalizeNavigation("moon & stars", "duckduckgo")).toBe(
      "https://duckduckgo.com/?q=moon%20%26%20stars",
    );
    expect(isWebUrl("file:///etc/passwd")).toBe(false);
    expect(externalDestination("mailto:a@example.com")).toBe(
      "mailto:a@example.com",
    );
    expect(externalDestination("ms-settings:")).toBeNull();
    expect(externalDestination("tel:123\n456")).toBeNull();
  });
});
describe("native geometry and state transitions", () => {
  it("clamps in content DIPs without DPI multipliers", () => {
    expect(
      clampBounds(
        { x: -10, y: 70.4, width: 900, height: 800 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 0, y: 70, width: 800, height: 530 });
    expect(
      clampBounds(
        { x: 900, y: 0, width: 20, height: 20 },
        { width: 800, height: 600 },
      )?.width,
    ).toBe(0);
    expect(
      clampBounds(
        { x: 0, y: 0, width: NaN, height: 10 },
        { width: 800, height: 600 },
      ),
    ).toBeNull();
  });
  it("selects the adjacent tab and rejects lossy/duplicate reorder", () => {
    expect(nextActiveAfterClose(["a", "b", "c"], "b", "b")).toBe("c");
    expect(nextActiveAfterClose(["a", "b", "c"], "c", "c")).toBe("b");
    expect(nextActiveAfterClose(["a"], "a", "a")).toBeNull();
    expect(nextActiveAfterClose(["a", "b"], "a", "b")).toBe("a");
    expect(isPermutation(["a", "b"], ["b", "a"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
  });
});
