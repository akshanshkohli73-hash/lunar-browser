// @vitest-environment jsdom
import React, { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_GLASS, glassDepth, resolveGlass } from "../shared/glass";
import { DEFAULT_DASHBOARD } from "../shared/dashboard";
import {
  MATERIAL_PROFILES,
  cssMaterialVariant,
  pearlMaterial,
  wantsLiquid,
  type MaterialRole,
  type MaterialVariant,
} from "../shared/materials";
import { GlassMaterialProvider } from "../src/state/GlassMaterialProvider";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import {
  GlassFieldset,
  GlassPanel,
  GlassToolbar,
} from "../src/components/ui/GlassControls";
import {
  GlassMaterialControls,
  materialFromGlobal,
} from "../src/components/dashboard/GlassControls";

beforeEach(() => {
  vi.stubGlobal("WebGL2RenderingContext", undefined);
  // Even full syntactic SVG URL support must NOT create optical SVG filters.
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
});
function Provider({
  children,
  reduced = false,
}: {
  children: React.ReactNode;
  reduced?: boolean;
}) {
  return (
    <GlassMaterialProvider
      settings={DEFAULT_GLASS}
      wallpaper={DEFAULT_DASHBOARD.wallpaper}
      text="theme"
      category="pastel"
      reducedMotion={reduced}
    >
      {children}
    </GlassMaterialProvider>
  );
}
describe("presentation-only Aqua Coquette material variants", () => {
  it("only opts liquid-webgl into real optics and always has an honest CSS alternative", () => {
    for (const variant of [
      "liquid-webgl",
      "pearl-css",
      "clear-surface",
    ] as const) {
      expect(wantsLiquid(variant)).toBe(variant === "liquid-webgl");
      expect(cssMaterialVariant(variant)).toBe(
        variant === "clear-surface" ? "clear-surface" : "pearl-css",
      );
    }
    expect(wantsLiquid(undefined)).toBe(true);
    expect(cssMaterialVariant(undefined)).toBe("pearl-css");
  });
  it("keeps hierarchy, CSS blur budgets, full opacity and saved optical values independent", () => {
    const settings = { ...DEFAULT_GLASS, blur: 24, refraction: 0.8 };
    for (const role of Object.keys(MATERIAL_PROFILES) as MaterialRole[])
      for (const tone of ["light", "dark"] as const) {
        const values = [0.6, 0.72, 1].map((opacity) => {
          const tokens = resolveGlass(
            { ...settings, opacity },
            undefined,
            true,
          );
          const depth = glassDepth(tokens, "deep", tone);
          const pearl = pearlMaterial(
            tokens,
            depth,
            role,
            tone,
            "liquid-webgl",
            true,
          );
          expect(pearl.blur).toBeLessThanOrEqual(
            MATERIAL_PROFILES[role].blurCap,
          );
          expect(pearl.blur).toBeLessThanOrEqual(12);
          expect(tokens.refraction).toBe(0.8);
          expect(depth.blur).toBe(24);
          expect(
            pearlMaterial(tokens, depth, role, tone, "clear-surface", true)
              .blur,
          ).toBe(0);
          const noBlur = pearlMaterial(
            tokens,
            depth,
            role,
            tone,
            "pearl-css",
            false,
          );
          expect(noBlur.blur).toBe(0);
          expect(noBlur.alpha).toBeGreaterThanOrEqual(
            tone === "dark" ? 0.86 : 0.84,
          );
          return pearl.alpha;
        });
        expect(values[1]).toBeGreaterThan(values[0]);
        expect(values[2]).toBe(1);
      }
    expect(MATERIAL_PROFILES.dock.sheen).toBeGreaterThan(
      MATERIAL_PROFILES.readable.sheen,
    );
    expect(MATERIAL_PROFILES.menu.alpha.light).toBeGreaterThan(
      MATERIAL_PROFILES.toolbar.alpha.light,
    );
    expect(MATERIAL_PROFILES.toolbar.shadow).toBeLessThan(
      MATERIAL_PROFILES.widget.shadow,
    );
    expect(DEFAULT_GLASS.blur).toBe(14);
  });
  it("does not allocate filter banks or extra material canvases when WebGL2 is unavailable", () => {
    const view = render(
      <Provider>
        {Array.from({ length: 20 }, (_, index) => (
          <GlassSurface key={index} materialRole={index ? "widget" : "dock"} />
        ))}
      </Provider>,
    );
    expect(view.container.querySelectorAll(".glass-surface")).toHaveLength(20);
    expect(
      document.querySelectorAll(
        "filter, feTurbulence, feDisplacementMap, .glass-optical-defs, canvas[data-liquid-output]",
      ),
    ).toHaveLength(0);
    for (const node of view.container.querySelectorAll<HTMLElement>(
      ".glass-surface",
    )) {
      expect(node.dataset.materialVariant).toBe("pearl-css");
      expect(node.style.filter).toBe("");
      expect(node.style.getPropertyValue("--glass-refraction-filter")).toBe("");
    }
    expect(document.documentElement.dataset.liquidEngine).toBe("css");
    expect(document.documentElement.dataset.liquidReason).toBe(
      "webgl2-unavailable",
    );
  });
  it("uses Clear Surface for nested forms and Pearl CSS hierarchy for chrome, search and widgets", () => {
    const view = render(
      <Provider>
        <GlassToolbar data-testid="toolbar" />
        <GlassSurface data-testid="search" variant="search" />
        <GlassSurface data-testid="notes" variant="notes" />
        <GlassSurface data-testid="dock" materialRole="dock" />
        <GlassPanel data-testid="panel">A text-heavy form</GlassPanel>
        <GlassFieldset>
          <input aria-label="Nested control" />
        </GlassFieldset>
      </Provider>,
    );
    expect(screen.getByTestId("toolbar").dataset.materialRole).toBe("toolbar");
    expect(screen.getByTestId("search").dataset.materialRole).toBe("search");
    expect(screen.getByTestId("notes").dataset.materialRole).toBe("readable");
    expect(
      screen.getByTestId("dock").style.getPropertyValue("--pearl-blur"),
    ).toBe("12px");
    for (const node of [
      screen.getByTestId("panel"),
      view.container.querySelector("fieldset > .glass-backing")!,
    ]) {
      expect(node.getAttribute("data-material-variant")).toBe("clear-surface");
      expect(node.getAttribute("data-glass-backdrop")).toBe("false");
      expect((node as HTMLElement).style.getPropertyValue("--pearl-blur")).toBe(
        "0px",
      );
    }
    fireEvent.change(screen.getByRole("textbox", { name: "Nested control" }), {
      target: { value: "Still editable" },
    });
    expect(
      (
        screen.getByRole("textbox", {
          name: "Nested control",
        }) as HTMLInputElement
      ).value,
    ).toBe("Still editable");
  });
  it("retains input identity, draft, selection, focus and geometry tokens across variant changes", () => {
    let mounts = 0;
    function Draft() {
      const [value, setValue] = useState("");
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <input
          aria-label="Material draft"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    const scene = (variant: MaterialVariant, reduced = false) => (
      <Provider reduced={reduced}>
        <GlassSurface
          materialVariant={variant}
          className="retained-layout"
          style={{ width: 320, padding: 16 }}
        >
          <Draft />
        </GlassSurface>
      </Provider>
    );
    const view = render(scene("liquid-webgl"));
    const input = screen.getByRole("textbox", {
      name: "Material draft",
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    input.focus();
    input.setSelectionRange(2, 6);
    for (const variant of [
      "pearl-css",
      "clear-surface",
      "liquid-webgl",
    ] as const) {
      view.rerender(scene(variant));
      expect(screen.getByRole("textbox", { name: "Material draft" })).toBe(
        input,
      );
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe("Keep this draft");
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
      const surface = input.parentElement!;
      expect(surface.style.width).toBe("320px");
      expect(surface.style.padding).toBe("16px");
      expect(surface.style.transform).toBe("");
      expect(surface.style.filter).toBe("");
    }
    view.rerender(scene("liquid-webgl", true));
    expect(document.documentElement.dataset.materialMotion).toBe("reduced");
    expect(document.documentElement.dataset.glassPointer).toBe("false");
    expect(mounts).toBe(1);
  });
  it("keeps a readable no-backdrop material and does not pretend SVG enables refraction", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    render(
      <Provider>
        <GlassSurface
          data-testid="surface"
          material={{ ...DEFAULT_GLASS, opacity: 0.6 }}
        />
        <GlassMaterialControls
          value={materialFromGlobal(DEFAULT_GLASS)}
          optical
          onChange={() => {}}
        />
      </Provider>,
    );
    const node = screen.getByTestId("surface");
    expect(node.dataset.materialVariant).toBe("pearl-css");
    expect(node.dataset.glassBackdrop).toBe("false");
    expect(
      Number(node.style.getPropertyValue("--pearl-alpha")),
    ).toBeGreaterThanOrEqual(0.84);
    expect(
      screen
        .getByRole("slider", { name: "Refraction intensity" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByText(/non-refractive alternative/u)).not.toBeNull();
  });
});
