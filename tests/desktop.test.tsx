// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import Desktop from "../src/components/CoquetteDesktopPortfolio";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("preserved Coquette desktop integration", () => {
  it("mounts one permanent browser, and dock activation restores it without remounting", () => {
    let mounts = 0;
    function Browser() {
      React.useEffect(() => {
        mounts++;
      }, []);
      return <div data-testid="browser">native workspace</div>;
    }
    render(<Desktop browserComponent={Browser} intro={false} />);
    expect(mounts).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /show desktop/i }));
    expect(screen.getByTestId("browser").closest("[hidden]")).not.toBeNull();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Dock" })).getByRole(
        "button",
        { name: "Lunar Browser" },
      ),
    );
    expect(screen.getAllByTestId("browser")).toHaveLength(1);
    expect(screen.getByTestId("browser").closest("[hidden]")).toBeNull();
    expect(mounts).toBe(1);
  });
  it("keeps Notes and original Now as distinct utilities with SVG icons", () => {
    render(
      <Desktop
        notesComponent={() => <textarea aria-label="Quick note" />}
        intro={false}
      />,
    );
    const dock = within(screen.getByRole("navigation", { name: "Dock" }));
    for (const button of dock.getAllByRole("button")) {
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.querySelector("[data-missing-icon]")).toBeNull();
    }
    fireEvent.click(dock.getByRole("button", { name: "Notes" }));
    fireEvent.click(dock.getByRole("button", { name: "Now" }));
    expect(screen.getAllByRole("textbox", { name: "Quick note" })).toHaveLength(
      1,
    );
    expect(screen.getByRole("dialog", { name: "Notes" })).toBeDefined();
    expect(screen.getByRole("dialog", { name: "Now" })).toBeDefined();
  });
  it("restores a utility clicked again during its close transition instead of focusing a disappearing window", () => {
    render(
      <Desktop
        notesComponent={() => <textarea aria-label="Quick note" />}
        intro={false}
      />,
    );
    const dock = within(screen.getByRole("navigation", { name: "Dock" }));
    fireEvent.click(dock.getByRole("button", { name: "Notes" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Notes" })).getByRole(
        "button",
        { name: "Close" },
      ),
    );
    fireEvent.click(dock.getByRole("button", { name: "Notes" }));
    expect(screen.getAllByRole("dialog", { name: "Notes" })).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Notes" }).className,
    ).not.toContain("is-out");
  });
  it("activates the original folder shortcuts and new preferences through the right identifiers", () => {
    render(
      <Desktop
        settingsComponent={() => <div>Preferences content</div>}
        intro={false}
      />,
    );
    fireEvent.doubleClick(
      screen.getByRole("button", { name: "Open websites" }),
    );
    expect(screen.getByRole("dialog", { name: "Websites" })).toBeDefined();
    fireEvent.doubleClick(
      screen.getByRole("button", { name: "Open Preferences" }),
    );
    expect(screen.getAllByText("Preferences content")).toHaveLength(1);
  });
});
