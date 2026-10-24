import {
  app,
  protocol,
  net,
  BrowserWindow,
  Menu,
  ipcMain,
  session,
  dialog,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import {
  WallpaperStore,
  registerWallpaperProtocol,
} from "../services/wallpaper-store";
import {
  clearOriginSiteData,
  clearWebSessionData,
} from "../services/site-data";
import { fetchWeather } from "../services/weather";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { TabManager } from "../browser/tab-manager";
import { loadShellWindow } from "./shell-loader";
import { LunarShield } from "../blocker/shield";
import { StorageService } from "../services/storage";
import { DownloadManager } from "../downloads/download-manager";
import { ExtensionManager } from "../extensions/extension-manager";
import { getPageText } from "../services/ai-extractor";
import { migrateLegacyCredentials } from "../services/legacy-credentials";
import { AIService, AIVault } from "../services/ai-service";
import { PermissionManager, openExternalConfirmed } from "../security";
import { authorizeSender, trustedEntryUrl } from "../security/policy";
import { isWebUrl, externalDestination } from "../../shared/navigation";
import {
  requestSchemas,
  type Channel,
  type Args,
  type Outputs,
  type Reply,
  type Shortcut,
} from "../../shared/api";
import type { SessionState } from "../types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "lunar-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);
app.enableSandbox();
// Default-deny popups from extension background pages or any otherwise unowned contents.
// The shell and owned tabs later install their narrower, controlled-tab policies.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
if (!app.isPackaged && process.env.LUNAR_TEST_PROFILE)
  app.setPath("userData", process.env.LUNAR_TEST_PROFILE);
