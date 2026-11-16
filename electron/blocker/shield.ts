import type {
  Session,
  OnBeforeRequestListenerDetails,
  OnBeforeSendHeadersListenerDetails,
  OnHeadersReceivedListenerDetails,
} from "electron";
import path from "node:path";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_SHIELD_CONFIG,
  EMPTY_COUNTERS,
  shieldConfigSchema,
  sitePolicyPatchSchema,
  customRuleInputSchema,
  subscriptionInputSchema,
  originSchema,
  permissionKeySchema,
  permissionModeSchema,
  youtubeHost,
  youtubeEssential,
  type ShieldConfig,
  type SitePolicyPatch,
  type CustomRuleInput,
  type ProtectionCounters,
  type ProtectionDiagnostic,
  type CompatibilitySignal,
  type PermissionKey,
  type PermissionMode,
} from "../../shared/shield";
import type { ShieldSettings, ShieldState, ShieldStats } from "../types";
import {
  FilterEngine,
  CORE_RULES,
  CORE_VERSION,
  exactOrigin,
  networkRequest,
  httpsUpgrade,
  validateNetworkRule,
  type RuleDecision,
} from "./filter-engine";
import { ShieldProfileFile } from "./profile-file";
import { ProtectionStatistics, counterCategory } from "./statistics";
import { ShieldSubscriptions } from "./subscriptions";
import { compileInWorker, type FilterCompiler } from "./compiler";
import { trustedSubscriptionURL } from "./sources";

const FILTER = { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] };
const owners = new WeakMap<Session, LunarShield>();
const hostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
interface SiteActivity {
  generation: number;
  counters: ProtectionCounters;
  recent: ProtectionDiagnostic[];
}
interface Pending {
  site: string;
  hostname: string;
  type: string;
  youtube: boolean;
  essential: boolean;
  siteGeneration: number;
  time: number;
  decision: RuleDecision | null;
  thirdParty: boolean;
}
interface Attachment {
  session: Session;
  siteUrl: (id: number) => string;
  pending: Map<number, Pending>;
  finished: Set<number>;
}
interface ShieldDependencies {
  compile?: FilterCompiler;
  clock?: () => number;
}

/** One listener owner per session. All tab/window requests share the indexed engine,
 * while request IDs are deduplicated separately for each attached session.
 */
