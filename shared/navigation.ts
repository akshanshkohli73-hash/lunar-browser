export const INTERNAL_PAGES = [
  "newtab",
  "settings",
  "themestudio",
  "bookmarks",
  "history",
  "downloads",
  "extensions",
] as const;
export const SEARCH_ENGINES = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
} as const;
export type SearchEngine = keyof typeof SEARCH_ENGINES;
export function hasControlCharacters(input: string): boolean {
  return [...input].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
export function isInternalUrl(input: string): boolean {
  return INTERNAL_PAGES.some((page) => input === `lunar://${page}`);
}
export function isWebUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** Explicit scheme allowlist. Internal URLs are chrome UI state, never privileged native pages. */
export function normalizeNavigation(
  input: string,
  engine: SearchEngine = "google",
): string {
  const text = input.trim();
  if (text.length > 8192 || hasControlCharacters(text))
    throw new Error("Address contains invalid characters or is too long.");
  if (!text || text === "about:blank") return "lunar://newtab";
  if (isInternalUrl(text)) return text;
  // Domain:port and IPv6 must be recognized before treating ':' as a scheme.
  const domain =
    /^(?:localhost|(?:[a-z\d\u0080-\uffff](?:[a-z\d\u0080-\uffff-]*[a-z\d\u0080-\uffff])?\.)+[a-z\u0080-\uffff]{2,}|(?:\d{1,3}\.){3}\d{1,3}|\[[a-f\d:]+\])(?::\d{1,5})?(?:[/?#][^\s]*)?$/iu;
  if (domain.test(text)) {
    const host = text.split(/[/?#]/u)[0];
    const local = /^(?:localhost|127\.|\[::1\])/iu.test(host);
    return normalizeNavigation(`${local ? "http" : "https"}://${text}`, engine);
  }
  if (/^[a-z][a-z\d+.-]*:/iu.test(text)) {
    if (!isWebUrl(text))
      throw new Error("This address is not supported. Use HTTP or HTTPS.");
    return new URL(text).href;
  }
  return SEARCH_ENGINES[engine] + encodeURIComponent(text);
}
export function sanitizeFavicon(value: string): string | undefined {
  return isWebUrl(value) ? value : undefined;
}
export function externalDestination(input: string): string | null {
  if (input.length > 2048 || hasControlCharacters(input)) return null;
  try {
    const url = new URL(input);
    if (url.hash) return null;
    if (url.protocol === "tel:")
      return !url.search && /^[+\d(). -]{1,64}$/u.test(url.pathname)
        ? url.href
        : null;
    const recipient = decodeURIComponent(url.pathname);
    if (
      url.protocol !== "mailto:" ||
      hasControlCharacters(recipient) ||
      !/^[^\s<>:]+@[^\s<>:]+$/u.test(recipient)
    )
      return null;
    for (const [key, value] of url.searchParams) {
      if (
        !["subject", "body", "cc", "bcc"].includes(key.toLowerCase()) ||
        value.length > 1500 ||
        (key.toLowerCase() !== "body" && hasControlCharacters(value)) ||
        [...value].some(
          (character) =>
            character.charCodeAt(0) < 32 &&
            !["\n", "\r", "\t"].includes(character),
        )
      )
        return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/** Native, unprivileged history entries for chrome-only pages; these never load app HTML/preload. */
export function nativeNavigationUrl(displayUrl: string): string {
  return isInternalUrl(displayUrl)
    ? `about:blank#lunar/${displayUrl.slice(8)}`
    : displayUrl;
}
export function displayNavigationUrl(nativeUrl: string): string | null {
  if (isWebUrl(nativeUrl)) return nativeUrl;
  const prefix = "about:blank#lunar/";
  const internal = nativeUrl.startsWith(prefix)
    ? `lunar://${nativeUrl.slice(prefix.length)}`
    : "";
  return isInternalUrl(internal) ? internal : null;
}