interface BrowserContext {
  window: BrowserWindow;
  entryUrl: string;
  storage: StorageService;
  tabs: TabManager;
  shield: LunarShield;
  downloads: DownloadManager;
  extensions: ExtensionManager;
  permissions: PermissionManager;
  ai: AIService;
  wallpapers: WallpaperStore;
}
let context: BrowserContext | null = null;
const profile = () => app.getPath("userData");
function send(channel: string, value: unknown) {
  if (
    context &&
    !context.window.isDestroyed() &&
    !context.window.webContents.isDestroyed()
  )
    context.window.webContents.send(channel, value);
}
function assertSender(event: IpcMainInvokeEvent, ctx: BrowserContext) {
  const frame = event.senderFrame;
  if (
    !frame ||
    !authorizeSender({
      senderId: event.sender.id,
      shellId: ctx.window.webContents.id,
      isMainFrame: frame === ctx.window.webContents.mainFrame,
      frameUrl: frame.url,
      entryUrl: ctx.entryUrl,
    })
  )
    throw new Error(
      "This operation is available only to Lunar’s trusted application interface.",
    );
}
function handle<K extends Channel>(
  channel: K,
  handler: (
    ctx: BrowserContext,
    ...args: Args<K>
  ) => Outputs[K] | Promise<Outputs[K]>,
) {
  ipcMain.handle(
    channel,
    async (
      event: IpcMainInvokeEvent,
      ...args: unknown[]
    ): Promise<Reply<Outputs[K]>> => {
      try {
        if (!context || context.window.isDestroyed())
          throw new Error("The browser is not ready.");
        assertSender(event, context);
        const validated = requestSchemas[channel].parse(args) as Args<K>;
        return { ok: true, value: await handler(context, ...validated) };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof ZodError
              ? `Invalid request: ${error.issues[0]?.message ?? "Unexpected input."}`
              : error instanceof Error
                ? error.message
                : "The operation could not be completed.",
        };
      }
    },
  );
}
handle("browser:bootstrap", (ctx) => ({
  tabs: ctx.tabs.snapshot(),
  settings: ctx.storage.getSettings(),
  bookmarks: ctx.storage.getBookmarks(),
  shield: ctx.shield.getState(),
  warnings: ctx.storage.warnings,
  dashboard: ctx.storage.getDashboard(),
}));
handle("tab:create", (ctx, url) => ctx.tabs.createTab(url));
handle("tab:close", (ctx, id) => ctx.tabs.closeTab(id));
handle("tab:switch", (ctx, id) => ctx.tabs.switchTab(id));
handle("tab:navigate", (ctx, id, url) => ctx.tabs.navigate(id, url));
handle("tab:back", (ctx, id) => ctx.tabs.goBack(id));
handle("tab:forward", (ctx, id) => ctx.tabs.goForward(id));
handle("tab:reload", (ctx, id, ignoreCache) =>
  ctx.tabs.reload(id, ignoreCache),
);
handle("tab:stop", (ctx, id) => ctx.tabs.stopLoading(id));
handle("tab:mute", (ctx, id) => ctx.tabs.toggleMute(id));
handle("tab:pin", (ctx, id) => ctx.tabs.togglePin(id));
handle("tab:duplicate", (ctx, id) => ctx.tabs.duplicateTab(id));
handle("tab:reorder", (ctx, ids) => ctx.tabs.reorderTabs(ids));
handle("workspace:layout", (ctx, layout) => ctx.tabs.updateWorkspace(layout));
handle("dashboard:get", (ctx) => ctx.storage.getDashboard());
handle("dashboard:update", (ctx, patch) => {
  const background = patch.wallpaper;
  if (background?.mediaId && background.kind !== "builtin")
    ctx.wallpapers.assertAsset(background.mediaId, background.kind);
  const saved = ctx.storage.updateDashboard(patch);
  send("dashboard:updated", saved);
  return saved;
});
handle("wallpaper:choose", async (ctx) => {
  const selected = await dialog.showOpenDialog(ctx.window, {
    title: "Choose a local wallpaper — nothing is uploaded",
    properties: ["openFile"],
    filters: [
      {
        name: "Images and silent-by-default videos",
        extensions: ["png", "jpg", "jpeg", "webp", "mp4", "webm"],
      },
    ],
  });
  if (selected.canceled || selected.filePaths.length !== 1) return null;
  return ctx.wallpapers.importSelectedFile(selected.filePaths[0]);
});
handle("wallpaper:prune", (ctx) =>
  ctx.wallpapers.prune(ctx.storage.getDashboard().wallpaper.mediaId),
);
handle("weather:get", (_ctx, input) =>
  fetchWeather(input, (url, options) =>
    net.fetch(typeof url === "string" ? url : String(url), options),
  ),
);
handle("settings:get", (ctx) => ctx.storage.getSettings());
handle("settings:update", (ctx, partial) => {
  const settings = ctx.storage.updateSettings(partial, ctx.tabs.sessionState());
  send("settings:updated", settings);
  ctx.shield.notify();
  return settings;
});
handle("shield:get", (ctx) => ctx.shield.getState());
handle("shield:refresh", (ctx) => ctx.shield.refresh());
handle("bookmarks:get", (ctx) => ctx.storage.getBookmarks());
handle("bookmarks:add", (ctx, input) => {
  const bookmark = ctx.storage.addBookmark(input);
  send("bookmarks:updated", ctx.storage.getBookmarks());
  return bookmark;
});
handle("bookmarks:update", (ctx, id, input) => {
  const bookmark = ctx.storage.updateBookmark(id, input);
  send("bookmarks:updated", ctx.storage.getBookmarks());
  return bookmark;
});
handle("bookmarks:delete", (ctx, id) => {
  ctx.storage.deleteBookmark(id);
  send("bookmarks:updated", ctx.storage.getBookmarks());
});
handle("history:get", (ctx) => ctx.storage.getHistory());
handle("history:delete", (ctx, ids) => ctx.storage.deleteHistoryItems(ids));
handle("history:clear", (ctx) => ctx.storage.clearHistory());
handle("downloads:get", (ctx) => ctx.downloads.getDownloads());
handle("downloads:cancel", (ctx, id) => ctx.downloads.cancelDownload(id));
handle("downloads:pause", (ctx, id) => ctx.downloads.pauseDownload(id));
handle("downloads:resume", (ctx, id) => ctx.downloads.resumeDownload(id));
handle("downloads:reveal", (ctx, id) => ctx.downloads.revealDownload(id));
handle("downloads:clear", (ctx) => ctx.downloads.clearCompleted());
handle("extensions:get", (ctx) => ctx.extensions.getExtensions());
handle("extensions:load", (ctx) => ctx.extensions.loadUnpackedExtension());
handle("extensions:toggle", (ctx, id, enabled) =>
  ctx.extensions.toggleExtension(id, enabled),
);
handle("extensions:remove", (ctx, id) => ctx.extensions.removeExtension(id));
handle("reader:text", (ctx, id) => getPageText(ctx.tabs, id));
handle("ai:status", (ctx) => ctx.ai.status());
handle("ai:saveKey", (ctx, key) => ctx.ai.saveKey(key));
handle("ai:deleteKey", (ctx) => ctx.ai.deleteKey());
handle("ai:test", (ctx) => ctx.ai.test());
handle("ai:ask", (ctx, request) => ctx.ai.ask(request));
handle("privacy:site", async (ctx, url) => ({
  origin: new URL(url).origin,
  cookies: (
    await session.fromPartition("persist:lunar-web").cookies.get({ url })
  ).length,
  ...ctx.permissions.status(url),
}));
handle("permissions:resetSite", (ctx, url) => ctx.permissions.resetSite(url));
handle("permissions:denySite", (ctx, url, permission, deny) =>
  ctx.permissions.denySite(url, permission, deny),
);
handle("privacy:clearOrigin", async (ctx, url) => {
  const origin = new URL(url).origin;
  const { response } = await dialog.showMessageBox(ctx.window, {
    type: "warning",
    title: "Clear this site's data?",
    message: `Clear cookies and storage for ${origin}?`,
    detail:
      "Cookies are shared at the registrable-domain level: related subdomains and ports may also be signed out. Origin storage/cache is cleared; history, bookmarks and notes are kept. Reload to stop existing scripts or capture.",
    buttons: ["Cancel", "Clear this site"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response !== 1)
    throw new Error("Clearing this site's data was cancelled.");
  await clearOriginSiteData(session.fromPartition("persist:lunar-web"), origin);
  ctx.permissions.resetSite(url);
  ctx.shield.clearSiteDiagnostics(url);
});
handle("permissions:reset", (ctx) => ctx.permissions.reset());
handle("privacy:clearSiteData", async (ctx) => {
  const result = await dialog.showMessageBox(ctx.window, {
    type: "warning",
    title: "Clear site data?",
    message:
      "Remove cookies, site storage, cached files and extension storage?",
    detail:
      "This signs you out of websites. Bookmarks, history and notes are kept.",
    buttons: ["Cancel", "Clear data"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (result.response !== 1)
    throw new Error("Clearing site data was cancelled.");
  for (const tab of ctx.tabs.getAllTabs()) ctx.tabs.stopLoading(tab.id);
  const webSession = session.fromPartition("persist:lunar-web");
  await clearWebSessionData(webSession);
  ctx.permissions.reset();
  ctx.shield.clearSiteDiagnostics();
});
handle("window:minimize", (ctx) => ctx.window.minimize());
handle("window:maximize", (ctx) => {
  if (ctx.window.isMaximized()) ctx.window.unmaximize();
  else ctx.window.maximize();
});
handle("window:close", (ctx) => ctx.window.close());

async function createWindow() {
  const uiSession = session.fromPartition("persist:lunar-ui"),
    webSession = session.fromPartition("persist:lunar-web");
  uiSession.setPermissionCheckHandler(() => false);
  uiSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === "clipboard-sanitized-write"),
  );
  uiSession.setDevicePermissionHandler(() => false);
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: "#FAF7F2",
    title: "Lunar Browser",
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "assets/icons/lunar.png"),
    webPreferences: {
      session: uiSession,
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
    },
  });
  window.setMenuBarVisibility(false);
  const devUrl = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined;
  if (
    devUrl &&
    (!["localhost", "127.0.0.1"].includes(new URL(devUrl).hostname) ||
      new URL(devUrl).protocol !== "http:")
  )
    throw new Error(
      "The desktop development URL must be a local HTTP Vite server.",
    );
  const entryUrl =
    devUrl ??
    pathToFileURL(path.join(__dirname, "../../renderer/index.html")).href;
  uiSession.setPermissionCheckHandler(
    (wc, permission, _origin, details) =>
      wc?.id === window.webContents.id &&
      permission === "clipboard-sanitized-write" &&
      details.isMainFrame &&
      trustedEntryUrl(details.requestingUrl ?? wc.getURL(), entryUrl),
  );
  uiSession.setPermissionRequestHandler((wc, permission, callback, details) =>
    callback(
      wc.id === window.webContents.id &&
        permission === "clipboard-sanitized-write" &&
        details.isMainFrame &&
        trustedEntryUrl(details.requestingUrl, entryUrl),
    ),
  );
  uiSession.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: lunar-media:; media-src 'self' lunar-media:; font-src 'self'; connect-src " +
            (devUrl ? "'self' ws: wss:" : "'none'") +
            "; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
        ],
      },
    }),
  );
  const sendOwned = (channel: string, value: unknown) => {
    if (context?.window === window) send(channel, value);
  };
  const reportOwned = (message: string) => sendOwned("browser:error", message);
  const vault = new AIVault(profile());
  const migrationWarnings = migrateLegacyCredentials(profile(), vault);
  const storage = new StorageService(profile());
  const wallpapers = new WallpaperStore(profile());
  await registerWallpaperProtocol(uiSession.protocol, wallpapers);
  storage.warnings.push(...migrationWarnings);
  let sessionTimer: ReturnType<typeof setTimeout> | undefined,
    restoring = true,
    lastSession = "";
  let pendingSession: SessionState | undefined;
  const saveSession = () => {
    if (pendingSession) {
      try {
        storage.saveSession(pendingSession);
      } catch (error) {
        reportOwned(
          error instanceof Error
            ? error.message
            : "Could not save the session.",
        );
      }
      pendingSession = undefined;
    }
  };
  const queueSession = (state: SessionState) => {
    if (restoring || !storage.getSettings().restoreSession) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSession) return;
    lastSession = serialized;
    pendingSession = state;
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(saveSession, 500);
  };
  const shortcut = (action: Shortcut) => sendOwned("browser:shortcut", action);
  const tabs = new TabManager(window, {
    session: webSession,
    settings: () => storage.getSettings(),
    onNavigate: (item) => storage.addHistory(item),
    onChanged: (state) => {
      queueSession(state);
      shield.notify();
    },
    onError: reportOwned,
    onExternal: (url) => openExternalConfirmed(window, url),
    onPopupBlocked: () => shield.recordPopup(),
    onShortcut: shortcut,
  });
  const shield = new LunarShield(
    webSession,
    profile(),
    () => storage.getSettings().shield,
    (id) => tabs.urlForWebContents(id),
    (state) => sendOwned("shield:updated", state),
    () => tabs.getActiveTab()?.info.url ?? "",
  );
  const permissions = new PermissionManager(webSession, window, (id) =>
    tabs.isActiveWebContents(id),
  );
  const downloads = new DownloadManager(webSession, storage, {
    owns: (id) => tabs.ownsWebContents(id),
    notify: (items) => sendOwned("downloads:updated", items),
    error: reportOwned,
    downloadsPath: app.getPath("downloads"),
    onStart: (id) => tabs.downloadStarted(id),
  });
  const extensions = new ExtensionManager(webSession, storage, window);
  await extensions.restore();
  const ai = new AIService(
    vault,
    () => storage.getSettings(),
    (id) => getPageText(tabs, id),
    () => tabs.getActiveTab()?.id ?? null,
  );
  context = {
    window,
    entryUrl,
    storage,
    tabs,
    shield,
    downloads,
    extensions,
    permissions,
    ai,
    wallpapers,
  };
  const saved = storage.getSettings().restoreSession
    ? storage.getSession()
    : { tabs: [], activeIndex: 0 };
  for (const tab of saved.tabs) {
    try {
      tabs.createTab(tab.url, tab.isPinned);
    } catch {
      storage.warnings.push("One saved tab could not be restored.");
    }
  }
  if (!tabs.getAllTabs().length) tabs.createTab();
  const active = tabs.getAllTabs()[saved.activeIndex];
  if (active) tabs.switchTab(active.id);
  restoring = false;
  window.webContents.on("will-navigate", (event, url) => {
    if (!trustedEntryUrl(url, entryUrl)) {
      event.preventDefault();
      if (externalDestination(url))
        void openExternalConfirmed(window, url).catch((error) =>
          reportOwned(
            error instanceof Error
              ? error.message
              : "Could not open the external link.",
          ),
        );
    }
  });
  window.webContents.on("will-redirect", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      try {
        tabs.createTab(url);
        shortcut("activate");
      } catch (error) {
        reportOwned(
          error instanceof Error ? error.message : "Could not open the link.",
        );
      }
    } else if (externalDestination(url))
      void openExternalConfirmed(window, url).catch((error) =>
        reportOwned(
          error instanceof Error
            ? error.message
            : "Could not open the external link.",
        ),
      );
    return { action: "deny" };
  });
  // The same implementation serves keys in browser chrome and focused native pages.
  window.webContents.on("before-input-event", (event, input) => {
    const chromeZoom =
      (input.control || input.meta) && ["+", "=", "-", "0"].includes(input.key);
    if (chromeZoom || tabs.handleShortcut(input)) event.preventDefault();
  });
  window.webContents.on("zoom-changed", () =>
    window.webContents.setZoomFactor(1),
  );
  window.once("ready-to-show", () => window.show());
  window.on("close", () => {
    if (sessionTimer) clearTimeout(sessionTimer);
    pendingSession = tabs.sessionState();
    saveSession();
    // Detach/destroy native children before their owning BrowserWindow goes away.
    ai.dispose();
    tabs.dispose();
    downloads.dispose();
    extensions.dispose();
    shield.dispose();
    permissions.dispose();
  });
  window.once("closed", () => {
    if (context?.window === window) context = null;
  });
  await loadShellWindow(window, entryUrl);
}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    const window = context?.window;
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(() => {
      Menu.setApplicationMenu(null); // All chrome shortcuts are owned here, never a hidden default zoom menu.
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      session.defaultSession.setDevicePermissionHandler(() => false);
      return createWindow();
    })
    .catch((error: unknown) => {
      // Isolated native tests must report startup failures instead of blocking CDP
      // behind a modal dialog on an unattended Windows runner.
      if (!app.isPackaged && process.env.LUNAR_TEST_PROFILE) {
        console.error(
          "Lunar test startup failed:",
          error instanceof Error ? error.message : "Unknown startup failure",
        );
        app.exit(1);
        return;
      }
      dialog.showErrorBox(
        "Lunar startup failed",
        "Lunar Browser could not start. Check your profile permissions and installation, then try again.",
      );
      app.quit();
    });
  app.on("activate", () => {
    if (!context)
      void createWindow().catch(() => {
        dialog.showErrorBox(
          "Lunar startup failed",
          "The application window could not be reopened.",
        );
      });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