export class LunarShield {
  private engine = new FilterEngine();
  private configFile: ShieldProfileFile<ShieldConfig>;
  private config: ShieldConfig;
  private statistics: ProtectionStatistics;
  private subscriptions: ShieldSubscriptions;
  private attachments = new Map<Session, Attachment>();
  private sites = new Map<string, SiteActivity>();
  private siteGeneration = 0;
  private compatibility: CompatibilitySignal[] = [];
  private youtubeRecent: ProtectionDiagnostic[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private disposal: Promise<void> | null = null;
  private lifecycle = new AbortController();
  private clearing = false;
  private clearingHistory: Promise<ShieldState> | null = null;
  private mutations: Promise<unknown> = Promise.resolve();
  private refreshing = new Map<string, Promise<ShieldState>>();
  private compiledCustom: Uint8Array | null = null;
  private compile: FilterCompiler;
  private clock: () => number;
  private stats: ShieldStats = {
    totalBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    telemetryBlocked: 0,
    cryptominersBlocked: 0,
    socialBlocked: 0,
    popupsBlocked: 0,
  };
  private persistenceError?: string;
  readonly ready: Promise<void>;
  constructor(
    session: Session,
    profilePath: string,
    private settings: () => ShieldSettings,
    siteUrl: (id: number) => string,
    private changed: (state: ShieldState) => void,
    private activeSite: () => string = () => "",
    dependencies: ShieldDependencies = {},
  ) {
    if (owners.has(session))
      throw new Error("A Shield owner is already attached to this session.");
    this.compile = dependencies.compile || compileInWorker;
    this.clock = dependencies.clock || Date.now;
    this.configFile = new ShieldProfileFile(
      path.join(profilePath, "shield-config.json"),
      shieldConfigSchema,
      DEFAULT_SHIELD_CONFIG,
      (message) => {
        this.persistenceError = message;
      },
    );
    this.config = this.configFile.read();
    this.statistics = new ProtectionStatistics(profilePath, this.clock);
    this.engine.configure({ ...this.config, rules: [] });
    this.subscriptions = new ShieldSubscriptions(
      profilePath,
      this.engine,
      () => this.scheduleUpdate(),
      this.compile,
      this.clock,
    );
    this.subscriptions.configure(this.config.subscriptions);
    this.attachSession(session, siteUrl);
    this.ready = this.initialize();
  }
  private async initialize() {
    try {
      const text = this.ruleText(this.config);
      if (text) {
        this.compiledCustom = (
          await this.compile(text, "abp", this.lifecycle.signal)
        ).bytes;
        if (!this.disposed)
          this.engine.configure(this.config, this.compiledCustom);
      }
      await this.subscriptions.migrateLegacy();
    } catch (error) {
      this.persistenceError =
        error instanceof Error
          ? error.message
          : "Some saved rules could not be loaded. Bundled protection is available.";
    }
  }
  /** Invoked after shell startup or an explicit source enable. Only stale enabled
   * sources are checked; fresh compiled caches require no launch-time download.
   */
  async updateDueLists() {
    await this.ready;
    const due = this.subscriptions.due(this.settings().filterLists);
    if (due.length && !this.disposed) await this.subscriptions.update(due);
  }
  public attachSession(session: Session, siteUrl: (id: number) => string) {
    if (this.disposed) throw new Error("The filter service is closing.");
    if (owners.has(session))
      throw new Error("A Shield owner is already attached to this session.");
    const attachment: Attachment = {
      session,
      siteUrl,
      pending: new Map(),
      finished: new Set(),
    };
    this.attachments.set(session, attachment);
    owners.set(session, this);
    session.webRequest.onBeforeRequest(FILTER, (details, callback) => {
      let response: { cancel?: boolean; redirectURL?: string } = {
        cancel: false,
      };
      try {
        response = this.before(attachment, details);
      } catch {
        /* Fail open on an unexpected matcher failure; never hang a request callback. */
      }
      callback(response);
    });
    session.webRequest.onBeforeSendHeaders(FILTER, (details, callback) => {
      let requestHeaders = { ...details.requestHeaders };
      try {
        if (this.restrictCookies(attachment, details))
          for (const key of Object.keys(requestHeaders))
            if (key.toLowerCase() === "cookie") {
              delete requestHeaders[key];
              this.recordCookie(attachment, details);
            }
      } catch {
        requestHeaders = { ...details.requestHeaders };
      }
      callback({ requestHeaders });
    });
    session.webRequest.onHeadersReceived(FILTER, (details, callback) => {
      let responseHeaders = { ...details.responseHeaders };
      try {
        if (this.restrictCookies(attachment, details))
          for (const key of Object.keys(responseHeaders))
            if (key.toLowerCase() === "set-cookie") {
              delete responseHeaders[key];
              this.recordCookie(attachment, details);
            }
      } catch {
        responseHeaders = { ...details.responseHeaders };
      }
      callback({ responseHeaders });
    });
    session.webRequest.onCompleted(FILTER, (details) =>
      this.terminal(attachment, details.id),
    );
    session.webRequest.onErrorOccurred(FILTER, (details) =>
      this.terminal(attachment, details.id, details.error),
    );
  }
  public detachSession(session: Session) {
    if (!this.attachments.has(session)) return;
    session.webRequest.onBeforeRequest(null);
    session.webRequest.onBeforeSendHeaders(null);
    session.webRequest.onHeadersReceived(null);
    session.webRequest.onCompleted(null);
    session.webRequest.onErrorOccurred(null);
    this.attachments.delete(session);
    if (owners.get(session) === this) owners.delete(session);
  }
  private context(
    attachment: Attachment,
    details: Pick<
      OnBeforeRequestListenerDetails,
      "url" | "resourceType" | "webContentsId" | "frame" | "initiatorOrigin"
    >,
  ) {
    const owner =
      details.webContentsId === undefined
        ? ""
        : attachment.siteUrl(details.webContentsId);
    // Browser/extension/background traffic must not impersonate an owned tab.
    if (!owner) return null;
    let top = "",
      frame = "";
    try {
      top = details.frame?.top?.url || "";
      frame = details.frame?.url || "";
    } catch {
      /* The requesting frame may already have been destroyed. */
    }
    const site = exactOrigin(
      details.resourceType === "mainFrame" ? details.url : top || owner,
    );
    if (!site) return null;
    const youtube =
      youtubeHost(site) ||
      youtubeHost(frame) ||
      youtubeHost(details.initiatorOrigin || "") ||
      (details.resourceType === "subFrame" && youtubeHost(details.url));
    return { site, youtube };
  }
  private before(
    attachment: Attachment,
    details: OnBeforeRequestListenerDetails,
  ) {
    const context = this.context(attachment, details);
    if (!context) return { cancel: false };
    const prefs = this.settings(),
      effective = this.engine.preferences(prefs, context.site);
    const decision = this.engine.explain(
      details.url,
      context.site,
      details.resourceType,
      prefs,
      context.youtube,
    );
    // Clearing history must not make a late redirect look like a new request.
    // Keep only bounded IDs (no URL/origin data), including requests that first
    // arrive while the clear transaction is writing its primary/recovery copies.
    if (this.clearing) this.markFinished(attachment, details.id);
    if (!this.clearing && !attachment.finished.has(details.id)) {
      let request = attachment.pending.get(details.id);
      if (!request) {
        if (attachment.pending.size >= 4096) {
          const evicted = attachment.pending.keys().next().value!;
          attachment.pending.delete(evicted);
          this.markFinished(attachment, evicted);
        }
        request = {
          ...context,
          hostname: "",
          type: details.resourceType,
          siteGeneration: this.site(context.site).generation,
          time: this.clock(),
          decision: null,
          thirdParty: false,
          essential: false,
        };
        attachment.pending.set(details.id, request);
        this.statistics.evaluate(request.time, request.youtube);
        this.site(context.site).counters.evaluated++;
      }
      // Redirects retain one evaluated request ID; terminal attribution is to its last target.
      if (request.site !== context.site) {
        this.site(request.site).counters.evaluated = Math.max(
          0,
          this.site(request.site).counters.evaluated - 1,
        );
        this.site(context.site).counters.evaluated++;
        request.siteGeneration = this.site(context.site).generation;
      }
      if (context.youtube && !request.youtube) {
        this.statistics.recognizeYoutube(request.time);
        request.youtube = true;
      }
      Object.assign(request, {
        site: context.site,
        hostname: hostname(details.url),
        type: details.resourceType,
        decision,
        thirdParty: decision?.thirdParty || false,
        essential:
          context.youtube &&
          youtubeEssential(details.url, details.resourceType),
      });
      this.scheduleUpdate();
    }
    if (decision?.blocked) return { cancel: true };
    if (
      effective.enabled &&
      effective.httpsUpgrades &&
      details.resourceType === "mainFrame"
    ) {
      const target = httpsUpgrade(details.url);
      if (target) {
        if (!this.clearing) {
          this.site(context.site).counters.upgrades++;
          this.statistics.intervention("upgrades", context.youtube);
          this.scheduleUpdate();
        }
        return { redirectURL: target };
      }
    }
    return { cancel: false };
  }
  private markFinished(attachment: Attachment, id: number) {
    if (attachment.finished.has(id)) return;
    if (attachment.finished.size >= 8192)
      attachment.finished.delete(attachment.finished.values().next().value!);
    attachment.finished.add(id);
  }
  private terminal(attachment: Attachment, id: number, error?: string) {
    const request = attachment.pending.get(id);
    if (!request || this.disposed || this.clearing) return;
    attachment.pending.delete(id);
    this.markFinished(attachment, id);
    // A cancellation request alone is not a confirmed block. Chromium must report
    // ERR_BLOCKED_BY_CLIENT; all other failures remain allowed-with-network-error.
    const blocked =
      !!request.decision?.blocked && error === "net::ERR_BLOCKED_BY_CLIENT";
    const category = request.decision?.category || "other",
      site = this.site(request.site);
    if (request.siteGeneration !== site.generation) site.counters.evaluated++;
    this.statistics.terminal(
      request.time,
      request.youtube,
      blocked,
      category,
      request.site,
      request.hostname,
      request.thirdParty,
      !!error,
    );
    if (blocked) {
      site.counters.blocked++;
      site.counters[counterCategory(category)]++;
      if (request.thirdParty) site.counters.thirdPartyBlocked++;
      this.stats.totalBlocked++;
      const legacyKey = (
        {
          ads: "adsBlocked",
          trackers: "trackersBlocked",
          telemetry: "telemetryBlocked",
          cryptomining: "cryptominersBlocked",
          social: "socialBlocked",
        } as const
      )[
        category as "ads" | "trackers" | "telemetry" | "cryptomining" | "social"
      ];
      if (legacyKey) this.stats[legacyKey]++;
      const diagnostic: ProtectionDiagnostic = {
        id: randomUUID(),
        hostname: request.hostname,
        site: request.site,
        resourceType: request.type,
        category,
        source: request.decision!.source,
        rule: request.decision!.rule.slice(0, 1024),
        thirdParty: request.thirdParty,
        time: this.clock(),
        youtube: request.youtube,
      };
      site.recent = [diagnostic, ...site.recent].slice(0, 20);
      if (request.youtube)
        this.youtubeRecent = [diagnostic, ...this.youtubeRecent].slice(0, 60);
    } else {
      site.counters.allowed++;
      if (error) site.counters.failed++;
      if (
        request.youtube &&
        request.essential &&
        error &&
        error !== "net::ERR_ABORTED"
      )
        this.compatibility = [
          {
            hostname: request.hostname,
            resourceType: request.type,
            error: error.slice(0, 100),
            time: this.clock(),
          },
          ...this.compatibility,
        ].slice(0, 20);
    }
    this.scheduleUpdate();
  }
  private site(origin: string): SiteActivity {
    if (!this.sites.has(origin)) {
      if (this.sites.size >= 500)
        this.sites.delete(this.sites.keys().next().value!);
      this.sites.set(origin, {
        generation: ++this.siteGeneration,
        counters: { ...EMPTY_COUNTERS },
        recent: [],
      });
    }
    return this.sites.get(origin)!;
  }
  private restrictCookies(
    attachment: Attachment,
    details:
      OnBeforeSendHeadersListenerDetails | OnHeadersReceivedListenerDetails,
  ) {
    const context = this.context(attachment, details);
    if (!context || details.resourceType === "mainFrame") return false;
    const prefs = this.engine.preferences(this.settings(), context.site);
    return (
      prefs.enabled &&
      prefs.blockThirdPartyCookies &&
      !(
        context.youtube && youtubeEssential(details.url, details.resourceType)
      ) &&
      networkRequest(details.url, context.site, details.resourceType)
        .isThirdParty
    );
  }
  private recordCookie(
    attachment: Attachment,
    details:
      OnBeforeSendHeadersListenerDetails | OnHeadersReceivedListenerDetails,
  ) {
    const context = this.context(attachment, details);
    if (!context || this.clearing) return;
    this.site(context.site).counters.cookies++;
    this.statistics.intervention("cookies", context.youtube);
    this.scheduleUpdate();
  }
  public shouldBlockPopup(url: string) {
    const prefs = this.engine.preferences(this.settings(), url);
    return prefs.enabled && prefs.popups;
  }
  public recordPopup(url = this.activeSite()) {
    if (this.clearing || this.disposed) return;
    this.stats.popupsBlocked++;
    const origin = exactOrigin(url);
    if (origin) this.site(origin).counters.popups++;
    this.statistics.intervention("popups", youtubeHost(url));
    this.scheduleUpdate();
  }
  private scheduleUpdate() {
    if (this.disposed) return;
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      this.changed(this.getState(this.activeSite(), false));
    }, 1000);
    this.timer.unref?.();
  }
  public notify() {
    this.scheduleUpdate();
  }
  public getState(url = this.activeSite(), detailed = true): ShieldState {
    const origin = exactOrigin(url),
      activity = origin ? this.sites.get(origin) : undefined,
      prefs = this.settings();
    const enabled = this.engine.preferences(prefs, url).enabled;
    return {
      settings: structuredClone(prefs),
      stats: { ...this.stats },
      customRulesEnabled: this.config.rules.filter((rule) => rule.enabled)
        .length,
      site: {
        hostname: hostname(url),
        origin: origin || "",
        enabled,
        blocked: activity?.counters.blocked || 0,
        cookies: activity?.counters.cookies || 0,
        upgrades: activity?.counters.upgrades || 0,
        recent: structuredClone(activity?.recent || []),
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
          source: "Bundled domain rules · Ghostery network engine",
          license: "Lunar application rules",
          description:
            "Conservative built-in advertising/tracking categories. No remote download.",
          category: "other",
        },
        ...this.subscriptions.status().map((list) => ({
          ...list,
          ...(!list.ruleCount && !list.error
            ? {
                error:
                  "Not downloaded. Enable and update this source to opt in.",
              }
            : {}),
        })),
      ],
      ...(detailed
        ? {
            protection: {
              config: structuredClone(this.config),
              statistics: this.statistics.snapshot(),
              site: origin
                ? {
                    origin,
                    enabled,
                    override: structuredClone(
                      this.config.sites.find(
                        (site) => site.origin === origin,
                      ) || null,
                    ),
                    counters: structuredClone(
                      activity?.counters || EMPTY_COUNTERS,
                    ),
                    recent: structuredClone(activity?.recent || []),
                  }
                : null,
              youtube: {
                enabled: this.config.youtube.enabled,
                active: youtubeHost(url),
                compatibility: structuredClone(this.compatibility),
                recent: structuredClone(this.youtubeRecent),
                liveVerification: "not-certified" as const,
              },
              cache: this.engine.cacheInfo(),
              ...(this.persistenceError
                ? { persistenceError: this.persistenceError }
                : {}),
            },
          }
        : {}),
    };
  }
  public knownOrigins() {
    return [
      ...new Set([
        ...this.sites.keys(),
        ...this.config.sites.map((site) => site.origin),
      ]),
    ];
  }
  public getConfig() {
    return structuredClone(this.config);
  }
  public getPermissionPolicies() {
    return structuredClone(this.config.permissions);
  }
  private ruleText(config: ShieldConfig) {
    for (const [index, rule] of config.rules.entries()) {
      const invalid = validateNetworkRule(rule.text);
      if (invalid && rule.enabled)
        throw new Error(`Custom rule ${index + 1}: ${invalid}`);
    }
    return config.rules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.text)
      .join("\n");
  }
  private mutate(
    change: (config: ShieldConfig) => ShieldConfig,
  ): Promise<ShieldState> {
    const operation = this.mutations.then(async () => {
      await this.ready;
      if (this.disposed) throw new Error("The filter service is closing.");
      const next = shieldConfigSchema.parse(change(this.getConfig())),
        text = this.ruleText(next);
      const previousText = this.config.rules
        .filter((rule) => rule.enabled)
        .map((rule) => rule.text)
        .join("\n");
      const compiled =
        text !== previousText || (!!text && !this.compiledCustom)
          ? text
            ? (await this.compile(text, "abp", this.lifecycle.signal)).bytes
            : null
          : this.compiledCustom;
      if (this.disposed) throw new Error("The filter service is closing.");
      const saved = await this.configFile.write(next, true);
      const removed = this.config.subscriptions.filter(
        (source) => !saved.subscriptions.some((next) => next.id === source.id),
      );
      this.config = saved;
      this.compiledCustom = compiled;
      this.engine.configure(saved, compiled);
      for (const source of removed) await this.subscriptions.remove(source.id);
      this.subscriptions.configure(saved.subscriptions);
      this.persistenceError = undefined;
      this.notify();
      return this.getState();
    });
    this.mutations = operation.catch(() => {});
    return operation;
  }
  public setSite(origin: string, patch: SitePolicyPatch | null) {
    originSchema.parse(origin);
    if (patch !== null) patch = sitePolicyPatchSchema.parse(patch);
    return this.mutate((config) => {
      const previous = config.sites.find((site) => site.origin === origin);
      config.sites = config.sites.filter((site) => site.origin !== origin);
      if (patch !== null) config.sites.push({ ...previous, ...patch, origin });
      return config;
    });
  }
  public saveRule(id: string | null, input: CustomRuleInput) {
    const rule = customRuleInputSchema.parse(input),
      invalid = validateNetworkRule(rule.text);
    if (invalid) return Promise.reject(new Error(invalid));
    return this.mutate((config) => {
      if (id && !config.rules.some((rule) => rule.id === id))
        throw new Error("This custom rule no longer exists.");
      const saved = { ...rule, id: id || randomUUID() };
      config.rules = id
        ? config.rules.map((rule) => (rule.id === id ? saved : rule))
        : [...config.rules, saved];
      return config;
    });
  }
  public deleteRule(id: string) {
    return this.mutate((config) => {
      if (!config.rules.some((rule) => rule.id === id))
        throw new Error("This custom rule no longer exists.");
      config.rules = config.rules.filter((rule) => rule.id !== id);
      return config;
    });
  }
  public importRules(text: string) {
    if (Buffer.byteLength(text) > 8 * 1024 * 1024)
      return Promise.reject(new Error("Rule imports are limited to 8 MiB."));
    const rules: Array<z.output<typeof customRuleInputSchema>> = [];
    if (text.trimStart().startsWith("{")) {
      try {
        rules.push(
          ...z
            .object({
              version: z.literal(1),
              rules: z.array(customRuleInputSchema).max(2000),
            })
            .strict()
            .parse(JSON.parse(text)).rules,
        );
      } catch {
        return Promise.reject(
          new Error("Invalid custom-rule backup. No rules were imported."),
        );
      }
    } else
      for (const [index, raw] of text.split(/\r?\n/u).entries()) {
        const line = raw.trim();
        if (!line || line.startsWith("!") || line.startsWith("[")) continue;
        const invalid = validateNetworkRule(line);
        if (invalid)
          return Promise.reject(
            new Error(`Line ${index + 1}: ${invalid} No rules were imported.`),
          );
        rules.push({ text: line, enabled: true, note: "Imported" });
      }
    for (const [index, rule] of rules.entries()) {
      const invalid = validateNetworkRule(rule.text);
      if (invalid)
        return Promise.reject(
          new Error(`Rule ${index + 1}: ${invalid} No rules were imported.`),
        );
    }
    if (!rules.length)
      return Promise.reject(new Error("No supported network rules to import."));
    return this.mutate((config) => {
      const existing = new Set(config.rules.map((rule) => rule.text));
      for (const rule of rules)
        if (!existing.has(rule.text)) {
          existing.add(rule.text);
          config.rules.push({ ...rule, id: randomUUID() });
        }
      return config;
    });
  }
  public exportRules() {
    return (
      JSON.stringify(
        {
          version: 1,
          rules: this.config.rules.map(({ text, enabled, note }) => ({
            text,
            enabled,
            note,
          })),
        },
        null,
        2,
      ) + "\n"
    );
  }
  public async addSubscription(input: { name: string; url: string }) {
    const parsed = subscriptionInputSchema.parse(input),
      url = trustedSubscriptionURL(parsed.url);
    return this.mutate((config) => {
      if (config.subscriptions.some((source) => source.url === url))
        throw new Error("This subscription already exists.");
      config.subscriptions.push({
        ...parsed,
        url,
        id: `custom_${randomUUID()}`,
      });
      return config;
    });
  }
  public async removeSubscription(id: string) {
    if (!this.config.subscriptions.some((source) => source.id === id))
      throw new Error("Only custom subscriptions can be removed.");
    return this.mutate((config) => {
      config.subscriptions = config.subscriptions.filter(
        (source) => source.id !== id,
      );
      return config;
    });
  }
  public refresh(id?: string): Promise<ShieldState> {
    if (this.disposed)
      return Promise.reject(new Error("The filter service is closing."));
    const key = id || "selected";
    if (this.refreshing.has(key)) return this.refreshing.get(key)!;
    const selected = id
      ? [id]
      : this.settings().filterLists.filter((id) => id !== "lunar-core");
    if (!selected.length)
      return Promise.reject(
        new Error("Select a maintained source before requesting an update."),
      );
    const operation = this.ready
      .then(() => this.subscriptions.update(selected))
      .then(() => this.getState())
      .finally(() => {
        this.refreshing.delete(key);
      });
    this.refreshing.set(key, operation);
    return operation;
  }
  public async resetList(id: string) {
    await this.subscriptions.reset(id);
    this.engine.clearCache();
    return this.getState();
  }
  public setYoutube(enabled: boolean) {
    return this.mutate((config) => {
      config.youtube.enabled = enabled;
      return config;
    });
  }
  public async resetYoutube() {
    const state = await this.mutate((config) => {
      config.youtube.enabled = true;
      config.sites = config.sites.filter((site) => !youtubeHost(site.origin));
      return config;
    });
    this.compatibility = [];
    this.youtubeRecent = [];
    this.notify();
    return { ...state, protection: this.getState().protection };
  }
  public setPermission(
    origin: string,
    permission: PermissionKey,
    mode: PermissionMode,
  ) {
    originSchema.parse(origin);
    permissionKeySchema.parse(permission);
    permissionModeSchema.parse(mode);
    return this.mutate((config) => {
      config.permissions = config.permissions.filter(
        (entry) => entry.origin !== origin || entry.permission !== permission,
      );
      if (mode !== "ask") config.permissions.push({ origin, permission, mode });
      return config;
    }).then(() => {});
  }
  public resetPermissionPolicies(origin?: string) {
    return this.mutate((config) => {
      config.permissions = origin
        ? config.permissions.filter((entry) => entry.origin !== origin)
        : [];
      return config;
    }).then(() => {});
  }
  public clearSiteDiagnostics(url?: string) {
    if (url) this.sites.delete(exactOrigin(url) || "");
    else this.sites.clear();
    this.notify();
  }
  public clearHistory(): Promise<ShieldState> {
    if (this.clearingHistory) return this.clearingHistory;
    if (this.disposed)
      return Promise.reject(new Error("The filter service is closing."));
    this.clearing = true;
    for (const attachment of this.attachments.values()) {
      for (const id of attachment.pending.keys())
        this.markFinished(attachment, id);
      attachment.pending.clear();
    }
    this.clearingHistory = this.performHistoryClear().finally(() => {
      this.clearingHistory = null;
    });
    return this.clearingHistory;
  }
  private async performHistoryClear() {
    try {
      await this.statistics.clear();
      this.sites.clear();
      this.youtubeRecent = [];
      this.compatibility = [];
      this.stats = {
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        telemetryBlocked: 0,
        cryptominersBlocked: 0,
        socialBlocked: 0,
        popupsBlocked: 0,
      };
      // Retain bounded ID tombstones, not the cleared request/context data.
      // Late redirect/terminal callbacks must not repopulate cleared history.
      this.engine.clearCache();
    } finally {
      this.clearing = false;
      this.notify();
    }
    return this.getState();
  }
  public async resetConfig() {
    return this.mutate(() => structuredClone(DEFAULT_SHIELD_CONFIG));
  }
  public async flush() {
    await this.mutations;
    await this.statistics.flush();
  }
  public dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.lifecycle.abort();
    if (this.timer) clearTimeout(this.timer);
    for (const session of [...this.attachments.keys()])
      this.detachSession(session);
    const subscriptionShutdown = this.subscriptions.dispose();
    this.disposal = (async () => {
      await this.ready;
      await this.mutations;
      await subscriptionShutdown;
      // A configuration removal already saving when shutdown began may have
      // queued cache cleanup after the initial cancellation. Await that too.
      await this.subscriptions.dispose();
      await this.clearingHistory;
      await this.statistics.dispose();
    })();
    return this.disposal;
  }
}
