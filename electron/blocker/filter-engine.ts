import {
  FiltersEngine,
  NetworkFilter,
  Request,
  type RequestType,
} from "@ghostery/adblocker";
import { isIP } from "node:net";
import type { ShieldSettings } from "../types";
export type RuleCategory =
  "ads" | "trackers" | "telemetry" | "cryptomining" | "social";
export const CORE_VERSION = "2026-10-15";
/** Conservative bootstrap list. Network domain rules only; no cosmetic or fingerprinting claims. */
export const CORE_RULES: Record<RuleCategory, string[]> = {
  ads: [
    "ads.lunar-shield.test",
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adnxs.com",
    "amazon-adsystem.com",
    "taboola.com",
    "outbrain.com",
    "popads.net",
  ],
  trackers: [
    "google-analytics.com",
    "segment.io",
    "mixpanel.com",
    "hotjar.com",
    "clarity.ms",
    "quantserve.com",
    "scorecardresearch.com",
    "fullstory.com",
  ],
  telemetry: [
    "sentry.io",
    "bugsnag.com",
    "logrocket.com",
    "datadoghq.com",
    "newrelic.com",
  ],
  cryptomining: [
    "coin-hive.com",
    "crypto-loot.com",
    "authedmine.com",
    "minero.cc",
  ],
  social: ["connect.facebook.net", "platform.twitter.com", "tr.snapchat.com"],
};
export function domainMatches(host: string, rule: string): boolean {
  return host === rule || host.endsWith(`.${rule}`);
}
export function parseHostsList(text: string): string[] {
  if (text.length > 8 * 1024 * 1024)
    throw new Error("Filter list exceeds the 8 MB safety limit.");
  const domains = new Set<string>();
  for (const line of text.split(/\r?\n/u)) {
    const entry = line.split("#")[0].trim();
    if (!entry) continue;
    const parts = entry.split(/\s+/u);
    const hosts = ["0.0.0.0", "127.0.0.1", "::"].includes(parts[0])
      ? parts.slice(1)
      : parts.length === 1
        ? parts
        : [];
    for (const raw of hosts) {
      const host = raw.toLowerCase();
      if (
        host.length <= 253 &&
        /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/u.test(host) &&
        !host.endsWith(".local") &&
        !host.endsWith(".localhost")
      )
        domains.add(host);
    }
  }
  if (!domains.size)
    throw new Error("The filter source did not contain valid host rules.");
  return [...domains].slice(0, 200000);
}

const parserOptions = {
  debug: true,
  loadNetworkFilters: true,
  loadCosmeticFilters: false,
  loadExtendedSelectors: false,
  enableHtmlFiltering: false,
  loadCSPFilters: false,
  loadGenericCosmeticsFilters: false,
};
const types = new Set([
  "mainFrame",
  "subFrame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xhr",
  "fetch",
  "ping",
  "cspReport",
  "media",
  "webSocket",
  "other",
]);
export function networkRequest(url: string, sourceUrl: string, type: string) {
  return Request.fromRawDetails({
    url,
    sourceUrl,
    type: (types.has(type) ? type : "other") as RequestType,
  });
}
export function allowedSite(site: string, settings: ShieldSettings): boolean {
  try {
    const host = new URL(site).hostname;
    return settings.allowlist.some((entry) => domainMatches(host, entry));
  } catch {
    return false;
  }
}
export function httpsUpgrade(input: string): string | null {
  try {
    const url = new URL(input);
    if (
      url.protocol !== "http:" ||
      url.port ||
      url.username ||
      url.password ||
      isIP(url.hostname.replace(/^\[|\]$/gu, "")) ||
      !url.hostname.includes(".") ||
      url.hostname.endsWith(".home.arpa") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/iu.test(
        url.hostname,
      )
    )
      return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}
export function parseNetworkList(text: string): {
  text: string;
  count: number;
} {
  if (text.length > 8 * 1024 * 1024 || /^\s*[<{]/u.test(text))
    throw new Error("Invalid or oversized network filter list.");
  const lines = text.split(/\r?\n/u).filter((line) => {
    const filter = NetworkFilter.parse(line.trim());
    return (
      filter !== null &&
      !filter.isCSP() &&
      !filter.isRedirect() &&
      !filter.isRedirectRule() &&
      !filter.isReplace() &&
      !filter.isRemoveParam() &&
      !filter.isHtmlFilteringRule() &&
      !filter.isElemHide() &&
      !filter.isGenericHide() &&
      !filter.isSpecificHide()
    );
  });
  const engine = FiltersEngine.parse(lines.join("\n"), parserOptions);
  const count = engine.getFilters().networkFilters.length;
  if (!count || lines.length > 200000)
    throw new Error(
      "No supported network rules found, or the rule limit was exceeded.",
    );
  return { text: lines.join("\n"), count };
}
export interface FilterDecision {
  category: RuleCategory;
  source: string;
  rule: string;
}
export class FilterEngine {
  private remote = FiltersEngine.empty(parserOptions);
  private privacy = FiltersEngine.empty(parserOptions);
  private core = new Map<RuleCategory, FiltersEngine>();
  constructor() {
    for (const [category, domains] of Object.entries(CORE_RULES))
      this.core.set(
        category as RuleCategory,
        FiltersEngine.parse(
          domains.map((domain) => `||${domain}^`).join("\n"),
          parserOptions,
        ),
      );
  }
  setRemote(domains: string[]) {
    this.remote = FiltersEngine.parse(
      domains.map((domain) => `||${domain}^`).join("\n"),
      parserOptions,
    );
  }
  setPrivacy(text: string) {
    this.privacy = FiltersEngine.parse(text, parserOptions);
  }
  explain(
    url: string,
    siteUrl: string,
    resourceType: string,
    settings: ShieldSettings,
  ): FilterDecision | null {
    if (
      !settings.enabled ||
      resourceType === "mainFrame" ||
      allowedSite(siteUrl, settings)
    )
      return null;
    try {
      if (
        !["http:", "https:", "ws:", "wss:"].includes(new URL(url).protocol) ||
        !["http:", "https:"].includes(new URL(siteUrl).protocol)
      )
        return null;
      const request = networkRequest(url, siteUrl, resourceType);
      if (settings.mode === "balanced" && !request.isThirdParty) return null;
      const candidates: Array<[RuleCategory, string, FiltersEngine]> = [];
      if (settings.filterLists.includes("lunar-core"))
        for (const [category, engine] of this.core)
          if (settings[category])
            candidates.push([category, "lunar-core", engine]);
      if (settings.filterLists.includes("stevenblack") && settings.trackers)
        candidates.push(["trackers", "stevenblack", this.remote]);
      if (settings.filterLists.includes("easyprivacy") && settings.trackers)
        candidates.push(["trackers", "easyprivacy", this.privacy]);
      // Respect an explicit network exception in any enabled source before blocking.
      const results = candidates.map(([category, source, engine]) => ({
        category,
        source,
        result: engine.match(request),
      }));
      if (results.some(({ result }) => result.exception)) return null;
      const found = results.find(({ result }) => result.match);
      return found
        ? {
            category: found.category,
            source: found.source,
            rule:
              found.result.filter?.toString().slice(0, 300) ??
              "Matching network filter",
          }
        : null;
    } catch {
      return null;
    }
  }
  decide(
    url: string,
    siteUrl: string,
    resourceType: string,
    settings: ShieldSettings,
  ): RuleCategory | null {
    return this.explain(url, siteUrl, resourceType, settings)?.category ?? null;
  }
}
