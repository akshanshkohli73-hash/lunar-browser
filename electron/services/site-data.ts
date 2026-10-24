import type { Session } from "electron";

/** Chromium cookies are registrable-domain scoped, NOT origin-isolated.
 * The native confirmation must disclose related-subdomain cookie removal.
 */
export async function clearOriginSiteData(
  web: Pick<Session, "clearData">,
  input: string,
): Promise<void> {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Only an HTTP(S) website's data can be cleared.");
  await web.clearData({
    origins: [url.origin],
    originMatchingMode: "origin-in-all-contexts",
    dataTypes: [
      "cookies",
      "localStorage",
      "indexedDB",
      "serviceWorkers",
      "fileSystems",
      "cache",
    ],
  });
}
export async function clearWebSessionData(
  web: Pick<Session, "clearStorageData" | "clearCache" | "clearAuthCache">,
): Promise<void> {
  await web.clearStorageData();
  await web.clearCache();
  await web.clearAuthCache();
}
