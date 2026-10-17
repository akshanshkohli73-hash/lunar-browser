import { net, type Session } from "electron";
import path from "node:path";
import { z } from "zod";
import { readResponseText } from "../services/response-text";
import { AtomicFile } from "../services/atomic-file";
import {
  FilterEngine,
  CORE_RULES,
  CORE_VERSION,
  parseHostsList,
} from "./filter-engine";
import type { ShieldSettings, ShieldState, ShieldStats } from "../types";

const CACHE = z.object({
  domains: z.array(z.string().max(253)).max(200000),
  updatedAt: z.number().nonnegative(),
});
export class LunarShield {
  private engine = new FilterEngine();
  private cache: AtomicFile<z.infer<typeof CACHE>>;
  private stats: ShieldStats = {
    totalBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    telemetryBlocked: 0,
    cryptominersBlocked: 0,
    socialBlocked: 0,
    popupsBlocked: 0,
  };
  private metadata = { count: 0, updatedAt: 0 };
  private listError: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshing: Promise<ShieldState> | null = null;
  private controller: AbortController | null = null;
  private disposed = false;
  constructor(
    private session: Session,
    profilePath: string,
    private settings: () => ShieldSettings,
    private siteUrl: (webContentsId: number) => string,
    private changed: (state: ShieldState) => void,
  ) {
    this.cache = new AtomicFile(
      path.join(profilePath, "filter-cache.json"),
      CACHE,
      { domains: [], updatedAt: 0 },
      (message) => {
        this.listError = message;
      },
    );
    const cached = this.cache.read();
    this.engine.setRemote(cached.domains);
    this.metadata = {
      count: cached.domains.length,
      updatedAt: cached.updatedAt,
    };
    session.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (details, callback) => {
        const category = this.engine.decide(
          details.url,
          details.webContentsId === undefined
            ? ""
            : this.siteUrl(details.webContentsId),
          details.resourceType,
          this.settings(),
        );
        if (category) {
          const counter = (
            {
              ads: "adsBlocked",
              trackers: "trackersBlocked",
              telemetry: "telemetryBlocked",
              cryptomining: "cryptominersBlocked",
              social: "socialBlocked",
            } as const
          )[category];
          this.stats[counter]++;
          this.stats.totalBlocked++;
          this.scheduleUpdate();
        }
        callback({ cancel: category !== null });
      },
    );
    // Do not masquerade as anti-fingerprinting or remove the user's DNT signal.
  }
  public recordPopup() {
    this.stats.popupsBlocked++;
    this.stats.totalBlocked++;
    this.scheduleUpdate();
  }
  private scheduleUpdate() {
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      this.notify();
    }, 150);
  }
  public notify() {
    if (this.disposed) return;
    this.changed(this.getState());
  }
  public getState(): ShieldState {
    return {
      settings: structuredClone(this.settings()),
      stats: { ...this.stats },
      lists: [
        {
          id: "lunar-core",
          name: `Lunar core · ${CORE_VERSION}`,
          ruleCount: Object.values(CORE_RULES).reduce(
            (sum, rules) => sum + rules.length,
            0,
          ),
          updatedAt: Date.parse(CORE_VERSION),
        },
        {
          id: "stevenblack",
          name: "StevenBlack Unified Hosts",
          ruleCount: this.metadata.count,
          updatedAt: this.metadata.updatedAt || null,
          error:
            this.listError ??
            (!this.metadata.count
              ? "Not downloaded. Refresh lists to fetch this optional source."
              : undefined),
        },
      ],
    };
  }
  public refresh(): Promise<ShieldState> {
    if (this.disposed)
      return Promise.reject(new Error("The filter service is closing."));
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.fetchList().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  private async fetchList(): Promise<ShieldState> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      // Fixed, public, maintained source. No renderer-supplied request destinations.
      const response = await net.fetch(
        "https://api.github.com/repos/StevenBlack/hosts/contents/hosts",
        {
          headers: {
            Accept: "application/vnd.github.raw+json",
            "User-Agent": "Lunar-Browser",
          },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
          redirect: "error",
        },
      );
      if (!response.ok)
        throw new Error(
          `Filter update failed (HTTP ${response.status}). Try again later.`,
        );
      const domains = parseHostsList(
        await readResponseText(response, 8 * 1024 * 1024),
      );
      if (this.disposed) return this.getState();
      const updatedAt = Date.now();
      this.cache.write({ domains, updatedAt });
      this.engine.setRemote(domains);
      this.metadata = { count: domains.length, updatedAt };
      this.listError = undefined;
    } catch (error) {
      if (this.disposed) return this.getState();
      this.listError =
        error instanceof Error
          ? error.message
          : "Filter update failed. Cached rules remain in use.";
    }
    this.notify();
    return this.getState();
  }
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller?.abort();
    if (this.timer) clearTimeout(this.timer);
    this.session.webRequest.onBeforeRequest(null);
  }
}
