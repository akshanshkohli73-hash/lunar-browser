// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Modal } from "../src/components/ui/Modal";
afterEach(cleanup);

describe("independent modal content and keyboard boundaries", () => {
  it("keeps the header outside the body scroller, closes only on the backdrop, and restores focus", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const close = vi.fn();
    const view = render(
      <Modal title="Material controls" onClose={close}>
        <input aria-label="Draft" defaultValue="Keep this draft" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Material controls" });
    expect(dialog.querySelector(":scope > header")).not.toBeNull();
    expect(
      dialog
        .querySelector(".lunar-modal-body")
        ?.contains(screen.getByLabelText("Draft")),
    ).toBe(true);
    expect(
      dialog
        .querySelector(".lunar-modal-body")
        ?.contains(screen.getByRole("heading")),
    ).toBe(false);
    fireEvent.mouseDown(screen.getByLabelText("Draft"));
    expect(close).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement!);
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
  it("wraps focus around visible controls, skips hidden options and preserves Escape", () => {
    const close = vi.fn();
    render(
      <Modal title="Material controls" onClose={close}>
        <button>Apply</button>
        <fieldset hidden>
          <button>Hidden action</button>
        </fieldset>
      </Modal>,
    );
    const dialog = within(screen.getByRole("dialog"));
    const first = dialog.getByRole("button", {
      name: "Close Material controls",
    });
    const last = dialog.getByRole("button", { name: "Apply" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
