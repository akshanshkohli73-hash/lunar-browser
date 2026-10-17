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
export class FilterEngine {
  private remote = new Set<string>();
  private core = new Map<string, RuleCategory>();
  constructor() {
    for (const [category, domains] of Object.entries(CORE_RULES))
      for (const domain of domains)
        this.core.set(domain, category as RuleCategory);
  }
  setRemote(domains: string[]) {
    this.remote = new Set(domains);
  }
  decide(
    url: string,
    siteUrl: string,
    resourceType: string,
    settings: ShieldSettings,
  ): RuleCategory | null {
    if (!settings.enabled || resourceType === "mainFrame") return null;
    try {
      const request = new URL(url),
        site = new URL(siteUrl);
      if (
        !["http:", "https:"].includes(request.protocol) ||
        !["http:", "https:"].includes(site.protocol)
      )
        return null;
      if (
        request.hostname === site.hostname ||
        settings.allowlist.some((host) => domainMatches(site.hostname, host))
      )
        return null;
      const labels = request.hostname.toLowerCase().split(".");
      for (let index = 0; index < labels.length - 1; index++) {
        const suffix = labels.slice(index).join(".");
        if (settings.filterLists.includes("lunar-core")) {
          const category = this.core.get(suffix);
          if (category && settings[category]) return category;
        }
        if (
          settings.filterLists.includes("stevenblack") &&
          settings.trackers &&
          this.remote.has(suffix)
        )
          return "trackers";
      }
    } catch {
      /* Malformed request metadata is not a reason to break browsing. */
    }
    return null;
  }
}
