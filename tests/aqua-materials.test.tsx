// @vitest-environment jsdom
import React, { useState } from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AQUA_COLORS, AQUA_WATER_LENS, aquaGreeting } from "../shared/aqua";
import {
  AQUA_MATERIAL_PRESETS,
  AQUA_MOTION_PRESETS,
  applyMaterialPreset,
  applyMotionPreset,
  matchingMaterialPreset,
  matchingMotionPreset,
  type AquaMaterialPreset,
  type AquaMotionPreset,
} from "../shared/material-presets";
import { DEFAULT_GLASS, glassSchema } from "../shared/glass";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { DEFAULT_DASHBOARD, dashboardPatchSchema } from "../shared/dashboard";
import { StorageService } from "../electron/services/storage";
import { BUILTIN_THEMES, applyThemeTokens } from "../src/styles/themes";
import { MaterialPresets } from "../src/components/dashboard/MaterialPresets";
import { readMaterial } from "../src/liquid/LiquidMaterial";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
});

describe("Aqua Coquette design tokens and real material presets", () => {
  it("uses the requested palette, clearer Water Lens defaults, and keeps all original palettes", () => {
    expect(AQUA_COLORS).toEqual({
      mint: "#bdeae2",
      pearl: "#e6f7f3",
      aqua: "#b9dceb",
      lilac: "#d9c9e9",
      teal: "#253f43",
    });
    expect(DEFAULT_SETTINGS.themeId).toBe("aqua-coquette");
    expect(DEFAULT_GLASS).toMatchObject(AQUA_WATER_LENS);
    expect(DEFAULT_GLASS.blur).toBe(4);
    expect(matchingMaterialPreset(DEFAULT_GLASS)).toBe("water-lens");
    for (const id of [
      "lunar-coquette",
      "rose-coquette",
      "pastel-forest",
      "moonlight",
      "lunar-dark",
    ])
      expect(BUILTIN_THEMES[id]).toBeDefined();
  });
  it.each(Object.keys(AQUA_MATERIAL_PRESETS) as AquaMaterialPreset[])(
    "applies %s atomically without resetting quality, motion, enable/accessibility policy or input",
    (id) => {
      const input = {
        ...structuredClone(DEFAULT_GLASS),
        enabled: false,
        reducedMotion: true,
        performance: "balanced" as const,
        adaptive: false,
        animationSpeed: 1.4,
        liquid: {
          ...DEFAULT_GLASS.liquid,
          quality: "performance" as const,
          elasticity: 0.8,
          responsiveness: 1.6,
        },
      };
      const before = structuredClone(input),
        next = applyMaterialPreset(input, id);
      expect(glassSchema.parse(next)).toEqual(next);
      expect(next).toMatchObject(AQUA_MATERIAL_PRESETS[id].material);
      expect(next.liquid).toMatchObject({
        ...input.liquid,
        ...AQUA_MATERIAL_PRESETS[id].optics,
      });
      for (const key of [
        "enabled",
        "reducedMotion",
        "performance",
        "adaptive",
        "animationSpeed",
      ] as const)
        expect(next[key]).toEqual(input[key]);
      expect(matchingMaterialPreset(next)).toBe(id);
      expect(
        matchingMaterialPreset({ ...next, reflection: next.reflection / 2 }),
      ).toBe("custom");
      expect(input).toEqual(before);
    },
  );
  it.each(Object.keys(AQUA_MOTION_PRESETS) as AquaMotionPreset[])(
    "applies %s motion without changing optics/quality or bypassing reduced motion",
    (id) => {
      const input = { ...DEFAULT_GLASS, reducedMotion: true };
      const next = applyMotionPreset(input, id);
      expect(matchingMotionPreset(next)).toBe(id);
      expect(next.refraction).toBe(input.refraction);
      expect(next.liquid.quality).toBe(input.liquid.quality);
      expect(next.liquid.curvature).toBe(input.liquid.curvature);
      expect(next.reducedMotion).toBe(true);
      expect(matchingMotionPreset({ ...next, animationSpeed: 1.65 })).toBe(
        "custom",
      );
    },
  );
  it("persists actual preset values and existing theme intensity, preserving old profiles, sparse overrides, notes and events", () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-aqua-"));
    try {
      const store = new StorageService(profile);
      store.updateSettings({ themeId: "lunar-coquette" });
      const current = structuredClone(DEFAULT_DASHBOARD);
      current.glass.blur = 19;
      current.widgets[0].glass = { opacity: 0.91, blur: 21 };
      current.note = "Keep this independent note.";
      current.events = [
        { id: "lunar_event", date: "2026-10-15", title: "Keep this event" },
      ];
      store.updateDashboard(current);
      const reopened = new StorageService(profile);
      expect(reopened.getSettings().themeId).toBe("lunar-coquette");
      expect(reopened.getDashboard()).toEqual(current);
      reopened.updateDashboard({
        glass: applyMaterialPreset(current.glass, "crystal"),
      });
      const theme = structuredClone(BUILTIN_THEMES["aqua-coquette"]);
      theme.appearance.glassIntensity = 0.37;
      reopened.updateSettings({ themeId: theme.id, customTheme: theme });
      const saved = new StorageService(profile);
      expect(matchingMaterialPreset(saved.getDashboard().glass)).toBe(
        "crystal",
      );
      expect(saved.getDashboard().widgets).toEqual(current.widgets);
      expect(saved.getDashboard().note).toBe(current.note);
      expect(saved.getDashboard().events).toEqual(current.events);
      expect(saved.getDashboard().wallpaper).toEqual(current.wallpaper);
      expect(saved.getSettings().customTheme?.appearance.glassIntensity).toBe(
        0.37,
      );
      expect(dashboardPatchSchema.parse({ note: "Only a note" })).toEqual({
        note: "Only a note",
      });
      expect(saved.warnings).toEqual([]);
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });
  it("exposes a bounded actual shader intensity token and consistent CSS palette instead of a decorative-only slider", () => {
    const theme = structuredClone(BUILTIN_THEMES["aqua-coquette"]);
    theme.appearance.glassIntensity = 0.37;
    applyThemeTokens(theme);
    expect(
      document.documentElement.style.getPropertyValue(
        "--lunar-liquid-intensity",
      ),
    ).toBe("0.37");
    expect(document.documentElement.style.getPropertyValue("--aqua-mint")).toBe(
      AQUA_COLORS.mint,
    );
    const node = document.createElement("div");
    document.body.append(node);
    for (const [value, expected] of [
      ["0.37", 0.37],
      ["-10", 0],
      ["5", 1],
    ] as const) {
      node.style.setProperty("--lunar-liquid-intensity", value);
      expect(
        readMaterial(node, { x: 0, y: 0, width: 100, height: 50 }).intensity,
      ).toBe(expected);
    }
    node.remove();
  });
  it("all visible preset/motion/tint controls change real values, and disabled presets cannot mutate them", () => {
    let value = DEFAULT_GLASS;
    function Controls({ disabled = false }) {
      const [current, change] = useState(DEFAULT_GLASS);
      value = current;
      return (
        <MaterialPresets
          value={current}
          disabled={disabled}
          onChange={change}
        />
      );
    }
    const view = render(<Controls />);
    fireEvent.click(screen.getByRole("button", { name: /^Crystal$/ }));
    expect(matchingMaterialPreset(value)).toBe("crystal");
    fireEvent.change(
      screen.getByRole("combobox", { name: "Material motion" }),
      { target: { value: "subtle" } },
    );
    expect(matchingMotionPreset(value)).toBe("subtle");
    fireEvent.click(
      screen.getByRole("button", { name: "Lilac material tint" }),
    );
    expect(value.tint).toBe(AQUA_COLORS.lilac);
    expect(screen.getByText(/Custom material/)).toBeDefined();
    view.rerender(<Controls disabled />);
    fireEvent.click(screen.getByRole("button", { name: /^Water Lens$/ }));
    expect(value.tint).toBe(AQUA_COLORS.lilac);
    expect(value.blur).toBe(0);
  });
  it("uses local-hour greetings without inferred location, identity or a background network request", () => {
    expect([0, 8, 14, 21].map(aquaGreeting)).toEqual([
      "A quiet orbit.",
      "Good morning.",
      "Good afternoon.",
      "Good evening.",
    ]);
  });
});
