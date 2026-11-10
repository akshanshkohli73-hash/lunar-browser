// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { AQUA_OPTICS } from "../shared/aqua";
import {
  LiquidInteractionController,
  freshPhysics,
} from "../src/liquid/LiquidInteractionController";
const rect = { x: 0, y: 0, width: 200, height: 100 };
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  document.body.innerHTML = "";
});
function scene(tag = "button") {
  const controller = new LiquidInteractionController(() => {}),
    node = document.createElement(tag);
  document.body.append(node);
  controller.mount(document);
  cleanups.push(() => controller.dispose());
  return { controller, node, state: freshPhysics() };
}
it("creates a localized bounded optical ripple on press, then becomes completely idle without moving logical geometry", () => {
  const { controller, node, state } = scene();
  node.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true }),
  );
  let frame = controller.advance(state, rect, 1 / 60, 1, true);
  expect(frame.ripple.slice(0, 2)).toEqual([0.5, 0.5]);
  expect(frame.ripple[3]).toBeGreaterThan(0);
  node.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  controller.reset(); // Leaving a surface must not retain an impulse.
  expect(controller.advance(state, rect, 1 / 60, 1, true).ripple[3]).toBe(0);
  node.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: 60, clientY: 40, bubbles: true }),
  );
  node.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  let seen = false;
  for (let i = 0; i < 150; i++) {
    frame = controller.advance(state, rect, 1 / 60, 1, true);
    seen ||= frame.ripple[3] > 0;
    expect(frame.ripple[3]).toBeGreaterThanOrEqual(0);
    expect(frame.ripple[3]).toBeLessThanOrEqual(1);
    expect(frame.ripple[2]).toBeLessThanOrEqual(AQUA_OPTICS.rippleSeconds);
  }
  expect(seen).toBe(true);
  expect(frame.ripple).toEqual([0.5, 0.5, 0, 0]);
  expect(frame.settling).toBe(false);
  expect(rect).toEqual({ x: 0, y: 0, width: 200, height: 100 });
});
it("does not create ripples or compression when editing text, outside the surface, or when effects are disabled", () => {
  const { controller, node, state } = scene("input");
  node.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: 50, clientY: 30, bubbles: true }),
  );
  const input = controller.advance(state, rect, 1 / 60, 1, true);
  expect(input.ripple[3]).toBe(0);
  expect(input.bend[2]).toBe(0);
  const button = document.createElement("button");
  document.body.append(button);
  button.dispatchEvent(
    new MouseEvent("pointerdown", {
      clientX: 500,
      clientY: 500,
      bubbles: true,
    }),
  );
  expect(
    controller.advance(freshPhysics(), rect, 1 / 60, 1, true).ripple[3],
  ).toBe(0);
  button.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: 50, clientY: 30, bubbles: true }),
  );
  expect(
    controller.advance(freshPhysics(), rect, 1 / 60, 1, false).ripple[3],
  ).toBe(0);
});
it("keyboard press reuses the same bounded impulse, ignores key repeat, and clears it during fallback", () => {
  const { controller, node, state } = scene();
  node.getBoundingClientRect = () => ({
    ...rect,
    left: 0,
    top: 0,
    right: 200,
    bottom: 100,
    toJSON: () => ({}),
  });
  node.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  const first = controller.advance(state, rect, 1 / 60, 1, true);
  expect(first.ripple[3]).toBeGreaterThan(0);
  let next = first;
  for (let i = 0; i < 20; i++) {
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        repeat: true,
        bubbles: true,
      }),
    );
    next = controller.advance(state, rect, 1 / 60, 1, true);
  }
  expect(next.ripple[2]).toBeGreaterThan(0.3);
  controller.clearRipples();
  expect(controller.advance(state, rect, 1 / 60, 1, true).ripple[3]).toBe(0);
});

it("does not replay expired input on a new or previously hidden surface", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  try {
    const { controller, node, state } = scene();
    node.dispatchEvent(
      new MouseEvent("pointerdown", {
        clientX: 100,
        clientY: 50,
        bubbles: true,
      }),
    );
    expect(
      controller.advance(state, rect, 1 / 60, 1, true).ripple[3],
    ).toBeGreaterThan(0);
    node.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    now.mockReturnValue(2000);
    expect(
      controller.advance(freshPhysics(), rect, 1 / 60, 1, true).ripple[3],
    ).toBe(0);
    expect(controller.advance(state, rect, 1 / 60, 1, true).ripple[3]).toBe(0);
  } finally {
    now.mockRestore();
  }
});

it("retains a complete between-frame click when hover motion is off, without enabling hover compression", () => {
  const { controller, node, state } = scene();
  node.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: 100, clientY: 50, bubbles: true }),
  );
  node.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  const frame = controller.advance(
    state,
    rect,
    1 / 60,
    1,
    false,
    performance.now(),
    true,
  );
  expect(frame.ripple[3]).toBeGreaterThan(0);
  expect(frame.bend).toEqual([0, 0, 0]);
});
