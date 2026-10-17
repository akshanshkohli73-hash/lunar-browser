import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "electron";
import { DEFAULT_SHIELD } from "../shared/defaults";
import type { ShieldSettings } from "../electron/types";
const remote = vi.hoisted(() => ({ fail: false }));
vi.mock("electron", () => ({
  net: {
    fetch: async () =>
      remote.fail
        ? new Response("unavailable", { status: 503 })
        : new Response("0.0.0.0 remote-tracker.test\n"),
  },
}));
const { LunarShield } = await import("../electron/blocker/shield");
type Details = { url: string; webContentsId: number; resourceType: string };
let callback:
    | ((
        details: Details,
        complete: (result: { cancel: boolean }) => void,
      ) => void)
    | null,
  profile: string,
  settings: ShieldSettings,
  shield: InstanceType<typeof LunarShield>;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield-"));
  settings = structuredClone(DEFAULT_SHIELD);
  remote.fail = false;
  const session = {
    webRequest: {
      onBeforeRequest: (filter: unknown, handler: typeof callback) => {
        callback = filter === null ? null : handler;
      },
    },
  } as unknown as Session;
  shield = new LunarShield(
    session,
    profile,
    () => settings,
    () => "https://example.com",
    () => {},
  );
});
afterEach(() => {
  shield.dispose();
  fs.rmSync(profile, { recursive: true, force: true });
});
const request = (url: string) => {
  let cancelled = false;
  callback!({ url, webContentsId: 7, resourceType: "script" }, (result) => {
    cancelled = result.cancel;
  });
  return cancelled;
};
describe("Shield interception and real cache state", () => {
  it("passes the actual cancel decision to Electron’s interceptor callback and reports engine counters", () => {
    expect(request("https://ads.doubleclick.net/request")).toBe(true);
    expect(shield.getState().stats).toMatchObject({
      adsBlocked: 1,
      totalBlocked: 1,
    });
    settings.enabled = false;
    expect(request("https://ads.doubleclick.net/request")).toBe(false);
    expect(request("https://example.org/ordinary-script.js")).toBe(false);
    expect(shield.getState().stats.totalBlocked).toBe(1);
  });
  it("activates fetched host rules only after a successful validated write and retains them after an update failure", async () => {
    settings.filterLists = ["stevenblack"];
    expect(shield.getState().lists[1].error).toContain("Not downloaded");
    await shield.refresh();
    expect(shield.getState().lists[1].ruleCount).toBe(1);
    expect(request("https://remote-tracker.test/x")).toBe(true);
    remote.fail = true;
    await shield.refresh();
    expect(shield.getState().lists[1].error).toContain("503");
    expect(request("https://remote-tracker.test/y")).toBe(true);
    expect(fs.existsSync(path.join(profile, "filter-cache.json"))).toBe(true);
  });
});
