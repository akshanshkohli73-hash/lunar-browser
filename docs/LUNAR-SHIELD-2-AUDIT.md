# Lunar Shield 2.0 — phase-zero architecture map

Baseline: `fb12ed5` on `arena/8b00471f-lunar-browser`. This audit precedes implementation. The restored workspace exactly matched that commit's tree; it was backed up and fast-forwarded without discarding changes.

## Discovered architecture

- **Runtime:** package/lockfile pin Electron **44.11.3**, not Electron 31; React 18, strict TypeScript, Vite 8, Tailwind 3 and Framer Motion. No browser rebuild or second engine is needed.
- **Main:** `electron/main/index.ts` owns a single frameless shell window, `persist:lunar-ui` and `persist:lunar-web`. Default/UI sensitive permissions are denied. Website tabs and unpacked extensions use the web session; downloads, Shield, permissions and cookie/storage operations attach there, not to the renderer's session.
- **Tabs:** `electron/browser/tab-manager.ts` creates sandboxed `WebContentsView` instances without a website preload. It owns native view attachment, geometry, controlled new tabs/popups, contents-ID attribution, shortcuts and explicit disposal. Preserve it and the existing layout bridge.
- **IPC:** `shared/api.ts` declares narrow operations and strict Zod argument schemas. `electron/preload/index.ts` exposes only named `window.lunarAPI` functions. Main validates the actual shell main-frame sender, exact entry URL and arguments. Websites receive no privileged bridge.
- **Existing protection:** `electron/blocker/filter-engine.ts` already integrates the maintained MPL-2.0 **@ghostery/adblocker 2.20.1** indexed network engine, registrable-domain classification, ABP resource/domain/third-party constraints and exceptions. Reuse/extend it, do not write another parser. Core rules, opt-in StevenBlack hosts and a disclosed four-file EasyPrivacy subset already work.
- **Existing service:** `electron/blocker/shield.ts` owns request cancellation and third-party Cookie/Set-Cookie filtering. Maintained lists are manual, bounded downloads with last-good profile caches. Existing counters are session-only and mix popup actions with requests; there is no evaluated/allowed ledger, history periods, custom rules/lists, independent malicious feed or YouTube profile.
- **Persistence:** `StorageService` uses validated atomic profile files, migrations and explicit failure propagation. Keep existing preferences, downloads, bookmarks, history, notes, wallpaper, themes and opt-in session restoration. New Shield data should be separately versioned and asynchronous for updates/statistics.
- **Permissions/data:** `PermissionManager` already scopes native prompts to secure, active, visible main-frame origins, defaults sensitive access to deny and retains temporary decisions. Existing site data clearing uses Electron's actual `clearData`; cookies have registrable-domain, not exact-origin, deletion scope. Missing: editable persistent Ask/Allow/Block policies, dashboard overview and selected data/time controls.
- **Renderer/design:** the toolbar already opens a native-occluding `Modal` containing `ShieldPanel`; `lunar://shield` renders `ShieldPage`. Preferences have legacy global switches/list controls. Reuse these routes and the Aqua palette, Icon, Modal, GlassPanel and existing clear/readable material roles. Do not introduce SVG optics or change the browser shell.
- **Checks:** 37 existing Vitest files; strict typecheck/lint/build/package policy; full actual Chromium material/layout/input checks; Windows source Electron, unsigned NSIS, packaged-app/video, request interception, multi-tab, permissions, data deletion and restart checks in the existing verification-only workflow. Packaging remains `--publish never`.

## Verified API decisions

Checked installed Electron declarations and the **v44.11.3** upstream `web-request.md` / `session.md` through GitHub:

- `onBeforeRequest` can cancel before delivery. Request IDs, contents IDs, requesting frames and initiator origins are available. `onCompleted` / `onErrorOccurred` provide terminal outcomes. Only **one listener per webRequest event** is supported: extend one owner with explicit attachment/disposal; do not stack listeners per tab.
- Header interception supports the existing third-party cookie-header policy. This is not complete storage partitioning or fingerprinting resistance.
- Both permission check and request handlers are required; device and display-capture handlers remain default-deny. Only expose supported sensitive permission keys.
- `clearData` supports explicit data types and origin matching, but **no time-range argument**. Cookie removal affects related registrable-domain cookies. `clearCache` and `getCacheSize` are session-scoped; per-origin storage byte estimates are not exposed. Time-filtered history can use genuine stored visit timestamps; do not invent time-filtered storage deletion or storage sizes.
- Ghostery supports compiled serialization/deserialization. Compile bounded remote/custom network rules off the request path; retain supported network-only semantics and explicit unsupported-rule feedback.

## Implementation sequence / preservation decisions

1. Extend the existing indexed engine with typed source categories, precise site policy, user rules, bounded generation-invalidated decisions and conservative YouTube compatibility rules.
2. Add one asynchronous versioned config/cache/statistics layer; compile list updates in a worker; persist only aggregate time buckets and bounded privacy-preserving distinct identifiers. Keep diagnostics in memory without request paths, query strings, cookie values or page text.
3. Add trusted-source manifests, validated conditional updates, individual/all update operations, custom trusted subscriptions and separate custom rule CRUD/import/export. Dedicated threat intelligence is never inferred from an ad rule.
4. Extend the single session owner and typed IPC, preserve the existing sandbox/sender boundary, add native-confirmed persistent permission choices and selective data operations.
5. Complete the existing popup/dashboard in Aqua Coquette, with real loading/error/empty states and no invented historical numbers.
6. Run targeted parser/policy/persistence/session/UI tests, existing regressions, actual native request outcomes and full renderer/native/package gates. Keep publication separate.

## External verification boundary

A direct public YouTube HTTPS preflight in this sandbox failed before TLS establishment. Outbound hosts available here are GitHub/npm/PyPI, not YouTube. Controlled classifier/network/media tests must **not** be presented as a real YouTube session. Live homepage/search/watch/embed/Shorts/live/captions/fullscreen/audio/account verification remains a separate acceptance gate unless actual external execution is obtained. Never claim complete YouTube advertisement removal or successful account sign-in from a build or a local fixture.
