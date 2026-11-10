import { isWebUrl } from "../../shared/navigation";
export function trustedEntryUrl(frameUrl: string, entryUrl: string): boolean {
  try {
    const frame = new URL(frameUrl),
      entry = new URL(entryUrl);
    return (
      frame.protocol === entry.protocol &&
      frame.host === entry.host &&
      frame.pathname === entry.pathname &&
      frame.search === entry.search
    );
  } catch {
    return false;
  }
}
export function authorizeSender(input: {
  senderId: number;
  shellId: number;
  isMainFrame: boolean;
  frameUrl: string;
  entryUrl: string;
}): boolean {
  return (
    input.senderId === input.shellId &&
    input.isMainFrame &&
    trustedEntryUrl(input.frameUrl, input.entryUrl)
  );
}
export function secureOrigin(input: string): string | null {
  if (!isWebUrl(input)) return null;
  const url = new URL(input);
  return url.protocol === "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? url.origin
    : null;
}
export function permissionKind(
  permission: string,
  mediaTypes?: string[],
): "allow" | "prompt" | "deny" {
  if (
    ["fullscreen", "pointerLock", "clipboard-sanitized-write"].includes(
      permission,
    )
  )
    return "allow";
  if (permission === "media")
    return mediaTypes?.length &&
      mediaTypes.every((type) => ["audio", "video"].includes(type))
      ? "prompt"
      : "deny";
  return [
    "geolocation",
    "geolocation-approximate",
    "notifications",
    "clipboard-read",
  ].includes(permission)
    ? "prompt"
    : "deny";
}
