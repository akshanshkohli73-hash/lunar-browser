import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  EMPTY_COUNTERS,
  type ProtectionCounters,
  type PrivacyStatistics,
  type StatisticsPeriod,
  type SourceCategory,
} from "../../shared/shield";
import { ShieldProfileFile } from "./profile-file";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const counters = z
  .object(
    Object.fromEntries(
      Object.keys(EMPTY_COUNTERS).map((key) => [key, count]),
    ) as Record<keyof ProtectionCounters, typeof count>,
  )
  .strict();
const hash = z.string().regex(/^[a-f\d]{32}$/u);
const bucketSchema = z
  .object({
    totals: counters,
    youtube: counters,
    sites: z.array(hash).max(8192),
    domains: z.array(hash).max(8192),
    limited: z.boolean(),
  })
  .strict();
const statisticsSchema = z
  .object({
    version: z.literal(1),
    since: z.number().nonnegative(),
    salt: z.string().regex(/^[a-f\d]{64}$/u),
    all: bucketSchema,
    days: z
      .array(
        bucketSchema
          .extend({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) })
          .strict(),
      )
      .max(31),
  })
  .strict();
type SavedBucket = z.infer<typeof bucketSchema>;
interface Bucket {
  totals: ProtectionCounters;
  youtube: ProtectionCounters;
  sites: Set<string>;
  domains: Set<string>;
  limited: boolean;
}
const blank = (): Bucket => ({
  totals: { ...EMPTY_COUNTERS },
  youtube: { ...EMPTY_COUNTERS },
  sites: new Set(),
  domains: new Set(),
  limited: false,
});
const restore = (value: SavedBucket): Bucket => ({
  ...value,
  sites: new Set(value.sites),
  domains: new Set(value.domains),
});
const save = (value: Bucket): SavedBucket => ({
  ...value,
  sites: [...value.sites],
  domains: [...value.domains],
});
const sum = (left: ProtectionCounters, right: ProtectionCounters) => {
  for (const key of Object.keys(EMPTY_COUNTERS) as Array<
    keyof ProtectionCounters
  >)
    left[key] += right[key];
};
export function counterCategory(
  category: SourceCategory,
): "ads" | "trackers" | "malware" | "custom" | "other" {
  return category === "ads" ||
    category === "trackers" ||
    category === "malware" ||
    category === "custom"
    ? category
    : "other";
}
/** Only timestamped UTC-day aggregates and salted domain identifiers are durable.
 * Request URLs, page titles, raw site/domain names, and individual events are not.
 */
