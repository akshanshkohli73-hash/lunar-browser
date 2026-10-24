// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMinuteClock } from "../src/components/useMinuteClock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T00:00:58.000Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("updates at minute boundaries rather than rerendering the browser every second", () => {
  const { result } = renderHook(() => useMinuteClock(true));
  const initial = result.current;
  act(() => vi.advanceTimersByTime(1_999));
  expect(result.current).toBe(initial);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.toISOString()).toBe("2026-10-17T00:01:00.000Z");
  const minute = result.current;
  act(() => vi.advanceTimersByTime(59_999));
  expect(result.current).toBe(minute);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.toISOString()).toBe("2026-10-17T00:02:00.000Z");
});

it("removes the timer while hidden or on a non-new-tab page and refreshes on return", () => {
  const { result, rerender, unmount } = renderHook(
    ({ visible }) => useMinuteClock(visible),
    { initialProps: { visible: true } },
  );
  rerender({ visible: false });
  expect(vi.getTimerCount()).toBe(0);
  const suspended = result.current;
  act(() => vi.advanceTimersByTime(120_000));
  expect(result.current).toBe(suspended);
  rerender({ visible: true });
  expect(result.current.toISOString()).toBe("2026-10-17T00:02:58.000Z");
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("resynchronizes after a clock change/focus without accumulating timers", () => {
  const { result } = renderHook(() => useMinuteClock(true));
  vi.setSystemTime(new Date("2026-10-17T09:15:13.000Z"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current.toISOString()).toBe("2026-10-17T09:15:13.000Z");
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(47_000));
  expect(result.current.toISOString()).toBe("2026-10-17T09:16:00.000Z");
});
