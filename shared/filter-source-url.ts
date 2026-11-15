const TRUSTED_HOSTS = new Set([
  "api.github.com",
  "raw.githubusercontent.com",
  "easylist.to",
  "easylist-downloads.adblockplus.org",
  "hagezi.github.io",
  "blocklistproject.github.io",
]);
/** A public data-source allowlist, not an arbitrary HTTPS downloader. Keep this
 * validation shared by IPC, profile recovery and the main-process manifest. */
export function trustedSubscriptionURL(input: string): string {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !TRUSTED_HOSTS.has(url.hostname)
  )
    throw new Error(
      "Use an HTTPS filter URL on api.github.com (repository contents), raw.githubusercontent.com, easylist.to, easylist-downloads.adblockplus.org, hagezi.github.io or blocklistproject.github.io. Redirects, credentials and alternate ports are not accepted.",
    );
  if (
    url.hostname === "api.github.com" &&
    (!/^\/repos\/[a-z\d_.-]+\/[a-z\d_.-]+\/contents\/[^\s]+$/iu.test(
      url.pathname,
    ) ||
      [...url.searchParams.keys()].some((key) => key !== "ref"))
  )
    throw new Error(
      "Use a GitHub repository contents API URL, optionally with a ref parameter.",
    );
  return url.href;
}