export class ProtectionStatistics {
  private file: ShieldProfileFile<z.infer<typeof statisticsSchema>>;
  private all: Bucket;
  private days = new Map<string, Bucket>();
  private since: number;
  private salt: string;
  private timer?: ReturnType<typeof setTimeout>;
  private dirty = false;
  private disposed = false;
  private clearing: Promise<void> | null = null;
  error?: string;
  constructor(
    profile: string,
    private clock: () => number = Date.now,
  ) {
    const fallback = {
      version: 1 as const,
      since: clock(),
      salt: randomBytes(32).toString("hex"),
      all: save(blank()),
      days: [],
    };
    this.file = new ShieldProfileFile(
      path.join(profile, "shield-statistics.json"),
      statisticsSchema,
      fallback,
      (message) => {
        this.error = message;
      },
    );
    const saved = this.file.read();
    this.all = restore(saved.all);
    this.since = saved.since;
    this.salt = saved.salt;
    for (const day of saved.days) this.days.set(day.day, restore(day));
    this.prune();
  }
  private day(time: number) {
    return new Date(time).toISOString().slice(0, 10);
  }
  private prune() {
    const minimum = this.day(this.clock() - 30 * 86_400_000),
      today = this.day(this.clock());
    for (const day of this.days.keys())
      if (day < minimum || day > today) this.days.delete(day);
    while (this.days.size > 31)
      this.days.delete([...this.days.keys()].sort()[0]);
  }
  private digest(value: string) {
    return createHmac("sha256", this.salt)
      .update(value)
      .digest("hex")
      .slice(0, 32);
  }
  private mutate(
    time: number,
    youtube: boolean,
    change: (bucket: Bucket, counters: ProtectionCounters) => void,
    youtubeOnly = false,
  ) {
    if (this.clearing || this.disposed) return;
    this.prune();
    const day = this.day(time);
    // Very old pending requests still contribute to all-time, never fabricated recent days.
    const recent =
      day >= this.day(this.clock() - 30 * 86_400_000) &&
      day <= this.day(this.clock());
    if (recent && !this.days.has(day)) this.days.set(day, blank());
    this.prune();
    for (const bucket of [
      this.all,
      ...(this.days.has(day) ? [this.days.get(day)!] : []),
    ]) {
      if (!youtubeOnly) change(bucket, bucket.totals);
      if (youtube)
        change(
          { ...bucket, sites: new Set(), domains: new Set() },
          bucket.youtube,
        );
    }
    this.dirty = true;
    if (!this.disposed) {
      this.timer ??= setTimeout(() => {
        this.timer = undefined;
        void this.flush().catch(() => {});
      }, 2000);
      this.timer.unref?.();
    }
  }
  evaluate(time: number, youtube: boolean) {
    this.mutate(time, youtube, (_bucket, counts) => {
      counts.evaluated++;
    });
  }
  /** A redirect can first become a genuine YouTube request after evaluation.
   * Add its YouTube evaluation once, without double-counting the global total. */
  recognizeYoutube(time: number) {
    this.mutate(
      time,
      true,
      (_bucket, counts) => {
        counts.evaluated++;
      },
      true,
    );
  }
  terminal(
    time: number,
    youtube: boolean,
    blocked: boolean,
    category: SourceCategory,
    site: string,
    hostname: string,
    thirdParty: boolean,
    failed: boolean,
  ) {
    const siteHash = blocked && site ? this.digest(site) : "",
      domainHash = blocked && hostname ? this.digest(hostname) : "";
    this.mutate(time, youtube, (bucket, counts) => {
      if (blocked) {
        counts.blocked++;
        counts[counterCategory(category)]++;
        if (thirdParty) counts.thirdPartyBlocked++;
        for (const [collection, value] of [
          [bucket.sites, siteHash],
          [bucket.domains, domainHash],
        ] as const) {
          if (value && collection.size < (bucket === this.all ? 8192 : 2048))
            collection.add(value);
          else if (value && !collection.has(value)) bucket.limited = true;
        }
      } else {
        counts.allowed++;
        if (failed) counts.failed++;
      }
    });
  }
  intervention(type: "cookies" | "popups" | "upgrades", youtube: boolean) {
    this.mutate(this.clock(), youtube, (_bucket, counts) => {
      counts[type]++;
    });
  }
  snapshot(): PrivacyStatistics {
    this.prune();
    const merge = (entries: Bucket[]): StatisticsPeriod => {
      const combined = blank();
      for (const bucket of entries) {
        sum(combined.totals, bucket.totals);
        sum(combined.youtube, bucket.youtube);
        for (const key of bucket.sites) combined.sites.add(key);
        for (const key of bucket.domains) combined.domains.add(key);
        combined.limited ||= bucket.limited;
      }
      return {
        totals: combined.totals,
        youtube: combined.youtube,
        protectedSites: combined.sites.size,
        uniqueBlockedDomains: combined.domains.size,
        distinctCountsLimited: combined.limited,
        unresolved: Math.max(
          0,
          combined.totals.evaluated -
            combined.totals.allowed -
            combined.totals.blocked,
        ),
      };
    };
    const recent = (length: number) =>
      [...this.days]
        .filter(
          ([day]) =>
            day >= this.day(this.clock() - (length - 1) * 86_400_000) &&
            day <= this.day(this.clock()),
        )
        .map(([, bucket]) => bucket);
    return {
      since: this.since,
      periods: {
        today: merge(recent(1)),
        week: merge(recent(7)),
        month: merge(recent(30)),
        all: merge([this.all]),
      },
      days: [...this.days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, bucket]) => ({
          day,
          evaluated: bucket.totals.evaluated,
          blocked: bucket.totals.blocked,
          allowed: bucket.totals.allowed,
        })),
      ...(this.error ? { persistenceError: this.error } : {}),
    };
  }
  async flush(): Promise<void> {
    if (this.clearing) {
      await this.clearing;
      return this.flush();
    }
    if (!this.dirty) return this.file.idle();
    this.prune();
    this.dirty = false;
    try {
      await this.file.write({
        version: 1,
        since: this.since,
        salt: this.salt,
        all: save(this.all),
        days: [...this.days].map(([day, bucket]) => ({ day, ...save(bucket) })),
      });
      this.error = undefined;
    } catch (error) {
      this.dirty = true;
      this.error =
        error instanceof Error
          ? error.message
          : "Protection statistics could not be saved.";
      throw error;
    }
  }
  clear(): Promise<void> {
    if (this.clearing) return this.clearing;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    // flush() waits for this transaction instead of enqueuing an old snapshot
    // behind the cleared primary/backup. Requests at the reset boundary are not
    // re-counted, and a failed disk write leaves the previous in-memory state.
    this.clearing = (async () => {
      await this.file.idle();
      const since = this.clock(),
        salt = randomBytes(32).toString("hex");
      await this.file.write(
        { version: 1, since, salt, all: save(blank()), days: [] },
        true,
      );
      this.all = blank();
      this.days.clear();
      this.since = since;
      this.salt = salt;
      this.dirty = false;
      this.error = undefined;
      await this.file.purgeRecoveryCopies();
    })().finally(() => {
      this.clearing = null;
    });
    return this.clearing;
  }
  async dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.flush();
  }
}
