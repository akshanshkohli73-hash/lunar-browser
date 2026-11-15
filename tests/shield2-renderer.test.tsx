// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { LunarAPI } from "../shared/api";
import type { BrowserSettings } from "../shared/schemas";
import type { ShieldState } from "../electron/types";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { shieldState, deferred } from "./helpers/shield-state";
import ShieldPanel from "../src/components/ShieldPanel";
import ShieldDashboard from "../src/components/shield/ShieldDashboard";
import { useShield } from "../src/components/shield/useShield";
const host = vi.hoisted(() => ({
  current: {} as {
    api?: LunarAPI;
    shield: ShieldState | null;
    settings: BrowserSettings;
    siteForControls: string;
    updateSettings: (partial: Partial<BrowserSettings>) => Promise<void>;
    openPage: (page: string) => Promise<void>;
    report: (error: unknown) => void;
  },
}));
vi.mock("../src/state/BrowserContext", () => ({
  useBrowser: () => host.current,
}));
let state: ShieldState, api: LunarAPI;
const origin = "https://site.example.org";
function bridge(methods: Partial<LunarAPI>): LunarAPI {
  return new Proxy(methods, {
    get(target, name) {
      if (Reflect.has(target, name)) return Reflect.get(target, name);
      throw new Error(`Unexpected renderer bridge operation: ${String(name)}`);
    },
  }) as LunarAPI;
}
beforeEach(() => {
  state = shieldState();
  api = bridge({
    getShieldState: vi.fn(async (input) => {
      const next = structuredClone(state);
      if (input && next.protection?.site) {
        next.protection.site.origin = input;
        next.site!.origin = input;
        next.site!.hostname = new URL(input).hostname;
      }
      return next;
    }),
    setShieldSite: vi.fn(async (input, patch) => {
      state.protection!.site!.override = patch
        ? { origin: input, ...patch }
        : null;
      state.protection!.site!.enabled = patch?.enabled !== false;
      return state;
    }),
    getSitePrivacy: vi.fn(async (input) => ({
      origin: input,
      cookies: 0,
      grants: [],
      denials: [],
    })),
    getPrivacyOverview: vi.fn(async () => ({
      cookies: 0,
      cacheBytes: 0,
      cookieDomains: [],
      origins: [origin],
      permissions: [],
      storageBytesAvailable: false as const,
    })),
    clearSelectedData: vi.fn(async () => {}),
    refreshShield: vi.fn(async () => state),
    exportShieldRules: vi.fn(async () => false),
    setSitePermission: vi.fn(async () => {}),
    youtubeProtection: vi.fn(async (action) => {
      if (action.type === "set")
        state.protection!.youtube.enabled = action.enabled;
      return state;
    }),
  });
  host.current = {
    api,
    shield: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    siteForControls: origin,
    updateSettings: vi.fn(async (partial) => {
      host.current.settings = { ...host.current.settings, ...partial };
    }),
    openPage: vi.fn(async () => {}),
    report: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const ready = async () => {
  await waitFor(() =>
    expect(
      screen.queryByText("Reading local protection state…"),
    ).not.toBeInTheDocument(),
  );
};
const section = (name: string) =>
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Shield sections" }),
    ).getByRole("button", { name }),
  );
describe("sequenced detailed reads, pending operations and exact-origin changes", () => {
  it("ignores an old-origin reply and error after the popup has moved to another origin", async () => {
    const first = deferred<ShieldState>(),
      next = deferred<ShieldState>();
    vi.mocked(api.getShieldState)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => next.promise);
    const { result, rerender } = renderHook(({ url }) => useShield(url), {
      initialProps: { url: origin },
    });
    rerender({ url: "https://other.example.net" });
    await act(async () =>
      next.resolve(shieldState("https://other.example.net")),
    );
    expect(result.current.site?.origin).toBe("https://other.example.net");
    await act(async () => first.reject(new Error("stale read failed")));
    expect(result.current.site?.origin).toBe("https://other.example.net");
    expect(result.current.error).toBe("");
  });
  it("keeps the latest accepted success, without losing an earlier valid reply merely because a later read failed", async () => {
    const older = deferred<ShieldState>(),
      newer = deferred<ShieldState>();
    vi.mocked(api.getShieldState)
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const { result } = renderHook(() => useShield(origin));
    let reading!: Promise<void>;
    act(() => {
      reading = result.current.reload();
    });
    await act(async () => newer.reject(new Error("retry failed")));
    expect(result.current.error).toBe("retry failed");
    await act(async () => older.resolve(shieldState()));
    await reading;
    expect(result.current.site?.origin).toBe(origin);
    expect(result.current.error).toBe("");
    const stale = deferred<ShieldState>(),
      current = deferred<ShieldState>();
    vi.mocked(api.getShieldState)
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => current.promise);
    act(() => {
      void result.current.reload();
      void result.current.reload();
    });
    const saved = shieldState();
    saved.protection!.site!.enabled = false;
    await act(async () => current.resolve(saved));
    await act(async () => stale.resolve(shieldState()));
    expect(result.current.site?.enabled).toBe(false);
  });
  it("does not show an old site's operation error on a new site and refreshes the current origin when it completes", async () => {
    const pending = deferred<void>();
    const { result, rerender } = renderHook(({ url }) => useShield(url), {
      initialProps: { url: origin },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let running!: Promise<boolean>;
    act(() => {
      running = result.current.run(() => pending.promise);
    });
    expect(result.current.busy).toBe(true);
    rerender({ url: "https://next.example.net" });
    await act(async () => pending.reject(new Error("old origin failed")));
    await running;
    expect(result.current.error).toBe("");
    expect(result.current.site?.origin).toBe("https://next.example.net");
    expect(api.getShieldState).toHaveBeenLastCalledWith(
      "https://next.example.net",
    );
    expect(result.current.busy).toBe(false);
  });
  it("disables controls during loading/saving, applies only the exact popup origin and keeps failure feedback after refreshing state", async () => {
    const reading = deferred<ShieldState>();
    vi.mocked(api.getShieldState).mockImplementationOnce(() => reading.promise);
    render(<ShieldPanel url={`${origin}/page?private=not-a-policy`} />);
    expect(screen.getByText("Reading local protection state…")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open privacy dashboard" }),
    ).toBeEnabled();
    await act(async () => reading.resolve(state));
    await ready();
    const toggle = screen.getByRole("checkbox", {
      name: /Protect this website/,
    });
    const saving = deferred<ShieldState>();
    vi.mocked(api.setShieldSite).mockImplementationOnce(() => saving.promise);
    fireEvent.click(toggle);
    expect(toggle).toBeDisabled();
    expect(api.setShieldSite).toHaveBeenCalledExactlyOnceWith(origin, {
      enabled: false,
    });
    expect(host.current.updateSettings).not.toHaveBeenCalled();
    await act(async () => saving.reject(new Error("Disk full: nothing saved")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Disk full: nothing saved",
    );
    expect(toggle).toBeEnabled();
    expect(toggle).toBeChecked();
  });
  it("allows only the explained blocked host/resource on its own site and opens the actual dashboard route", async () => {
    state.protection!.site!.recent = [
      {
        id: "fixture",
        hostname: "tracker.example.net",
        site: origin,
        source: "easyprivacy",
        rule: "||tracker.example.net^$script",
        resourceType: "script",
        category: "trackers",
        thirdParty: true,
        time: Date.UTC(2026, 9, 15),
        youtube: false,
      },
    ];
    const close = vi.fn();
    render(<ShieldPanel url={origin} onDashboard={close} />);
    await ready();
    fireEvent.click(screen.getByText("Recent confirmed blocks (1)"));
    fireEvent.click(
      screen.getByText("tracker.example.net", { selector: "strong" }),
    );
    expect(
      screen.getByText("Third-party", { exact: false }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Allow this host/resource here" }),
    );
    await waitFor(() =>
      expect(api.setShieldSite).toHaveBeenCalledWith(origin, {
        allowedRequests: [
          { hostname: "tracker.example.net", resourceType: "script" },
        ],
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open privacy dashboard" }),
    );
    expect(close).toHaveBeenCalledOnce();
    expect(host.current.openPage).toHaveBeenCalledWith("shield");
  });
});
describe("dashboard real-control rendering through a controlled bridge", () => {
  it("provides all eight sections, empty timestamped history and explicit renderer-preview limitations", async () => {
    render(<ShieldDashboard />);
    await ready();
    expect(
      within(
        screen.getByRole("navigation", { name: "Shield sections" }),
      ).getAllByRole("button"),
    ).toHaveLength(8);
    expect(
      screen.getByRole("combobox", { name: "Website origin" }),
    ).toHaveValue(origin);
    section("Statistics");
    expect(
      screen.getByText(/No timestamped request activity recorded yet/),
    ).toBeVisible();
    expect(screen.queryAllByRole("row")).toHaveLength(1);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Statistics period" }),
      { target: { value: "month" } },
    );
    expect(
      screen.getByRole("combobox", { name: "Statistics period" }),
    ).toHaveValue("month");
    cleanup();
    host.current.api = undefined;
    render(<ShieldDashboard />);
    expect(
      screen.getByText(/This preview does not fabricate activity/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Select website" }),
    ).toBeDisabled();
  });
  it("shows source update failures, native export cancellation and no false success state", async () => {
    render(<ShieldDashboard />);
    await ready();
    section("Filter lists");
    state.lists[1].error = "HTTP 503: last-good rules retained";
    host.current.settings.shield.filterLists.push("easyprivacy");
    fireEvent.click(screen.getByRole("button", { name: "Update selected" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    section("Custom rules");
    fireEvent.click(
      screen.getByRole("button", { name: "Export custom rules…" }),
    );
    expect(
      await screen.findByText("Cancelled. No changes made."),
    ).toBeVisible();
    expect(screen.queryByText(/backup exported/)).not.toBeInTheDocument();
  });
  it("keeps an invalid rule draft intact and sends custom enabled/exception text separately from source selection", async () => {
    const save = vi
      .fn<LunarAPI["saveShieldRule"]>()
      .mockRejectedValueOnce(new Error("Unsupported scriptlet"));
    api = bridge({ ...api, saveShieldRule: save });
    host.current.api = api;
    render(<ShieldDashboard />);
    await ready();
    section("Custom rules");
    fireEvent.change(screen.getByRole("textbox", { name: "Network rule" }), {
      target: { value: "example.org##+js(noop)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported scriptlet",
    );
    expect(screen.getByRole("textbox", { name: "Network rule" })).toHaveValue(
      "example.org##+js(noop)",
    );
    expect(host.current.updateSettings).not.toHaveBeenCalled();
    save.mockResolvedValueOnce(state);
    fireEvent.change(screen.getByRole("textbox", { name: "Network rule" }), {
      target: { value: "@@||safe.example^$script" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Rule enabled" }));
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(null, {
        text: "@@||safe.example^$script",
        enabled: false,
        note: "",
      }),
    );
  });
  it("does not silently persist an Allow when native sensitive-access confirmation is cancelled", async () => {
    vi.mocked(api.setSitePermission).mockRejectedValueOnce(
      new Error("Permission change cancelled"),
    );
    render(<ShieldDashboard />);
    await ready();
    section("Permissions");
    const permission = screen.getByRole("combobox", {
      name: "Camera permission",
    });
    expect(permission).toHaveValue("ask");
    fireEvent.change(permission, { target: { value: "allow" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled");
    expect(api.setSitePermission).toHaveBeenCalledWith(
      origin,
      "media:video",
      "allow",
    );
    expect(permission).toHaveValue("ask");
  });
  it("rejects unsupported time-scoped storage before native deletion and refreshes the inventory after a partial native failure", async () => {
    vi.mocked(api.clearSelectedData).mockRejectedValueOnce(
      new Error("Native storage deletion failed"),
    );
    render(<ShieldDashboard />);
    await ready();
    section("Storage & data");
    await screen.findByText("Website cookies");
    const clear = screen.getByRole("button", {
      name: "Review & clear selected data…",
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Data time range" }),
      { target: { value: "hour" } },
    );
    expect(clear).toBeDisabled();
    expect(api.clearSelectedData).not.toHaveBeenCalled();
    expect(screen.getAllByText(/sign you out/).length).toBeGreaterThan(0);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Data time range" }),
      { target: { value: "all" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Data scope" }), {
      target: { value: "site" },
    });
    fireEvent.click(clear);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Native storage deletion failed",
    );
    expect(api.clearSelectedData).toHaveBeenCalledExactlyOnceWith({
      origin,
      range: "all",
      types: ["cache"],
    });
    expect(api.getPrivacyOverview).toHaveBeenCalledTimes(2);
  });
  it("changes only the independent YouTube profile and never reports an advertisement removal or successful playback", async () => {
    render(<ShieldDashboard />);
    await ready();
    section("YouTube privacy");
    const toggle = screen.getByRole("checkbox", {
      name: /YouTube privacy profile/,
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(api.youtubeProtection).toHaveBeenCalledExactlyOnceWith({
        type: "set",
        enabled: false,
      }),
    );
    expect(host.current.updateSettings).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        /not independently verified removed YouTube advertisements/,
      ),
    ).toBeVisible();
    expect(screen.getByText(/not a successful playback/)).toBeVisible();
  });
});
