import { z } from "zod";
import { hostnameSchema, idSchema } from "./schemas";
import { trustedSubscriptionURL } from "./filter-source-url";

export const originSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.origin === value
      );
    } catch {
      return false;
    }
  }, "Use an exact HTTP(S) origin, without a path, credentials or query.");
export const resourceTypeSchema = z.enum([
  "mainFrame",
  "subFrame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xhr",
  "ping",
  "cspReport",
  "media",
  "webSocket",
  "other",
]);
export const permissionKeySchema = z.enum([
  "media:video",
  "media:audio",
  "geolocation",
  "geolocation-approximate",
  "notifications",
  "clipboard-read",
]);
export const permissionModeSchema = z.enum(["ask", "allow", "block"]);
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "media:video": "Camera",
  "media:audio": "Microphone",
  geolocation: "Precise location",
  "geolocation-approximate": "Approximate location",
  notifications: "Notifications",
  "clipboard-read": "Clipboard read",
};
export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type PermissionMode = z.infer<typeof permissionModeSchema>;
export const permissionEntrySchema = z
  .object({
    origin: originSchema,
    permission: permissionKeySchema,
    mode: permissionModeSchema,
  })
  .strict();
export type PermissionEntry = z.infer<typeof permissionEntrySchema>;
export const requestExceptionSchema = z
  .object({
    hostname: hostnameSchema,
    resourceType: z.union([resourceTypeSchema, z.literal("*")]),
  })
  .strict();
export const sitePolicyPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    ads: z.boolean().optional(),
    trackers: z.boolean().optional(),
    malware: z.boolean().optional(),
    blockThirdPartyCookies: z.boolean().optional(),
    mode: z.enum(["balanced", "strict"]).optional(),
    allowedRequests: z.array(requestExceptionSchema).max(100).optional(),
  })
  .strict();
export const sitePolicySchema = sitePolicyPatchSchema
  .extend({ origin: originSchema })
  .strict();
export type SitePolicy = z.infer<typeof sitePolicySchema>;
export type SitePolicyPatch = z.infer<typeof sitePolicyPatchSchema>;
export const customRuleInputSchema = z
  .object({
    text: z.string().trim().min(3).max(1024),
    enabled: z.boolean(),
    note: z.string().trim().max(160).default(""),
  })
  .strict();
export const customRuleSchema = customRuleInputSchema
  .extend({ id: idSchema })
  .strict();
export type CustomRule = z.infer<typeof customRuleSchema>;
export type CustomRuleInput = z.input<typeof customRuleInputSchema>;
export const subscriptionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          trustedSubscriptionURL(value);
          return true;
        } catch {
          return false;
        }
      }, "Use a trusted public HTTPS filter URL; credentials, private hosts, redirects and non-data GitHub endpoints are not accepted.")
      .transform(trustedSubscriptionURL),
  })
  .strict();
