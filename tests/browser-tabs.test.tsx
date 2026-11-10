// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserTabs } from "../src/components/BrowserTabs";
import type { TabInfo } from "../electron/types";
const tabs: TabInfo[] = ["One", "Two", "Three"].map((title, i) => ({
  id: `tab_${i}`,
  title,
  url: `https://example.test/${i}`,
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  isMuted: false,
  isPinned: false,
  audible: false,
}));
let resize: () => void;
const api = {
  switchTab: vi.fn(async () => {}),
  closeTab: vi.fn(async () => {}),
  reorderTabs: vi.fn(async () => {}),
};
const menu = vi.fn(),
  report = vi.fn(),
  reveal = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(fn: () => void) {
        resize = fn;
      }
      observe() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = reveal;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});
const view = (active = "tab_0") => (
  <BrowserTabs
    tabs={tabs}
    activeId={active}
    api={api}
    report={report}
    onMenu={menu}
  />
);

it("uses one roving stop, wraps arrow exploration, supports Home/End, and only activates with Enter/Space", async () => {
  const user = userEvent.setup();
  render(view());
  const one = screen.getByRole("tab", { name: "One" }),
    two = screen.getByRole("tab", { name: "Two" }),
    three = screen.getByRole("tab", { name: "Three" });
  expect(one.tabIndex).toBe(0);
  expect(two.tabIndex).toBe(-1);
  await user.tab();
  expect(document.activeElement).toBe(one);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(two);
  expect(api.switchTab).not.toHaveBeenCalled();
  expect(one.getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(three);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(one);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(three);
  await user.keyboard("{Home}{ArrowRight}{Enter}");
  expect(api.switchTab).toHaveBeenLastCalledWith("tab_1");
  await user.keyboard(" ");
  expect(api.switchTab).toHaveBeenLastCalledWith("tab_1");
});
it("keeps close, Delete, context menu and actual HTML drag reorder actions wired to existing native API methods", async () => {
  const user = userEvent.setup();
  render(view());
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Two" }));
  expect(menu).toHaveBeenCalledWith("tab_1");
  await user.tab();
  await user.keyboard("{ArrowRight}{Delete}");
  expect(api.closeTab).toHaveBeenCalledWith("tab_1");
  fireEvent.click(screen.getByRole("button", { name: "Close One" }));
  expect(api.closeTab).toHaveBeenCalledWith("tab_0");
  fireEvent.dragStart(screen.getByRole("tab", { name: "One" }).parentElement!);
  fireEvent.drop(screen.getByRole("tab", { name: "Three" }).parentElement!);
  expect(api.reorderTabs).toHaveBeenCalledWith(["tab_1", "tab_0", "tab_2"]);
});
it("reveals the active tab without stealing a focused address draft and enables only meaningful overflow directions", () => {
  const rendered = render(
    <>
      <input aria-label="Address draft" defaultValue="Keep my draft" />
      {view()}
    </>,
  );
  const input = screen.getByRole("textbox", { name: "Address draft" });
  act(() => input.focus());
  rendered.rerender(
    <>
      <input aria-label="Address draft" defaultValue="Keep my draft" />
      {view("tab_2")}
    </>,
  );
  expect(document.activeElement).toBe(input);
  expect(reveal).toHaveBeenCalledWith({
    block: "nearest",
    inline: "nearest",
    behavior: "auto",
  });
  const list = screen.getByRole("tablist"),
    scroll = vi.fn();
  list.scrollBy = scroll;
  Object.defineProperties(list, {
    clientWidth: { configurable: true, value: 180 },
    scrollWidth: { configurable: true, value: 600 },
  });
  act(() => resize());
  expect(
    screen
      .getByRole("button", { name: "Scroll tabs left" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Scroll tabs right" })
      .hasAttribute("disabled"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Scroll tabs right" }));
  expect(scroll).toHaveBeenCalledWith({ left: 160, behavior: "smooth" });
  list.scrollLeft = 420;
  fireEvent.scroll(list);
  expect(
    screen
      .getByRole("button", { name: "Scroll tabs right" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("reports API rejection and does not display functional tab actions without the native bridge", async () => {
  const user = userEvent.setup();
  const rejecting = {
    ...api,
    switchTab: vi.fn(async () => {
      throw new Error("Native tab unavailable");
    }),
  };
  const rendered = render(
    <BrowserTabs
      tabs={tabs}
      activeId="tab_0"
      api={rejecting}
      report={report}
      onMenu={menu}
    />,
  );
  await user.click(screen.getByRole("tab", { name: "Two" }));
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Native tab unavailable" }),
  );
  rendered.rerender(
    <BrowserTabs
      tabs={tabs}
      activeId="tab_0"
      api={undefined}
      report={report}
      onMenu={menu}
    />,
  );
  expect(
    screen.getByRole("tab", { name: "One" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Close One" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("reveals the selected tab after a same-length reorder without replacing the single strip observer", () => {
  const rendered = render(view("tab_2"));
  const observer = resize;
  reveal.mockClear();
  rendered.rerender(
    <BrowserTabs
      tabs={[...tabs].reverse()}
      activeId="tab_2"
      api={api}
      report={report}
      onMenu={menu}
    />,
  );
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(reveal.mock.contexts[0]).toBe(
    screen.getByRole("tab", { name: "Three" }),
  );
  expect(resize).toBe(observer);
});
