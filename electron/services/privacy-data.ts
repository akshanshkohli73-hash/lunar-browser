import type { Session } from "electron";
import {
  privacyClearSchema,
  type PermissionEntry,
  type PrivacyClearRequest,
  type PrivacyOverview,
} from "../../shared/shield";

/** Cookie values, paths and HTTP authentication never cross the trusted IPC bridge. */
export async function privacyOverview(
  web: Pick<Session, "cookies" | "getCacheSize">,
  knownOrigins: string[],
  permissions: PermissionEntry[],
): Promise<PrivacyOverview> {
  const [cookies, cacheBytes] = await Promise.all([
    web.cookies.get({}),
    web.getCacheSize(),
  ]);
  const domains = new Map<string, number>();
  const origins = new Set(knownOrigins);
  for (const cookie of cookies) {
    if (!cookie.domain) continue;
    const hostname = cookie.domain.replace(/^\./u, "");
    domains.set(hostname, (domains.get(hostname) || 0) + 1);
    try {
      origins.add(
        new URL(`${cookie.secure ? "https" : "http"}://${hostname}`).origin,
      );
    } catch {
      /* Invalid native cookie hosts are not an origin inventory. */
    }
  }
  for (const entry of permissions) origins.add(entry.origin);
  return {
    cookies: cookies.length,
    cacheBytes,
    cookieDomains: [...domains]
      .map(([hostname, cookies]) => ({ hostname, cookies }))
      .sort((a, b) => b.cookies - a.cookies)
      .slice(0, 1000),
    origins: [...origins].sort().slice(0, 1000),
    permissions: structuredClone(permissions),
    storageBytesAvailable: false,
  };
}
export function historyCutoff(
  range: PrivacyClearRequest["range"],
  now = Date.now(),
) {
  return range === "all"
    ? 0
    : now -
        ({ hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000 } as const)[
          range
        ];
}
/** Electron has no dependable time-range storage deletion API. Reject unsupported
 * combinations again here, even if a future caller bypasses the IPC schema.
 */
export async function clearSelectedData(
  web: Pick<Session, "clearData" | "clearCache">,
  request: PrivacyClearRequest,
  history: { clear(since: number): void },
  now = Date.now(),
): Promise<void> {
  const input = privacyClearSchema.parse(request);
  const dataTypes: Array<
    | "cookies"
    | "cache"
    | "localStorage"
    | "indexedDB"
    | "serviceWorkers"
    | "fileSystems"
  > = [];
  if (input.types.includes("cookies")) dataTypes.push("cookies");
  if (input.types.includes("storage"))
    dataTypes.push(
      "localStorage",
      "indexedDB",
      "serviceWorkers",
      "fileSystems",
    );
  if (input.origin && input.types.includes("cache")) dataTypes.push("cache");
  if (dataTypes.length)
    await web.clearData({
      dataTypes,
      ...(input.origin
        ? {
            origins: [input.origin],
            originMatchingMode: "origin-in-all-contexts" as const,
          }
        : {}),
    });
  if (!input.origin && input.types.includes("cache")) await web.clearCache();
  if (input.types.includes("history"))
    history.clear(historyCutoff(input.range, now));
}
