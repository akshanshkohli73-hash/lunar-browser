// @vitest-environment jsdom
import React, { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DEFAULT_GLASS } from "../shared/glass";
import {
  createWidget,
  WIDGET_DEFINITIONS,
  type WidgetKind,
} from "../shared/dashboard";
import { GlassSurface } from "../src/components/ui/GlassSurface";
import { WidgetCell } from "../src/components/dashboard/WidgetCell";
import { BrowserProvider } from "../src/state/BrowserContext";
import {
  WorkspaceActivity,
  useWorkspaceActivity,
} from "../src/state/WorkspaceActivity";
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  delete window.lunarAPI;
  vi.unstubAllGlobals();
});
describe("reusable glass surface and unchanged widget identities", () => {
  it("binds all real material tokens and cannot bypass the global off switch", () => {
    const view = render(
      <GlassSurface
        material={DEFAULT_GLASS}
        override={{
          opacity: 0.61,
          blur: 23,
          tint: "#ddbbaa",
          border: 0.7,
          reflection: 0.8,
          shadow: 0.9,
        }}
        data-testid="surface"
      >
        Readable content
      </GlassSurface>,
    );
    const surface = screen.getByTestId("surface");
    expect(surface.dataset.glassMode).toBe("glass");
    for (const [key, value] of Object.entries({
      opacity: "0.61",
      blur: "23px",
      tint: "#ddbbaa",
      border: "0.7",
      reflection: "0.8",
      shadow: "0.9",
    }))
      expect(surface.style.getPropertyValue(`--glass-${key}`)).toBe(value);
    view.rerender(
      <GlassSurface
        material={{ ...DEFAULT_GLASS, enabled: false }}
        override={{ enabled: true }}
        data-testid="surface"
      />,
    );
    expect(surface.dataset.glassMode).toBe("solid");
    expect(surface.style.getPropertyValue("--glass-blur")).toBe("0px");
  });
  it("does not remount children or discard drafts when a material changes", () => {
    let mounts = 0;
    function Draft() {
      const [text, setText] = useState("");
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <input
          aria-label="Local draft"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      );
    }
    const view = render(
      <GlassSurface material={DEFAULT_GLASS}>
        <Draft />
      </GlassSurface>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Local draft" }), {
      target: { value: "Do not lose my draft" },
    });
    view.rerender(
      <GlassSurface
        material={{ ...DEFAULT_GLASS, opacity: 0.64, tint: "#dccabc" }}
        level="deep"
      >
        <Draft />
      </GlassSurface>,
    );
    expect(mounts).toBe(1);
    expect(
      view.container
        .querySelector(".glass-surface")
        ?.getAttribute("data-glass-level"),
    ).toBe("deep");
    expect(
      (screen.getByRole("textbox", { name: "Local draft" }) as HTMLInputElement)
        .value,
    ).toBe("Do not lose my draft");
  });
  it("reduces expensive material passes on workspace blur/inactivity without losing content", () => {
    function Probe() {
      return (
        <GlassSurface
          material={DEFAULT_GLASS}
          active={useWorkspaceActivity()}
          data-testid="surface"
        >
          Still here
        </GlassSurface>
      );
    }
    const view = render(
      <WorkspaceActivity active>
        <Probe />
      </WorkspaceActivity>,
    );
    const node = screen.getByTestId("surface");
    expect(node.dataset.glassMode).toBe("glass");
    act(() => window.dispatchEvent(new Event("blur")));
    expect(node.dataset.glassMode).toBe("simple");
    expect(node.style.getPropertyValue("--glass-blur")).toBe("0px");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(node.dataset.glassMode).toBe("glass");
    view.rerender(
      <WorkspaceActivity active={false}>
        <Probe />
      </WorkspaceActivity>,
    );
    expect(node.dataset.glassMode).toBe("simple");
    expect(node.textContent).toBe("Still here");
  });
  it("shares one foreground subscription across nested shell/workspace activity gates", () => {
    const listener = vi.spyOn(window, "addEventListener");
    function Probe() {
      return (
        <GlassSurface
          material={DEFAULT_GLASS}
          active={useWorkspaceActivity()}
          data-testid="nested"
        />
      );
    }
    const view = render(
      <WorkspaceActivity active>
        <WorkspaceActivity active>
          <Probe />
        </WorkspaceActivity>
      </WorkspaceActivity>,
    );
    expect(
      listener.mock.calls.filter(([name]) => name === "blur"),
    ).toHaveLength(1);
    expect(
      listener.mock.calls.filter(([name]) => name === "focus"),
    ).toHaveLength(1);
    act(() => window.dispatchEvent(new Event("blur")));
    expect(screen.getByTestId("nested").dataset.glassMode).toBe("simple");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByTestId("nested").dataset.glassMode).toBe("glass");
    view.rerender(
      <WorkspaceActivity active>
        <WorkspaceActivity active={false}>
          <Probe />
        </WorkspaceActivity>
      </WorkspaceActivity>,
    );
    expect(screen.getByTestId("nested").dataset.glassMode).toBe("simple");
    listener.mockRestore();
  });
  it("wraps every existing widget kind with exactly one material, retaining its real layout/component", () => {
    const widgets = (Object.keys(WIDGET_DEFINITIONS) as WidgetKind[]).map(
      (kind) => createWidget(kind, kind),
    );
    const view = render(
      <BrowserProvider>
        {widgets.map((widget) => (
          <WidgetCell
            key={widget.id}
            widget={widget}
            material={DEFAULT_GLASS}
            tone="light"
            active
            reduced
            editing={false}
            occluded={false}
            selected={false}
            dragging={false}
            target={false}
            onChange={() => {
              throw new Error("No edit should occur");
            }}
            onSelect={() => {}}
            onDrag={() => {}}
            navigate={() => {}}
          />
        ))}
      </BrowserProvider>,
    );
    expect(view.container.querySelectorAll(".glass-surface")).toHaveLength(9);
    for (const widget of widgets) {
      const surface = screen
        .getByRole("article", {
          name: `${WIDGET_DEFINITIONS[widget.kind].title} widget`,
        })
        .querySelector<HTMLElement>(".glass-surface")!;
      expect(surface.dataset.glassLevel).toBe(
        WIDGET_DEFINITIONS[widget.kind].material,
      );
      expect(surface.style.getPropertyValue("--glass-alpha")).not.toBe("");
      expect(
        screen
          .getByRole("article", {
            name: `${WIDGET_DEFINITIONS[widget.kind].title} widget`,
          })
          .querySelectorAll(".glass-surface"),
      ).toHaveLength(1);
    }
    expect(
      screen.getByRole("textbox", { name: "Dashboard note" }),
    ).toBeDefined();
    expect(
      screen.getByRole("textbox", { name: "Search the web" }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Update weather" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
  it("reveals only supported resize handles while editing and cycles a real collision-layout size", () => {
    const widget = createWidget("notes", "notes"),
      change = vi.fn();
    const props = {
      widget,
      material: DEFAULT_GLASS,
      tone: "light" as const,
      active: true,
      reduced: true,
      editing: false,
      occluded: false,
      selected: false,
      dragging: false,
      target: false,
      onChange: change,
      onSelect: vi.fn(),
      onDrag: vi.fn(),
      navigate: vi.fn(),
    };
    const view = render(
      <BrowserProvider>
        <WidgetCell {...props} />
      </BrowserProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Resize Notes widget" }),
    ).toBeNull();
    view.rerender(
      <BrowserProvider>
        <WidgetCell {...props} editing selected />
      </BrowserProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Resize Notes widget" }),
    );
    expect(change).toHaveBeenCalledExactlyOnceWith({ ...widget, w: 6, h: 5 });
    change.mockClear();
    fireEvent.pointerCancel(
      screen.getByRole("button", { name: "Resize Notes widget" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Resize Notes widget" }),
      { detail: 0 },
    );
    expect(change).toHaveBeenCalledExactlyOnceWith({ ...widget, w: 6, h: 5 });

    const handle = view.container.querySelector(".widget-arrange-handle")!;
    const setData = vi.fn();
    fireEvent.dragStart(handle, {
      dataTransfer: { setData, effectAllowed: "" },
    });
    expect(setData).toHaveBeenCalledWith("application/x-lunar-widget", "notes");
    expect(props.onDrag).toHaveBeenCalledWith("notes");
    fireEvent.dragEnd(handle);
    expect(props.onDrag).toHaveBeenLastCalledWith(null);
    view.rerender(
      <BrowserProvider>
        <WidgetCell
          {...props}
          widget={createWidget("weather", "weather")}
          editing
        />
      </BrowserProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Resize Weather widget" }),
    ).toBeNull();
  });
});