export const subscriptionSchema = subscriptionInputSchema
  .extend({
    id: z.string().regex(/^custom_[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u),
  })
  .strict();
export type CustomSubscription = z.infer<typeof subscriptionSchema>;
export const shieldConfigSchema = z
  .object({
    version: z.literal(2),
    sites: z.array(sitePolicySchema).max(500),
    rules: z.array(customRuleSchema).max(2000),
    subscriptions: z.array(subscriptionSchema).max(6),
    permissions: z.array(permissionEntrySchema).max(2000),
    youtube: z.object({ enabled: z.boolean() }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [label, entries] of [
      ["site", value.sites.map((x) => x.origin)],
      ["rule", value.rules.map((x) => x.id)],
      ["subscription", value.subscriptions.map((x) => x.id)],
      [
        "permission",
        value.permissions.map((x) => `${x.origin}|${x.permission}`),
      ],
    ] as const)
      if (new Set(entries).size !== entries.length)
        context.addIssue({
          code: "custom",
          message: `Duplicate ${label} entries are not allowed.`,
        });
  });
export type ShieldConfig = z.infer<typeof shieldConfigSchema>;
export const DEFAULT_SHIELD_CONFIG: ShieldConfig = {
  version: 2,
  sites: [],
  rules: [],
  subscriptions: [],
  permissions: [],
  youtube: { enabled: true },
};
export type ProtectionCategory =
  "ads" | "trackers" | "malware" | "custom" | "other";
export type SourceCategory =
  ProtectionCategory | "telemetry" | "social" | "cryptomining";
export type SourceFormat = "hosts" | "abp";
export interface ShieldSource {
  id: string;
  name: string;
  description: string;
  homepage: string;
  license: string;
  urls: readonly string[];
  category: SourceCategory;
  format: SourceFormat;
  custom?: boolean;
}
export interface ProtectionCounters {
  evaluated: number;
  allowed: number;
  blocked: number;
  ads: number;
  trackers: number;
  malware: number;
  custom: number;
  other: number;
  thirdPartyBlocked: number;
  failed: number;
  popups: number;
  cookies: number;
  upgrades: number;
}
export const EMPTY_COUNTERS: ProtectionCounters = {
  evaluated: 0,
  allowed: 0,
  blocked: 0,
  ads: 0,
  trackers: 0,
  malware: 0,
  custom: 0,
  other: 0,
  thirdPartyBlocked: 0,
  failed: 0,
  popups: 0,
  cookies: 0,
  upgrades: 0,
};
export interface StatisticsPeriod {
  totals: ProtectionCounters;
  youtube: ProtectionCounters;
  protectedSites: number;
  uniqueBlockedDomains: number;
  distinctCountsLimited: boolean;
  unresolved: number;
}
export interface PrivacyStatistics {
  since: number;
  periods: Record<"today" | "week" | "month" | "all", StatisticsPeriod>;
  days: Array<{
    day: string;
    evaluated: number;
    blocked: number;
    allowed: number;
  }>;
  persistenceError?: string;
}
export interface ProtectionDiagnostic {
  id: string;
  hostname: string;
  site: string;
  resourceType: string;
  category: SourceCategory;
  source: string;
  rule: string;
  thirdParty: boolean;
  time: number;
  youtube: boolean;
}
export interface CompatibilitySignal {
  hostname: string;
  resourceType: string;
  error: string;
  time: number;
}
export interface ShieldSiteDetails {
  origin: string;
  enabled: boolean;
  override: SitePolicy | null;
  counters: ProtectionCounters;
  recent: ProtectionDiagnostic[];
}
export interface ShieldProtectionState {
  config: ShieldConfig;
  statistics: PrivacyStatistics;
  site: ShieldSiteDetails | null;
  youtube: {
    enabled: boolean;
    active: boolean;
    compatibility: CompatibilitySignal[];
    recent: ProtectionDiagnostic[];
    liveVerification: "not-certified";
  };
  cache: { entries: number; hits: number; misses: number; capacity: number };
  persistenceError?: string;
}
export const privacyClearSchema = z
  .object({
    origin: originSchema.optional(),
    range: z.enum(["hour", "day", "week", "all"]),
    types: z
      .array(z.enum(["history", "cookies", "cache", "storage"]))
      .min(1)
      .max(4)
      .refine(
        (x) => new Set(x).size === x.length,
        "Choose each data type only once.",
      ),
  })
  .strict()
  .refine(
    (x) => x.range === "all" || x.types.every((t) => t === "history"),
    "Electron does not expose reliable time-scoped cookie/cache/storage clearing; choose all time or history only.",
  )
  .refine(
    (x) => !x.origin || !x.types.includes("history"),
    "History time ranges apply across browsing history; selected-site clearing supports cookies/cache/storage.",
  );
export type PrivacyClearRequest = z.infer<typeof privacyClearSchema>;
export interface PrivacyOverview {
  cookies: number;
  cacheBytes: number;
  cookieDomains: Array<{ hostname: string; cookies: number }>;
  origins: string[];
  permissions: PermissionEntry[];
  storageBytesAvailable: false;
}
export function youtubeHost(input: string): boolean {
  try {
    const url = new URL(input);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    const hostname = url.hostname;
    return ["youtube.com", "youtube-nocookie.com", "youtu.be"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
export function youtubeEssential(url: string, type: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      youtubeHost(url) ||
      hostname === "accounts.google.com" ||
      hostname === "youtubei.googleapis.com" ||
      hostname === "youtube.googleapis.com" ||
      hostname === "i.ytimg.com" ||
      type === "media" ||
      hostname === "googlevideo.com" ||
      hostname.endsWith(".googlevideo.com")
    );
  } catch {
    return false;
  }
}
