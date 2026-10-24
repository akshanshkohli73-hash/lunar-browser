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
  parseNetworkList,
  allowedSite,
  networkRequest,
  httpsUpgrade,
} from "./filter-engine";
import { FILTER_SOURCES } from "./sources";
import type {
  ShieldSettings,
  ShieldState,
  ShieldStats,
  BlockDiagnostic,
} from "../types";
const CACHE = z.object({
  domains: z
    .array(
      z
        .string()
        .max(253)
        .regex(/^[a-z\d.-]+$/u),
    )
    .max(200000),
  updatedAt: z.number().nonnegative(),
});
const PRIVACY_CACHE = z.object({
  text: z.string().max(8 * 1024 * 1024),
  updatedAt: z.number().nonnegative(),
});
const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
export class LunarShield {
  private engine = new FilterEngine();
  private cache: AtomicFile<z.infer<typeof CACHE>>;
  private privacyCache: AtomicFile<z.infer<typeof PRIVACY_CACHE>>;
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
  private privacyMetadata = { count: 0, updatedAt: 0 };
  private errors: Partial<Record<"stevenblack" | "easyprivacy", string>> = {};
  private sites = new Map<
    string,
    {
      blocked: number;
      cookies: number;
      upgrades: number;
      recent: BlockDiagnostic[];
    }
  >();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshing: Promise<ShieldState> | null = null;
  private controller: AbortController | null = null;
  private disposed = false;
  constructor(
    private session: Session,
    profilePath: string,
    private settings: () => ShieldSettings,
    private siteUrl: (id: number) => string,
    private changed: (state: ShieldState) => void,
    private activeSite: () => string = () => "",
  ) {
    this.cache = new AtomicFile(
      path.join(profilePath, "filter-cache.json"),
      CACHE,
      { domains: [], updatedAt: 0 },
      (message) => {
        this.errors.stevenblack = message;
      },
    );
    this.privacyCache = new AtomicFile(
      path.join(profilePath, "privacy-filter-cache.json"),
      PRIVACY_CACHE,
      { text: "", updatedAt: 0 },
      (message) => {
        this.errors.easyprivacy = message;
      },
    );
    const cached = this.cache.read();
    this.engine.setRemote(cached.domains);
    this.metadata = {
      count: cached.domains.length,
      updatedAt: cached.updatedAt,
    };
    const privacy = this.privacyCache.read();
    if (privacy.text) {
      try {
        const supported = parseNetworkList(privacy.text);
        this.engine.setPrivacy(supported.text);
        this.privacyMetadata = {
          count: supported.count,
          updatedAt: privacy.updatedAt,
        };
      } catch {
        this.errors.easyprivacy =
          "Cached network rules are invalid. Refresh to recover.";
      }
    }
    session.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        const site =
            details.webContentsId === undefined
              ? ""
              : this.siteUrl(details.webContentsId),
          settings = this.settings();
        if (
          site &&
          details.resourceType === "mainFrame" &&
          settings.enabled &&
          settings.httpsUpgrades &&
          !allowedSite(details.url, settings)
        ) {
          const target = httpsUpgrade(details.url);
          if (target) {
            this.site(details.url).upgrades++;
            this.scheduleUpdate();
            callback({ redirectURL: target });
            return;
          }
        }
        const decision = this.engine.explain(
          details.url,
          site,
          details.resourceType,
          settings,
        );
        if (decision) {
          const key = (
            {
              ads: "adsBlocked",
              trackers: "trackersBlocked",
              telemetry: "telemetryBlocked",
              cryptomining: "cryptominersBlocked",
              social: "socialBlocked",
            } as const
          )[decision.category];
          this.stats[key]++;
          this.stats.totalBlocked++;
          const state = this.site(site);
          state.blocked++;
          // No paths, queries, cookie values or page contents are retained in diagnostics.
          state.recent = [
            {
              hostname: host(details.url),
              resourceType: details.resourceType,
              category: decision.category,
              source: decision.source,
              rule: decision.rule,
              time: Date.now(),
            },
            ...state.recent,
          ].slice(0, 20);
          this.scheduleUpdate();
        }
        callback({ cancel: decision !== null });
      },
    );
    session.webRequest.onBeforeSendHeaders(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        const requestHeaders = { ...details.requestHeaders };
        if (
          this.restrictCookies(
            details.url,
            details.webContentsId,
            details.resourceType,
          )
        ) {
          const keys = Object.keys(requestHeaders).filter(
            (key) => key.toLowerCase() === "cookie",
          );
          keys.forEach((key) => delete requestHeaders[key]);
          if (keys.length) this.recordCookies(details.webContentsId);
        }
        callback({ requestHeaders });
      },
    );
    session.webRequest.onHeadersReceived(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        if (
          this.restrictCookies(
            details.url,
            details.webContentsId,
            details.resourceType,
          )
        ) {
          const keys = Object.keys(responseHeaders).filter(
            (key) => key.toLowerCase() === "set-cookie",
          );
          keys.forEach((key) => delete responseHeaders[key]);
          if (keys.length) this.recordCookies(details.webContentsId);
        }
        callback({ responseHeaders });
      },
    );
  }
  private site(url: string) {
    const key = host(url);
    if (!this.sites.has(key)) {
      if (this.sites.size >= 500)
        this.sites.delete(this.sites.keys().next().value ?? "");
      this.sites.set(key, { blocked: 0, cookies: 0, upgrades: 0, recent: [] });
    }
    return this.sites.get(key)!;
  }
  private restrictCookies(url: string, id: number | undefined, type: string) {
    const settings = this.settings(),
      source = id === undefined ? "" : this.siteUrl(id);
    return (
      !!source &&
      settings.enabled &&
      settings.blockThirdPartyCookies &&
      type !== "mainFrame" &&
      !allowedSite(source, settings) &&
      networkRequest(url, source, type).isThirdParty
    );
  }
  private recordCookies(id: number | undefined) {
    if (id !== undefined) this.site(this.siteUrl(id)).cookies++;
    this.scheduleUpdate();
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
    if (!this.disposed) this.changed(this.getState());
  }
  public clearSiteDiagnostics(url?: string) {
    if (url) this.sites.delete(host(url));
    else this.sites.clear();
    this.notify();
  }
  public getState(url = this.activeSite()): ShieldState {
    const siteHost = host(url),
      state = this.sites.get(siteHost);
    return {
      settings: structuredClone(this.settings()),
      stats: { ...this.stats },
      site: {
        hostname: siteHost,
        enabled: this.settings().enabled && !allowedSite(url, this.settings()),
        blocked: state?.blocked ?? 0,
        cookies: state?.cookies ?? 0,
        upgrades: state?.upgrades ?? 0,
        recent: structuredClone(state?.recent ?? []),
      },
      lists: [
        {
          id: "lunar-core",
          name: `Lunar core · ${CORE_VERSION}`,
          ruleCount: Object.values(CORE_RULES).reduce(
            (sum, rules) => sum + rules.length,
            0,
          ),
          updatedAt: Date.parse(CORE_VERSION),
          source: "Bundled domain rules → Ghostery ABP network engine",
          license: "Lunar application rules",
        },
        ...(["stevenblack", "easyprivacy"] as const).map((id) => {
          const metadata =
            id === "stevenblack" ? this.metadata : this.privacyMetadata;
          return {
            id,
            name: FILTER_SOURCES[id].name,
            source: FILTER_SOURCES[id].homepage,
            license: FILTER_SOURCES[id].license,
            ruleCount: metadata.count,
            updatedAt: metadata.updatedAt || null,
            error:
              this.errors[id] ??
              (!metadata.count
                ? "Not downloaded. Select this source and refresh to opt in."
                : undefined),
          };
        }),
      ],
    };
  }
  public refresh(): Promise<ShieldState> {
    if (this.disposed)
      return Promise.reject(new Error("The filter service is closing."));
    if (this.refreshing) return this.refreshing;
    const selected = this.settings().filterLists.filter(
      (id): id is "stevenblack" | "easyprivacy" => id !== "lunar-core",
    );
    if (!selected.length)
      return Promise.reject(
        new Error("Select a maintained source before requesting an update."),
      );
    this.refreshing = this.fetchLists(selected).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  private async fetchLists(
    selected: Array<"stevenblack" | "easyprivacy">,
  ): Promise<ShieldState> {
    const controller = new AbortController();
    this.controller = controller;
    for (const id of selected) {
      try {
        const texts: string[] = [];
        for (const url of FILTER_SOURCES[id].urls) {
          const response = await net.fetch(url, {
            headers: {
              Accept: "application/vnd.github.raw+json",
              "User-Agent": "Lunar-Browser",
            },
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30000),
            ]),
            redirect: "error",
            credentials: "omit",
            referrerPolicy: "no-referrer",
          });
          if (!response.ok)
            throw new Error(
              `Filter update failed (HTTP ${response.status}). Cached rules remain in use.`,
            );
          const text = await readResponseText(
            response,
            2 * 1024 * 1024 * (id === "stevenblack" ? 4 : 1),
          );
          if (id === "easyprivacy") parseNetworkList(text); // Reject a failed individual file, not just the combined bundle.
          texts.push(text);
        }
        if (this.disposed) return this.getState();
        const updatedAt = Date.now();
        if (id === "stevenblack") {
          const domains = parseHostsList(texts.join("\n"));
          // Compile/validate before committing either the cache or active engine.
          const candidate = new FilterEngine();
          candidate.setRemote(domains);
          this.cache.write({ domains, updatedAt });
          this.engine.setRemote(domains);
          this.metadata = { count: domains.length, updatedAt };
        } else {
          const supported = parseNetworkList(texts.join("\n"));
          this.privacyCache.write({
            text:
              "! EasyPrivacy network subset — The EasyList authors (https://easylist.to/)\n! Source: https://github.com/easylist/easylist/tree/master/easyprivacy\n! License: GPL-3.0-or-later OR CC-BY-SA-3.0-or-later; network-only adaptation.\n" +
              supported.text,
            updatedAt,
          });
          this.engine.setPrivacy(supported.text);
          this.privacyMetadata = { count: supported.count, updatedAt };
        }
        delete this.errors[id];
      } catch (error) {
        if (!this.disposed)
          this.errors[id] =
            error instanceof Error
              ? error.message
              : "Update failed. Cached rules remain in use.";
      }
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
    this.session.webRequest.onBeforeSendHeaders(null);
    this.session.webRequest.onHeadersReceived(null);
  }
}
