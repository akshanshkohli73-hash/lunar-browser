# Lunar Browser 2.0

An Electron desktop browser inside the original Coquette desktop: one browser workspace, native Chromium `WebContentsView` tabs, pastel utilities, and a persistent local profile. Webpages are **not** iframes or screenshots.

**Public 2.5.0 prerelease — Liquid Engine:** [Download the Windows x64 installer](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.5.0/Lunar-Browser-2.5.0-win-x64.exe) · [Release notes and SHA-256 checksum](https://github.com/akshanshkohli73-hash/lunar-browser/releases/tag/v2.5.0). One shared WebGL2 atlas/texture path delivers actual wallpaper refraction, dynamic specular, finite deformation and coordinated material morphs. Existing image/video playback, Coquette identity, browser/widgets and security remain. **224 tests / 28 files**, strict builds/audit, actual Chromium and [Windows source/packaged/NSIS gates](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42629657311) passed from `a7e3b2b`. The unchanged verified installer was manually published after source/archive/extracted-file/release-upload/download checks. **Authenticode: NotSigned** — the user chose an unsigned prerelease after signing availability was checked; no publisher trust or Windows-warning bypass is claimed. **Back up your profile:** dashboard v1–v3 migrate to v4, which older versions do not understand. Software CI recorded stalls/dropped video frames; no 60-FPS/hardware/4K/battery certification is claimed. [Architecture, measurements and limitations](docs/LIQUID-ENGINE.md) · [Publication provenance](docs/RELEASE-2.5.0.md). Previous releases remain unchanged; updates stay manual.

**Public 2.4.1 prerelease — 50 MB background images:** [Download the Windows x64 installer](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.1/Lunar-Browser-2.4.1-win-x64.exe) · [Release notes and checksum](https://github.com/akshanshkohli73-hash/lunar-browser/releases/tag/v2.4.1). Local image wallpapers now support **50 MB**, with matching native validation and Studio text; videos stay **150 MB** and the 20-file / 300 MB profile quota is unchanged. [Run 42600154938](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42600154938) from `e60fdf2` passed **210 tests / 26 files**, actual Chromium, Windows source integration, unsigned NSIS packaging and packaged-app integration. Both native executions accepted/decode-tested exactly 50 MB and rejected one byte over. The unchanged verified installer was manually published after archive/extracted-file/upload/download checks; [exact provenance and limitations](docs/RELEASE-2.4.1.md). It is an **unsigned prerelease** with manual updates; previous releases remain unchanged.

**Public 2.4.0 prerelease — Organic Liquid Glass (2026-11-07):** [Download the Windows x64 installer](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.0/Lunar-Browser-2.4.0-win-x64.exe) · [Release notes and SHA-256 checksum](https://github.com/akshanshkohli73-hash/lunar-browser/releases/tag/v2.4.0). Shared sage/ivory materials, controlled optional SVG backdrop displacement, deterministic adaptive tint, one settling pointer/proximity scheduler, fluid panels/settings/dock, upgraded widgets and 14 real material/motion controls. Dashboard-v3 migration retains old content, layouts, themes, wallpaper and quality choices. **205 tests / 26 files**, typecheck/lint/build/package validation, actual Chromium pixel/layout/interaction/fallback checks, production dependency audit (0 vulnerabilities), Windows source/packaged integration and unsigned NSIS packaging [passed from source `f81a83f`](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42356488823). The unchanged verified installer was manually published after archive/installer/upload/download integrity checks. [Exact release bytes and limitations](docs/RELEASE-2.4.0.md) · [Implementation and evidence report](docs/ORGANIC-GLASS.md). No automatic publisher or update feed was enabled.

**Previous verified candidate: 2.3.0 / Liquid Glass 2.0.** [Run 42349969939](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939) passed Windows source/packaged integration and produced an [unsigned test installer](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939/artifacts/13565196723). This is historical 2.3.0 evidence, not proof for 2.4.0. [Report](docs/LIQUID-GLASS-2.md).

**Public 2.2.0 prerelease (2026-11-07):** [Download the Windows x64 installer](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.2.0/Lunar-Browser-2.2.0-win-x64.exe) · [Release notes and SHA-256 checksum](https://github.com/akshanshkohli73-hash/lunar-browser/releases/tag/v2.2.0). This is the unchanged verified Liquid Glass build: reusable materials on all nine existing widgets, real global/per-widget controls, previews, migration/persistence and supported editing handles. **180 tests / 23 files**, Chromium UI checks, real Windows native and **packaged-app** glass/video/DND/resize/restart tests, and NSIS packaging passed. [Exact files, controls, evidence, hash and limitations](docs/LIQUID-GLASS.md).

**Unsigned preview:** Windows may warn or block the installer; do not disable OS or antivirus protections. Back up your profile before upgrading. This manual GitHub prerelease does not add trusted signing, an automatic publisher, auto-updates, an npm package or an app-store listing.

The [2.1.0 control-center build](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/40109158835/artifacts/12565594561) remains the verified pre-glass baseline. Its mappings and historical checks are in [CONTROL-CENTER.md](docs/CONTROL-CENTER.md).

The [previous 2.0.1 installer](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/40104248641/artifacts/12563739004) remains historical evidence of the installed baseline. It does not contain the new control-center changes.

## Run the desktop application

Use **Node 22.13+ within 22.x, or Node 24 LTS** (the checked development-tooling ranges are declared in `package.json`). Windows x64 is the primary packaging target.

```powershell
npm ci
npm run install:electron
npm start
```

`npm run install:electron` explicitly downloads and verifies the pinned Electron runtime. Electron 44 does not download it during `npm ci`; the normal Electron CLI can also download it on first launch, but the native-test preflight intentionally does not. `npm start` builds the renderer, main process and sandboxed preload, validates packaging inputs, then launches Electron. Installing Electron requires access to GitHub's release-asset download hosts and a working system certificate chain. Do not disable TLS verification to work around an installation failure.

Development:

```sh
npm run dev             # Vite + real Electron; restart for main/preload source changes
npm run dev:renderer    # UI-only preview, explicitly without a native browser engine
```

The web preview intentionally disables operations requiring Electron. It does not fabricate tabs, history, downloads, filtering, provider replies, or installed extensions.

Pinned native/build versions: Electron **44.7.2**, electron-builder **26.15.3**, Vite **8.3.4**. React 18, TypeScript 5 and Tailwind 3 are retained. The lockfile defines the complete dependency graph.

## Implemented application paths

- **Desktop:** original Coquette frame/art direction with one permanent browser workspace and a shared registry for Home, Widgets, Appearance, Lunar Shield, Library, Activity, Downloads, Extensions and Settings. The old portfolio dock/desktop/launcher is not mounted by the application. Previous Quick Notes remain accessible inside Widgets.
- **Browser:** create/close/switch/duplicate/pin/mute/reorder tabs, URL/search handling, loading/stop/reload, back/forward, titles, navigation errors and native cleanup. Right-click a tab for its actions. Internal pages use unprivileged blank native history entries; no app HTML or preload is loaded into a webpage tab.
- **Native geometry:** the actual viewport rectangle is measured by `ResizeObserver`; only the active view can be attached. The shell stays at zoom 1, using Electron content DIPs without a device-scale multiplier. Native content is temporarily detached while a desktop utility or modal covers it, because DOM z-index cannot cover a native child view. The webpage is not replaced with a screenshot.
- **Library:** bookmark creation/editing/removal and named folders; a bookmark bar; searchable history with selected/individual/all deletion; real download progress, pause/resume/cancel when the native item permits it, and completed-file reveal. Downloads use Save As with overwrite confirmation and are never executed automatically.
- **Persistence:** validated, atomic JSON writes, recoverable corruption handling, optional tab restoration and visible operation failures. History recording and session restoration are independent preferences.
- **New tab:** a versioned, persistent 12-column dashboard with collision-aware drag/keyboard movement, supported resize sizes, widget configuration, hide/remove/add/reset and explicit save/cancel. The nine widgets are clock/date, search, bookmarks, manual/consented Open-Meteo weather, local calendar/events, a shared saved dashboard notepad, opt-in recent history, custom shortcuts and a local focus timer. No fabricated weather or recent-site records.
- **Wallpaper:** built-in Coquette meadow/rose/midnight art or native-picked PNG/JPEG/WebP/MP4/WebM copies. Profile-owned, magic-checked, size/quota-limited files are served by a UI-session-only range-aware protocol; no renderer filesystem paths or media uploads. Preview/apply/reset, fit/position/overlay/blur/readability, loop, muted playback and manual audio controls are real. Inactive/hidden/unfocused media pauses; OS/app reduced motion disables automatic video/transitions. Personal codecs and hardware still need native verification.
- **Organic Glass:** shared optical/CSS/Simple/solid backends, contrast-safe materials, immediate material/motion preview/apply/cancel, proximity dock, reduced-motion/transparency and forced-color fallbacks. [Exact controls, schema migration, rendering design and evidence](docs/ORGANIC-GLASS.md).
- **Theme Studio:** green/cream Coquette, retained Rose Coquette, Pastel Forest, dark and other presets; validated custom colors, corner radius, blur, browser text scale, toolbar density and tab shape. Live custom preview/apply/cancel spans browser chrome and desktop utilities; dashboard/dock controls use a separate explicit draft. Preset cards save immediately, as labeled. Full custom tokens persist, not just a preset name. Reduced motion respects both the OS and user preference. Arbitrary third-party page colors are not changed.
- **Lunar Shield:** real session HTTP(S)/WebSocket-handshake interception using pinned Ghostery network ABP parsing, a small built-in domain core, optional converted StevenBlack hosts and a disclosed four-file EasyPrivacy subset. Balanced third-party/strict network modes, category opt-outs, per-site pause, bounded path-free rule diagnostics, actual counters, source timestamps/errors and last-good manual-update caches. Network third-party Cookie/Set-Cookie stripping is not JS storage isolation; opt-in main-navigation HTTPS upgrades have no silent insecure fallback. No main-frame list blocking, cosmetics, scriptlets, full filter-list compatibility, Brave parity, fingerprinting/anonymity or guaranteed video-ad removal is claimed.
- **Extensions:** native unpacked-extension loading, permission review, native-registry-derived status, real unload/re-enable/removal and startup restoration. Manifest changes require renewed approval. Electron exposes only part of the Chrome API surface; Chrome Web Store installation, extension-action toolbar UI, and complete V2/V3 compatibility are **not** claimed. The real content-script fixture is under `tests/fixtures/extension`; local tests exercise the manager adapter, while its Chromium behavior belongs to the native test gate.
- **Optional AI:** OpenRouter and Gemini text adapters in the main process, user-supplied current model IDs, OS-encrypted keys, connection testing, bounded response reads, timeouts, cancellation and useful provider errors. AI is off initially. Each message needs a fresh, explicit checkbox to share active-page text; screenshots are not sent. No demo answers are returned when configuration is missing.

The preserved portfolio Messages/Mail/availability content is original desktop utility content, not a new messaging service or evidence of an AI-provider connection. Previously decorative settings and unsupported provider claims have been removed rather than represented as functioning features.

## Security boundaries

The shell and webpages use separate sessions (`persist:lunar-ui` and `persist:lunar-web`). Both have context isolation, disabled Node integration, sandboxing and web security. Only the shell has the narrow preload bridge. Main-process operations validate the exact owning main frame, its entry URL and a strict runtime request schema.

Web navigation accepts HTTP/HTTPS; only known internal destinations are handled as chrome state. `file:`, `javascript:`, `data:` and privileged browser schemes cannot be used to navigate a native webpage into the application. New windows default to deny, with controlled new-tab handling for supported destinations. Validated mail/telephone protocols require native confirmation; mail-client attachment parameters are rejected.

Camera/microphone, location, notifications and clipboard reads require active top-level secure-origin consent. Session grants and denials can be reset. Background/cross-origin frames, hidden tabs and unsupported permissions are denied. Screen capture, USB, serial and arbitrary filesystem APIs are not exposed as supported features.

AI keys are never returned by settings/status calls. Electron `safeStorage` must report a real encryption backend; Linux plaintext fallback is refused. Known legacy plaintext settings keys are migrated/scrubbed. No unrestricted IPC channel invocation, filesystem access, Node object or `ipcRenderer` is exposed to page content.

## Profile and clearing data

Files live in Electron's `app.getPath('userData')` (normally the application's folder under `%APPDATA%` on Windows). Native test runs use an isolated temporary profile, never your normal profile.

| Data                                                    | Location/policy                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Preferences and custom theme                            | `settings.json`                                                                           |
| Bookmarks and folder names                              | `bookmarks.json`                                                                          |
| Eligible history                                        | `history.json`, up to 10,000 records; common authentication-token/callback URLs excluded  |
| Restored tab URLs/order/pins/active index               | `session.json`, opt-in; no form contents                                                  |
| Download metadata, not downloaded files                 | `downloads.json`, up to 200 records; in-progress transfers do not survive process restart |
| Approved unpacked-extension paths and manifest hashes   | `extensions.json`; extension files stay in their selected folders                         |
| Dashboard / widget configuration, note and local events | `dashboard.json` (validated version 1, atomic writes and recovery)                        |
| Local image/video wallpapers                            | `wallpapers/<UUID>.<ext>`; no source paths in renderer state                              |
| Optional maintained rules                               | `filter-cache.json` / `privacy-filter-cache.json`                                         |
| Encrypted provider keys                                 | `ai-openrouter.bin` / `ai-gemini.bin`, using the OS secret backend                        |
| Website storage                                         | Chromium's separate persistent webpage session                                            |
| Quick Notes                                             | Local storage in the trusted shell's session                                              |

Validated recovery copies use `.bak`; damaged inputs are preserved as `.corrupt-<timestamp>-<uuid>` with restrictive permissions where supported. Failed quarantine/permission operations produce warnings instead of a false preservation claim; UUID suffixes avoid overwriting recovery copies with the same timestamp. Clearing all history clears its normal backup and removes its quarantined recovery copies. Individual deletions sanitize the normal backup; older corrupt copies are removed by Clear All. Clearing records is logical deletion, not a guarantee of forensic erasure from OS/disk backups.

Clearing all site data removes webpage-session cookies, storage, cache and cached HTTP authentication (including extension storage), not bookmarks/history/notes/dashboard settings. Per-site clearing requires native confirmation and uses Chromium's origin filter for storage/cache; **cookies are removed at the shared registrable-domain level**, so related subdomains/ports can also be signed out. Cookie metadata exposes only the count matching the requested page, never values. Permission resets do not grant access or stop already-running capture; reload affected pages. Clearing finished download records does not delete downloaded files. Turning history off does not remove earlier visits. Uninstall is configured not to delete the profile automatically.

The new session isolation does **not** automatically import all website cookies or Quick Notes from older builds' default Chromium session. Those legacy session files are left in place rather than deleted; sign-in/import migration needs platform validation. Existing JSON bookmark/history/settings files are validated and migrated or preserved for recovery.

## Filter source maintenance

The pinned `@ghostery/adblocker` **2.20.1** parser handles supported network rules only. Core rules are versioned in `electron/blocker/filter-engine.ts`. Optional [StevenBlack Unified Hosts](https://github.com/StevenBlack/hosts) and the four-file [EasyPrivacy network subset](https://github.com/easylist/easylist/tree/master/easyprivacy) are fetched **only on explicit Refresh** from fixed GitHub endpoints, with time/size limits, no redirects and per-file validation. Invalid/oversized/failed responses or cache-write failures retain last-good rules. A reserved `ads.lunar-shield.test` rule supports controlled native tests without contacting ad servers.

The EasyPrivacy subset is not the full subscription. The UI lists the exact sources, license, counts and last successful download time (not an independent upstream freshness guarantee). Source attribution and supported/excluded filter types are in [`assets/licenses/FILTER-SOURCES.txt`](assets/licenses/FILTER-SOURCES.txt); runtime license texts are generated and included in installer inputs.

## AI configuration

1. Open Preferences → Optional AI and enable it if desired.
2. Select OpenRouter or Gemini; enter a current model identifier from your provider account.
3. Save the model and key. OS-encrypted storage must be available.
4. Test connection. This sends a small text request with **no** page context and may use credits.
5. In the sidebar, explicitly select page sharing for each message that needs it.

Request formats were checked against the official [OpenRouter SDK request](https://github.com/OpenRouterTeam/typescript-sdk/blob/main/src/funcs/chatSend.ts), [OpenRouter authentication](https://github.com/OpenRouterTeam/typescript-sdk/blob/main/src/lib/security.ts), [Google client configuration](https://github.com/googleapis/python-genai/blob/main/google/genai/_api_client.py) and [Gemini service definition](https://github.com/googleapis/googleapis/blob/master/google/ai/generativelanguage/v1beta/generative_service.proto). Adapter tests use controlled responses. A live provider connection has not been verified in this workspace; no real provider key was configured.

## Checks and packaging

```sh
npm run check           # strict typecheck + lint + tests + renderer/main/preload build
npm run verify:package  # config schema, compiled entry points, icon and installer inputs
npm audit --omit=dev
npx playwright install chromium
npm run test:ui         # real Chromium renderer preview; not native Electron
npm run install:electron # install the locked native runtime with normal TLS/checksums
npm run test:native     # real Electron integration; fails explicitly if runtime unavailable
npm run dist:win        # Windows x64 NSIS installer, under release/; never publishes
```

The existing Windows workflow gates NSIS packaging on native tests. Both packaging commands retain `--publish never`; uninstall retains the profile. Unsigned internal builds remain supported: no paid signing service, certificate or release publishing is required. Never disable Windows/antivirus protection to run an unsigned build.

### Initial local verification (2026-10-17; superseded by Windows results above)

- `npm run check`: **114 tests / 19 files passed**, typecheck/lint, renderer/main/preload build and packaging-input checks passed.
- `npm run test:ui`: real Chromium renderer checks passed; covers workspace hit targets, original shortcuts, Theme Studio, draft wallpaper/widget/dock preview/cancel and narrow-window calendar/tiles/dock layout. This is **not** an Electron browser-engine test.
- `npm audit --omit=dev`: **0 advisories**. Full audit: **15 development-tooling advisories** (10 moderate / 5 high), disclosed rather than force-upgraded or suppressed.
- `npm run test:native`: **BLOCKED, exit 2**, missing pinned Electron binary; no native cases executed here. Native image decoding/session scope, scoped data deletion, new dashboard restart/geometry cases and Windows packaging/installed GUI/video/device/TLS/provider behavior still require execution on a suitable machine.
- Build emits existing Framer Motion `use client` directive warnings; production output succeeds. Main renderer is ~493 kB (152 kB gzip); Theme Studio, settings and dashboard editor load as separate chunks.

### Historical evidence — not this working tree

[Earlier Windows/Linux CI run 39016225904](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39016225904) exercised the pre-dashboard baseline and built an unsigned NSIS artifact. It does **not** validate or contain the current uncommitted integration. Earlier implementation/hash/installer records are retained in [the historical implementation log](docs/IMPLEMENTATION.md) and [Windows checklist](docs/WINDOWS-RELEASE.md); use the [current log](docs/UNIFIED-EXPERIENCE.md) for this task. No fresh installer, public release, signing workflow or beta workflow was created.
