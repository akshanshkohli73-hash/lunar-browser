// @vitest-environment jsdom
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES, applyThemeTokens } from "../src/styles/themes";
import { themeSchema } from "../shared/schemas";
import { StorageService } from "../electron/services/storage";
describe("theme consistency and persistence", () => {
  it("validates every built-in palette and maps the same tokens to browser and original desktop", () => {
    for (const theme of Object.values(BUILTIN_THEMES))
      expect(themeSchema.safeParse(theme).success).toBe(true);
    const theme = BUILTIN_THEMES["pastel-forest"];
    applyThemeTokens(theme);
    const css = document.documentElement.style;
    expect(css.getPropertyValue("--lunar-bg")).toBe(theme.colors.bg);
    expect(css.getPropertyValue("--color-background")).toBe(theme.colors.bg);
    expect(css.getPropertyValue("--color-border")).toBe(theme.colors.border);
    expect(css.getPropertyValue("--lunar-tab-radius")).toBe("9px");
  });
  it("persists complete custom tokens, not just a preset id, across restarts", () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-theme-"));
    try {
      const custom = {
        ...structuredClone(BUILTIN_THEMES["lunar-coquette"]),
        id: "custom-coquette",
        colors: {
          ...BUILTIN_THEMES["lunar-coquette"].colors,
          primary: "#446644",
        },
      };
      new StorageService(profile).updateSettings({
        themeId: custom.id,
        customTheme: custom,
        reducedMotion: true,
      });
      expect(new StorageService(profile).getSettings().customTheme).toEqual(
        custom,
      );
      expect(new StorageService(profile).getSettings().reducedMotion).toBe(
        true,
      );
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
  it("rejects CSS injection and nonfinite or out-of-range imported tokens", () => {
    const theme = structuredClone(BUILTIN_THEMES["lunar-coquette"]);
    expect(
      themeSchema.safeParse({
        ...theme,
        colors: { ...theme.colors, bg: "url(https://evil.test)" },
      }).success,
    ).toBe(false);
    expect(
      themeSchema.safeParse({
        ...theme,
        typography: {
          ...theme.typography,
          fontFamily: "x; background: url(x)",
        },
      }).success,
    ).toBe(false);
    expect(
      themeSchema.safeParse({
        ...theme,
        appearance: { ...theme.appearance, blur: 10000 },
      }).success,
    ).toBe(false);
  });
});
