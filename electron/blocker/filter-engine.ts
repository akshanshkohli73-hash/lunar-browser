import {
  FiltersEngine,
  NetworkFilter,
  Request,
  type RequestType,
} from "@ghostery/adblocker";
import { isIP } from "node:net";
import type { ShieldSettings } from "../types";
import type {
  ShieldConfig,
  SitePolicy,
  SourceCategory,
  SourceFormat,
} from "../../shared/shield";
import { youtubeEssential, youtubeHost } from "../../shared/shield";

export const CORE_VERSION = "2026-10-15";
export const CORE_RULES: Record<
  Exclude<SourceCategory, "malware" | "custom" | "other">,
  string[]
> = {
  ads: [
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adservice.google.com",
    "adsystem.com",
    "adnxs.com",
    "criteo.com",
    "pubmatic.com",
    "rubiconproject.com",
    "openx.net",
    "adsrvr.org",
    "taboola.com",
    "outbrain.com",
    "popads.net",
    "amazon-adsystem.com",
    "advertising.com",
    "ads.lunar-shield.test",
  ],
  trackers: [
    "google-analytics.com",
    "analytics.google.com",
    "hotjar.com",
    "segment.io",
    "segment.com",
    "mixpanel.com",
    "amplitude.com",
    "scorecardresearch.com",
    "quantserve.com",
    "mouseflow.com",
    "fullstory.com",
    "clarity.ms",
    "tracking.lunar-shield.test",
  ],
  telemetry: [
    "sentry.io",
    "bugsnag.com",
    "logrocket.com",
    "datadoghq.com",
    "telemetry.microsoft.com",
    "vortex.data.microsoft.com",
    "watson.telemetry.microsoft.com",
    "telemetry.mozilla.org",
    "incoming.telemetry.mozilla.org",
    "browser.events.data.msn.com",
  ],
  cryptomining: [
    "coinhive.com",
    "coin-hive.com",
    "crypto-loot.com",
    "authedmine.com",
    "cryptoloot.pro",
    "webminepool.com",
    "minero.cc",
    "jsecoin.com",
  ],
  social: [
    "tr.snapchat.com",
    "connect.facebook.net",
    "platform.twitter.com",
    "platform.linkedin.com",
    "static.ads-twitter.com",
    "analytics.tiktok.com",
  ],
};
export interface RequestInfo {
  url: string;
  resourceType?: string;
  referrer?: string;
  youtube?: boolean;
}
export interface RuleDecision {
  blocked: boolean;
  excepted: boolean;
  category: SourceCategory;
  source: string;
  rule: string;
  thirdParty: boolean;
  reason?: string;
}
export const ENGINE_OPTIONS = {
  loadCosmeticFilters: false,
  loadExtendedSelectors: false,
  loadGenericCosmeticsFilters: false,
  loadCSPFilters: false,
  loadPreprocessors: false,
  enableHtmlFiltering: false,
  enableCompression: true,
  enableInMemoryCache: false,
  debug: true,
};
export const FILTER_LIMIT_BYTES = 8 * 1024 * 1024;
export function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
function host(value: string): string | null {
  const normalized = value.toLowerCase().replace(/\.$/u, "");
  if (
    normalized.length > 253 ||
    !normalized.includes(".") ||
    /[^a-z\d.-]/u.test(normalized) ||
    normalized
      .split(".")
      .some(
        (part) =>
          !part ||
          part.length > 63 ||
          part.startsWith("-") ||
          part.endsWith("-"),
      ) ||
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".localhost") ||
    /^\d+(?:\.\d+){3}$/u.test(normalized)
  )
    return null;
  return normalized;
}
export function inspectHostsList(text: string): {
  domains: string[];
  rejected: number;
  ignored: number;
} {
  if (Buffer.byteLength(text) > FILTER_LIMIT_BYTES)
    throw new Error("The hosts filter exceeds the 8 MiB safety limit.");
  const domains = new Set<string>();
  let rejected = 0,
    ignored = 0;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*/u, "").trim();
    if (!line) {
      ignored++;
      continue;
    }
    const parts = line.split(/\s+/u),
      candidates = /^(?:0\.0\.0\.0|127\.0\.0\.1|::|::1)$/u.test(parts[0])
        ? parts.slice(1)
        : parts.length === 1
          ? parts
          : [];
    if (!candidates.length) rejected++;
    for (const candidate of candidates) {
      const domain = host(candidate);
      if (domain) domains.add(domain);
      else rejected++;
    }
    if (domains.size > 200_000)
      throw new Error("The hosts filter contains too many domains.");
  }
  if (!domains.size)
    throw new Error("The hosts filter did not contain any supported domains.");
  return { domains: [...domains], rejected, ignored };
}
export function parseHostsList(text: string): string[] {
  return inspectHostsList(text).domains;
}
const unsupported =
  /(?:##|#@#|#\?#|#\$#|\$\$|##\^|\$(?:[^\n]*,)?(?:csp|redirect(?:-rule)?|replace|removeparam|permissions|urltransform|uritransform|header|removeheader)(?:=|,|$))/iu;
export function validateNetworkRule(
  line: string,
  allowRegex = false,
): string | null {
  if (
    Buffer.byteLength(line) > 1024 ||
    [...line].some((character) => character.charCodeAt(0) < 32)
  )
    return "Use one network rule of at most 1,024 characters.";
  if (unsupported.test(line))
    return "Cosmetic filters, scriptlets, response rewriting and redirects are not supported.";
  if (/\s/u.test(line))
    return "Network rules cannot contain literal whitespace; percent-encode URL spaces.";
  const filter = NetworkFilter.parse(line);
  if (
    !filter ||
    filter.isBadFilter() ||
    (!allowRegex && filter.isFullRegex()) ||
    filter.isCSP() ||
    filter.isReplace() ||
    filter.isRedirectRule() ||
    filter.isHtmlFilteringRule() ||
    filter.isElemHide() ||
    filter.isGenericHide() ||
    filter.isSpecificHide() ||
    filter.redirect !== undefined ||
    filter.removeparam !== undefined
  )
    return "Use a supported ABP network blocking or @@ exception rule; regular expressions and executable/response modifiers are not supported.";
  return null;
}
export interface ParsedNetworkList {
  rules: string[];
  rejected: number;
  ignored: number;
}
export function inspectNetworkList(
  text: string,
  allowRegex = false,
): ParsedNetworkList {
  if (/^\s*[<{]/u.test(text))
    throw new Error("Invalid network filter list response.");
  if (Buffer.byteLength(text) > FILTER_LIMIT_BYTES)
    throw new Error("The network filter exceeds the 8 MiB safety limit.");
  const rules = new Set<string>();
  let rejected = 0,
    ignored = 0;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith("!") || line.startsWith("[")) {
      ignored++;
      continue;
    }
    if (validateNetworkRule(line, allowRegex)) {
      rejected++;
      continue;
    }
    rules.add(line);
    if (rules.size > 200_000)
      throw new Error("The network filter contains too many rules.");
  }
  if (!rules.size) throw new Error("No supported network rules were found.");
  return { rules: [...rules], rejected, ignored };
}
export function parseNetworkList(text: string): {
  text: string;
  count: number;
} {
  const parsed = inspectNetworkList(text, true);
  return { text: parsed.rules.join("\n"), count: parsed.rules.length };
}
const TYPES = new Set([
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
export function networkRequest(
  url: string,
  sourceUrl: string,
  type: string,
): Request {
  return Request.fromRawDetails({
    url,
    sourceUrl,
    type: (TYPES.has(type) ? type : "other") as RequestType,
  });
}
export function exactOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}
/** Legacy hostname allowlist is now exact-host; it never grants subdomains implicitly. */
export function allowedSite(siteURL: string, prefs: ShieldSettings): boolean {
  try {
    return prefs.allowlist.includes(new URL(siteURL).hostname);
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
export function effectivePreferences(
  prefs: ShieldSettings,
  config: ShieldConfig,
  siteURL: string,
): ShieldSettings {
  const origin = exactOrigin(siteURL),
    policy = config.sites.find((site) => site.origin === origin);
  return {
    ...prefs,
    ...policy,
    enabled:
      prefs.enabled &&
      policy?.enabled !== false &&
      !allowedSite(siteURL, prefs),
  };
}
interface IndexedSource {
  engine: FiltersEngine;
  category: SourceCategory;
}
const emptyConfig = (): ShieldConfig => ({
  version: 2,
  sites: [],
  rules: [],
  subscriptions: [],
  permissions: [],
  youtube: { enabled: true },
});
export class FilterEngine {
  private core = new Map<SourceCategory, FiltersEngine>();
  private remote = new Map<string, IndexedSource>();
  private custom: FiltersEngine | null = null;
  private config = emptyConfig();
  private policies = new Map<string, SitePolicy>();
  private allowances = new Map<string, Set<string>>();
  private version = 0;
  private cache = new Map<string, RuleDecision | null>();
  private hits = 0;
  private misses = 0;
  readonly capacity = 4096;
  constructor() {
    for (const [category, domains] of Object.entries(CORE_RULES))
      this.core.set(
        category as SourceCategory,
        FiltersEngine.parse(
          domains.map((domain) => `||${domain}^`).join("\n"),
          ENGINE_OPTIONS,
        ),
      );
  }
  clearCache() {
    this.version++;
    this.cache.clear();
  }
  configure(config: ShieldConfig, compiledCustom?: Uint8Array | null) {
    this.config = structuredClone(config);
    this.policies = new Map(config.sites.map((site) => [site.origin, site]));
    this.allowances = new Map(
      config.sites.map((site) => [
        site.origin,
        new Set(
          (site.allowedRequests || []).map(
            (allow) => `${allow.hostname}|${allow.resourceType}`,
          ),
        ),
      ]),
    );
    const text = config.rules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.text)
      .join("\n");
    this.custom = compiledCustom
      ? FiltersEngine.deserialize(compiledCustom)
      : text
        ? FiltersEngine.parse(text, ENGINE_OPTIONS)
        : null;
    this.clearCache();
  }
  preferences(prefs: ShieldSettings, siteURL: string): ShieldSettings {
    const policy = this.policies.get(exactOrigin(siteURL) || "");
    return {
      ...prefs,
      enabled:
        prefs.enabled &&
        policy?.enabled !== false &&
        !allowedSite(siteURL, prefs),
      ads: policy?.ads ?? prefs.ads,
      trackers: policy?.trackers ?? prefs.trackers,
      malware: policy?.malware ?? prefs.malware,
      mode: policy?.mode ?? prefs.mode,
      blockThirdPartyCookies:
        policy?.blockThirdPartyCookies ?? prefs.blockThirdPartyCookies,
    };
  }
  cacheInfo() {
    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      capacity: this.capacity,
    };
  }
  prepareSource(id: string, category: SourceCategory, data: Uint8Array) {
    const engine = FiltersEngine.deserialize(data);
    return () => {
      this.remote.set(id, { category, engine });
      this.clearCache();
    };
  }
  setCompiled(id: string, category: SourceCategory, data: Uint8Array) {
    this.prepareSource(id, category, data)();
  }
  removeRemote(id: string) {
    this.remote.delete(id);
    this.clearCache();
  }
  setRemote(domains: string[]) {
    this.remote.set("stevenblack", {
      category: "other",
      engine: FiltersEngine.parse(
        domains.map((domain) => `||${domain}^`).join("\n"),
        ENGINE_OPTIONS,
      ),
    });
    this.clearCache();
  }
  setPrivacy(text: string) {
    this.remote.set("easyprivacy", {
      category: "trackers",
      engine: FiltersEngine.parse(text, ENGINE_OPTIONS),
    });
    this.clearCache();
  }
  private enabled(category: SourceCategory, prefs: ShieldSettings): boolean {
    switch (category) {
      case "ads":
        return prefs.ads;
      case "trackers":
        return prefs.trackers;
      case "telemetry":
        return prefs.telemetry;
      case "social":
        return prefs.social;
      case "cryptomining":
        return prefs.cryptomining;
      case "malware":
        return prefs.malware;
      case "other":
        return prefs.ads || prefs.trackers;
      default:
        return true;
    }
  }
  explain(
    url: string,
    siteURL: string,
    resourceType: string,
    prefs: ShieldSettings,
    youtube = youtubeHost(siteURL),
  ): RuleDecision | null {
    const policy = this.policies.get(exactOrigin(siteURL) || "");
    const effective = this.preferences(prefs, siteURL);
    if (
      !effective.enabled ||
      !exactOrigin(siteURL) ||
      !/^(?:https?|wss?):\/\//u.test(url)
    )
      return null;
    // URLs live only in this bounded in-memory cache, never in persistence or diagnostics.
    const key = `${this.version}|${resourceType}|${exactOrigin(siteURL)}|${youtube}|${JSON.stringify(effective)}|${url}`;
    if (key.length <= 8192 && this.cache.has(key)) {
      this.hits++;
      return this.cache.get(key) || null;
    }
    this.misses++;
    let decision: RuleDecision | null;
    try {
      decision = this.match(
        { url, resourceType, youtube },
        siteURL,
        effective,
        policy,
      );
    } catch {
      decision = null;
    }
    if (key.length <= 8192) {
      if (this.cache.size >= this.capacity)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, decision);
    }
    return decision;
  }
  private match(
    details: RequestInfo,
    siteURL: string,
    prefs: ShieldSettings,
    policy?: SitePolicy,
  ): RuleDecision | null {
    const request = networkRequest(
        details.url,
        siteURL,
        details.resourceType || "other",
      ),
      yt = details.youtube ?? youtubeHost(siteURL);
    const exception = (
      source: string,
      rule: string,
      reason?: string,
    ): RuleDecision => ({
      blocked: false,
      excepted: true,
      category: "other",
      source,
      rule,
      thirdParty: request.isThirdParty,
      reason,
    });
    const allowances = policy ? this.allowances.get(policy.origin) : undefined;
    if (
      allowances?.has(`${request.hostname}|*`) ||
      allowances?.has(`${request.hostname}|${details.resourceType}`)
    )
      return exception(
        "site-exception",
        request.hostname,
        "Exact site and request host/resource allowance",
      );
    // Explicit user rules are evaluated before the automatic compatibility policy.
    // match() only looks for exceptions after a block within the same engine.
    // Query its public indexed exception bucket so an exception-only source also
    // overrides a block in another enabled source (no full rule scan).
    const customException = this.custom?.exceptions.match(request);
    if (customException)
      return {
        ...exception("custom", customException.toString()),
        category: "custom",
      };
    const custom = this.custom?.match(request);
    if (custom?.match)
      return {
        blocked: true,
        excepted: false,
        category: "custom",
        source: "custom",
        rule: custom.filter?.toString() || "Custom blocking rule",
        thirdParty: request.isThirdParty,
      };
    const candidates: RuleDecision[] = [];
    for (const id of prefs.filterLists) {
      const source = this.remote.get(id);
      if (!source || !this.enabled(source.category, prefs)) continue;
      const allow = source.engine.exceptions.match(request);
      if (allow)
        return exception(
          id,
          allow.toString(),
          "Enabled subscription exception",
        );
      const match = source.engine.match(request);
      if (match.match)
        candidates.push({
          blocked: true,
          excepted: false,
          category: source.category,
          source: id,
          rule: match.filter?.toString() || "Network filter",
          thirdParty: request.isThirdParty,
        });
    }
    // Known-malicious domains may block top-level navigation, unlike ordinary ads.
    const threat = candidates.find(
      (candidate) => candidate.category === "malware",
    );
    if (threat) return threat;
    if (details.resourceType === "mainFrame") return null;
    if (
      yt &&
      (!this.config.youtube.enabled ||
        youtubeEssential(details.url, details.resourceType || "other") ||
        !request.isThirdParty)
    )
      return null;
    if (!yt && prefs.mode === "balanced" && !request.isThirdParty) return null;
    if (prefs.filterLists.includes("lunar-core"))
      for (const [category, engine] of this.core) {
        if (!this.enabled(category, prefs)) continue;
        const result = engine.match(request);
        if (result.match)
          return {
            blocked: true,
            excepted: false,
            category,
            source: "lunar-core",
            rule: result.filter?.toString() || "Built-in domain rule",
            thirdParty: request.isThirdParty,
          };
      }
    return candidates[0] || null;
  }
  decide(
    url: string,
    siteURL: string,
    resourceType: string,
    prefs: ShieldSettings,
  ): SourceCategory | null {
    const decision = this.explain(url, siteURL, resourceType, prefs);
    return decision?.blocked ? decision.category : null;
  }
}
export function compileSource(text: string, format: SourceFormat) {
  const hosts = format === "hosts" ? inspectHostsList(text) : null;
  const inspected = hosts
    ? {
        rules: hosts.domains.map((domain) => `||${domain}^`),
        rejected: hosts.rejected,
        ignored: hosts.ignored,
      }
    : inspectNetworkList(text);
  const engine = FiltersEngine.parse(
    inspected.rules.join("\n"),
    ENGINE_OPTIONS,
  );
  return {
    bytes: engine.serialize(),
    rules: inspected.rules.length,
    rejected: inspected.rejected,
    ignored: inspected.ignored,
  };
}
