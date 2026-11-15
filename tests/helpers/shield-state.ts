import type { ShieldState } from "../../electron/types";
import { DEFAULT_SHIELD } from "../../shared/defaults";
import { DEFAULT_SHIELD_CONFIG, EMPTY_COUNTERS } from "../../shared/shield";
/** Empty controlled renderer fixture, never live browser statistics. */
export function shieldState(origin = "https://site.example.org"): ShieldState {
  const period = () => ({
    totals: { ...EMPTY_COUNTERS },
    youtube: { ...EMPTY_COUNTERS },
    protectedSites: 0,
    uniqueBlockedDomains: 0,
    distinctCountsLimited: false,
    unresolved: 0,
  });
  return {
    settings: structuredClone(DEFAULT_SHIELD),
    stats: {
      totalBlocked: 0,
      adsBlocked: 0,
      trackersBlocked: 0,
      telemetryBlocked: 0,
      cryptominersBlocked: 0,
      socialBlocked: 0,
      popupsBlocked: 0,
    },
    site: {
      origin,
      hostname: new URL(origin).hostname,
      enabled: true,
      blocked: 0,
      cookies: 0,
      upgrades: 0,
      recent: [],
    },
    lists: [
      {
        id: "lunar-core",
        name: "Controlled core fixture",
        ruleCount: 1,
        updatedAt: null,
        license: "Test fixture",
      },
      {
        id: "easyprivacy",
        name: "Controlled privacy fixture",
        ruleCount: 0,
        updatedAt: null,
        license: "Test fixture",
      },
    ],
    protection: {
      config: structuredClone(DEFAULT_SHIELD_CONFIG),
      statistics: {
        since: Date.UTC(2026, 9, 15),
        periods: {
          today: period(),
          week: period(),
          month: period(),
          all: period(),
        },
        days: [],
      },
      site: {
        origin,
        enabled: true,
        override: null,
        counters: { ...EMPTY_COUNTERS },
        recent: [],
      },
      youtube: {
        enabled: true,
        active: false,
        compatibility: [],
        recent: [],
        liveVerification: "not-certified",
      },
      cache: { entries: 0, hits: 0, misses: 0, capacity: 4096 },
    },
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
