import {
  dialog,
  shell,
  type Session,
  type BrowserWindow,
  type WebContents,
} from "electron";
import { externalDestination } from "../../shared/navigation";
import { permissionKind, secureOrigin } from "./policy";

export class PermissionManager {
  private grants = new Set<string>();
  private denials = new Set<string>();
  private pending = new Set<number>();
  private disposed = false;
  constructor(
    private session: Session,
    private window: BrowserWindow,
    private active: (id: number) => boolean,
  ) {
    session.setPermissionCheckHandler(
      (wc, permission, requestingOrigin, details) => {
        if (!wc || !details.isMainFrame || !this.eligible(wc, requestingOrigin))
          return false;
        const origin = secureOrigin(requestingOrigin)!;
        const media = details.mediaType;
        if (permissionKind(permission) === "allow") return true;
        if (permission === "media")
          return (
            !!media &&
            media !== "unknown" &&
            this.grants.has(`${origin}|media:${media}`)
          );
        return this.grants.has(`${origin}|${permission}`);
      },
    );
    session.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (!details.isMainFrame || !this.eligible(wc, details.requestingUrl)) {
        callback(false);
        return;
      }
      const origin = secureOrigin(details.requestingUrl)!;
      const mediaTypes =
        "mediaTypes" in details ? details.mediaTypes : undefined;
      const kind = permissionKind(permission, mediaTypes);
      if (kind !== "prompt") {
        callback(kind === "allow");
        return;
      }
      const keys =
        permission === "media"
          ? (mediaTypes ?? []).map((type) => `${origin}|media:${type}`)
          : [`${origin}|${permission}`];
      if (keys.some((key) => this.denials.has(key))) {
        callback(false);
        return;
      }
      if (keys.every((key) => this.grants.has(key))) {
        callback(true);
        return;
      }
      if (this.pending.has(wc.id)) {
        callback(false);
        return;
      }
      const contentsId = wc.id;
      this.pending.add(contentsId);
      void dialog
        .showMessageBox(window, {
          type: "question",
          title: "Site permission",
          message: `Allow ${permission === "media" ? (mediaTypes ?? []).map((type) => (type === "audio" ? "microphone" : "camera")).join(" and ") : permission.replaceAll("-", " ")}?`,
          detail: `${origin}\nOnly this origin, for this application session. You can reset grants in Preferences.`,
          buttons: ["Block", "Allow for this session"],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        })
        .then((result) => {
          const granted =
            result.response === 1 &&
            this.eligible(wc, origin) &&
            secureOrigin(wc.getURL()) === origin;
          if (granted) keys.forEach((key) => this.grants.add(key));
          else if (result.response === 0)
            keys.forEach((key) => this.denials.add(key));
          callback(granted);
        })
        .catch(() => callback(false))
        .finally(() => this.pending.delete(contentsId));
    });
    session.setDevicePermissionHandler(() => false);
    session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  }
  private eligible(wc: WebContents, requestingUrl: string): boolean {
    if (
      this.disposed ||
      this.window.isDestroyed() ||
      !this.window.isVisible() ||
      this.window.isMinimized() ||
      wc.isDestroyed() ||
      !this.active(wc.id)
    )
      return false;
    const origin = secureOrigin(requestingUrl);
    return !!origin && secureOrigin(wc.getURL()) === origin;
  }
  public reset() {
    this.grants.clear();
    this.denials.clear();
  }
  public dispose() {
    this.disposed = true;
    this.reset();
    this.session.setPermissionCheckHandler(() => false);
    this.session.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
  }
}
export async function openExternalConfirmed(
  window: BrowserWindow,
  input: string,
): Promise<void> {
  const destination = externalDestination(input);
  if (!destination)
    throw new Error("This link uses a blocked or unsupported protocol.");
  const { response } = await dialog.showMessageBox(window, {
    type: "question",
    title: "Open external application?",
    message: "Open this link outside Lunar Browser?",
    detail: destination,
    buttons: ["Cancel", "Open application"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response === 1 && !window.isDestroyed())
    await shell.openExternal(destination);
}
