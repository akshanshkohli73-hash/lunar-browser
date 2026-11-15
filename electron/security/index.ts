import {
  dialog,
  shell,
  type Session,
  type BrowserWindow,
  type WebContents,
} from "electron";
import { externalDestination } from "../../shared/navigation";
import { permissionKind, secureOrigin } from "./policy";
import {
  permissionKeySchema,
  permissionModeSchema,
  PERMISSION_LABELS,
  type PermissionEntry,
  type PermissionKey,
  type PermissionMode,
} from "../../shared/shield";

interface PermissionPolicyStore {
  get(): PermissionEntry[];
  set(
    origin: string,
    permission: PermissionKey,
    mode: PermissionMode,
  ): Promise<void>;
  reset(origin?: string): Promise<void>;
}
export class PermissionManager {
  private grants = new Set<string>();
  private denials = new Set<string>();
  private pending = new Set<number>();
  private epoch = 0;
  private disposed = false;
  constructor(
    private session: Session,
    private window: BrowserWindow,
    private active: (id: number) => boolean,
    private policies?: PermissionPolicyStore,
  ) {
    session.setPermissionCheckHandler(
      (wc, permission, requestingOrigin, details) => {
        if (!wc) return false;
        if (permissionKind(permission) === "allow")
          return this.defaultGrant(
            wc,
            permission,
            requestingOrigin,
            details.isMainFrame,
          );
        if (!details.isMainFrame || !this.eligible(wc, requestingOrigin))
          return false;
        const origin = secureOrigin(requestingOrigin)!;
        const key =
          permission === "media"
            ? details.mediaType && details.mediaType !== "unknown"
              ? `media:${details.mediaType}`
              : ""
            : permission;
        if (!permissionKeySchema.safeParse(key).success) return false;
        return this.mode(origin, key as PermissionKey) === "allow";
      },
    );
    session.setPermissionRequestHandler((wc, permission, callback, details) => {
      const mediaTypes =
        "mediaTypes" in details ? details.mediaTypes : undefined;
      const kind = permissionKind(permission, mediaTypes);
      if (kind === "allow") {
        callback(
          this.defaultGrant(
            wc,
            permission,
            details.requestingUrl,
            details.isMainFrame,
          ),
        );
        return;
      }
      if (
        kind !== "prompt" ||
        !details.isMainFrame ||
        !this.eligible(wc, details.requestingUrl)
      ) {
        callback(false);
        return;
      }
      const origin = secureOrigin(details.requestingUrl)!;
      const keys =
        permission === "media"
          ? [...new Set(mediaTypes ?? [])].map(
              (type) => `media:${type}` as PermissionKey,
            )
          : [permission as PermissionKey];
      if (
        !keys.length ||
        keys.some(
          (key) =>
            !permissionKeySchema.safeParse(key).success ||
            this.mode(origin, key) === "block",
        )
      ) {
        callback(false);
        return;
      }
      if (keys.every((key) => this.mode(origin, key) === "allow")) {
        callback(true);
        return;
      }
      if (this.pending.has(wc.id)) {
        callback(false);
        return;
      }
      const contentsId = wc.id,
        epoch = this.epoch;
      this.pending.add(contentsId);
      void dialog
        .showMessageBox(window, {
          type: "question",
          title: "Site permission",
          message: `Allow ${keys.map((key) => PERMISSION_LABELS[key]).join(" and ")}?`,
          detail: `${origin}\nOnly this secure main-frame origin, for this application session. Persistent choices are managed in Lunar Shield.`,
          buttons: ["Block", "Allow for this session"],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        })
        .then((result) => {
          const current =
            epoch === this.epoch &&
            this.eligible(wc, origin) &&
            keys.every((key) => this.mode(origin, key) !== "block");
          const granted = result.response === 1 && current;
          if (granted)
            keys.forEach((key) =>
              this.remember(this.grants, `${origin}|${key}`),
            );
          else if (current && result.response === 0)
            keys.forEach((key) =>
              this.remember(this.denials, `${origin}|${key}`),
            );
          callback(granted);
        })
        .catch(() => callback(false))
        .finally(() => this.pending.delete(contentsId));
    });
    session.setDevicePermissionHandler(() => false);
    session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  }
  private remember(collection: Set<string>, key: string) {
    if (collection.size >= 2048 && !collection.has(key))
      collection.delete(collection.values().next().value!);
    collection.add(key);
  }
  private mode(origin: string, permission: PermissionKey): PermissionMode {
    const key = `${origin}|${permission}`,
      saved = this.policies
        ?.get()
        .find(
          (entry) => entry.origin === origin && entry.permission === permission,
        )?.mode;
    if (saved === "block" || this.denials.has(key)) return "block";
    return saved === "allow" || this.grants.has(key) ? "allow" : "ask";
  }
  private visibleOwned(wc: WebContents): boolean {
    return (
      !this.disposed &&
      !this.window.isDestroyed() &&
      this.window.isVisible() &&
      !this.window.isMinimized() &&
      !wc.isDestroyed() &&
      this.active(wc.id)
    );
  }
  private eligible(wc: WebContents, requestingUrl: string): boolean {
    if (!this.visibleOwned(wc)) return false;
    const origin = secureOrigin(requestingUrl);
    return !!origin && secureOrigin(wc.getURL()) === origin;
  }
  private defaultGrant(
    wc: WebContents,
    permission: string,
    requestingUrl: string,
    isMainFrame: boolean,
  ) {
    if (isMainFrame) return this.eligible(wc, requestingUrl);
    // Fullscreen is not a camera/device grant. Chromium still requires the
    // iframe's allowfullscreen/Permissions-Policy and transient user activation.
    // Do not break a genuine embedded player's fullscreen by applying the
    // sensitive, main-frame-only rule to this non-sensitive capability.
    return (
      permission === "fullscreen" &&
      this.visibleOwned(wc) &&
      !!secureOrigin(wc.getURL()) &&
      !!secureOrigin(requestingUrl)
    );
  }
  public status(input: string) {
    const origin = secureOrigin(input);
    const permissions = permissionKeySchema.options;
    return {
      grants: origin
        ? permissions.filter(
            (permission) => this.mode(origin, permission) === "allow",
          )
        : [],
      denials: origin
        ? permissions.filter(
            (permission) => this.mode(origin, permission) === "block",
          )
        : [],
    };
  }
  /** Explicit persistent Allow always passes through native, origin-labelled confirmation.
   * A web page cannot reach this operation; main also validates the shell sender.
   */
  public async setSitePolicy(
    input: string,
    permission: PermissionKey,
    mode: PermissionMode,
  ) {
    permissionKeySchema.parse(permission);
    permissionModeSchema.parse(mode);
    const origin = secureOrigin(input);
    if (!origin)
      throw new Error(
        "Permissions can be configured only for a secure website origin.",
      );
    if (this.disposed || this.window.isDestroyed())
      throw new Error("The permission service is closing.");
    const epoch = ++this.epoch;
    if (mode === "allow") {
      if (!this.window.isVisible() || this.window.isMinimized())
        throw new Error(
          "Bring Lunar to the foreground before confirming sensitive access.",
        );
      const result = await dialog.showMessageBox(this.window, {
        type: "warning",
        title: "Remember sensitive permission?",
        message: `Always allow ${PERMISSION_LABELS[permission]} for ${origin}?`,
        detail:
          "Only this secure, active, visible main-frame origin may use this permission. The operating system may request additional consent. This persists until you choose Ask, Block or reset. Existing capture may continue until its page is closed or reloaded.",
        buttons: ["Cancel", "Allow this origin"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (
        result.response !== 1 ||
        epoch !== this.epoch ||
        this.disposed ||
        this.window.isDestroyed() ||
        !this.window.isVisible() ||
        this.window.isMinimized()
      )
        throw new Error(
          "The permission change was cancelled or the page policy changed.",
        );
    }
    if (this.policies) await this.policies.set(origin, permission, mode);
    if (this.disposed || epoch !== this.epoch) return;
    const key = `${origin}|${permission}`;
    this.grants.delete(key);
    this.denials.delete(key);
    // The optional in-memory store keeps adapters/tests useful without persistence.
    if (!this.policies && mode === "allow") this.remember(this.grants, key);
    if (mode === "block") this.remember(this.denials, key);
  }
  /** Legacy session-only deny/ask adapter; the trusted UI now uses setSitePolicy. */
  public denySite(input: string, permission: string, deny: boolean) {
    permissionKeySchema.parse(permission);
    const origin = secureOrigin(input);
    if (!origin)
      throw new Error(
        "Permissions can be configured only for a secure website origin.",
      );
    this.epoch++;
    const key = `${origin}|${permission}`;
    this.grants.delete(key);
    if (deny) this.remember(this.denials, key);
    else this.denials.delete(key);
  }
  public resetSite(input: string): Promise<void> {
    const origin = secureOrigin(input);
    this.epoch++;
    for (const collection of [this.grants, this.denials])
      for (const key of collection)
        if (origin && key.startsWith(`${origin}|`)) collection.delete(key);
    return origin && this.policies
      ? this.policies.reset(origin)
      : Promise.resolve();
  }
  public async resetMatching(matches: (origin: string) => boolean) {
    const origins = new Set([
      ...(this.policies?.get().map((entry) => entry.origin) || []),
      ...[...this.grants, ...this.denials].map((key) => key.split("|")[0]),
    ]);
    for (const origin of origins)
      if (matches(origin)) await this.resetSite(origin);
  }
  public reset(): Promise<void> {
    this.epoch++;
    this.grants.clear();
    this.denials.clear();
    return this.policies?.reset() || Promise.resolve();
  }
  public dispose() {
    this.disposed = true;
    this.epoch++;
    this.grants.clear();
    this.denials.clear();
    this.session.setPermissionCheckHandler(() => false);
    this.session.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    this.session.setDevicePermissionHandler(() => false);
    this.session.setDisplayMediaRequestHandler((_request, callback) =>
      callback({}),
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
