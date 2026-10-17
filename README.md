# Lunar Browser 2.0

An Electron desktop browser inside the original Coquette desktop: one browser workspace, native Chromium `WebContentsView` tabs, pastel utilities, and a persistent local profile. Webpages are **not** iframes or screenshots.

**Release status:** implementation and local automated checks are in place; native Windows/installer validation is a separate release gate. See [implementation evidence](docs/IMPLEMENTATION.md) and the [Windows release checklist](docs/WINDOWS-RELEASE.md). Do not treat a successful web build as proof of Windows runtime correctness.

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

- **Desktop:** original artwork, folders, Finder, dock, animations, calendar and other portfolio utilities remain. Show Desktop reveals the original shortcuts; the browser dock button restores the same mounted workspace. Notes and the original Now utility have separate identities.
- **Browser:** create/close/switch/duplicate/pin/mute/reorder tabs, URL/search handling, loading/stop/reload, back/forward, titles, navigation errors and native cleanup. Right-click a tab for its actions. Internal pages use unprivileged blank native history entries; no app HTML or preload is loaded into a webpage tab.
- **Native geometry:** the actual viewport rectangle is measured by `ResizeObserver`; only the active view can be attached. The shell stays at zoom 1, using Electron content DIPs without a device-scale multiplier. Native content is temporarily detached while a desktop utility or modal covers it, because DOM z-index cannot cover a native child view. The webpage is not replaced with a screenshot.
- **Library:** bookmark creation/editing/removal and named folders; a bookmark bar; searchable history with selected/individual/all deletion; real download progress, pause/resume/cancel when the native item permits it, and completed-file reveal. Downloads use Save As with overwrite confirmation and are never executed automatically.
- **Persistence:** validated, atomic JSON writes, recoverable corruption handling, optional tab restoration and visible operation failures. History recording and session restoration are independent preferences.
- **Theme Studio:** original cream/rose Coquette, Pastel Forest, dark and other presets; validated custom colors, corner radius, blur, browser text scale, toolbar density and tab shape. The same state drives browser chrome and desktop utilities. Full custom tokens persist, not just a preset name. Reduced motion respects both the OS and user preference. Arbitrary third-party page colors are not changed.
- **Lunar Shield:** real session request interception, domain-boundary matching, category toggles, top-level-site allowlisting, live counters and cached optional maintained host rules. Main-frame navigation is not blocked by these domain lists. This is not universal ad blocking, cosmetic filtering, fingerprinting prevention or guaranteed video-ad removal.
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

| Data                                                  | Location/policy                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Preferences and custom theme                          | `settings.json`                                                                           |
| Bookmarks and folder names                            | `bookmarks.json`                                                                          |
| Eligible history                                      | `history.json`, up to 10,000 records; common authentication-token/callback URLs excluded  |
| Restored tab URLs/order/pins/active index             | `session.json`, opt-in; no form contents                                                  |
| Download metadata, not downloaded files               | `downloads.json`, up to 200 records; in-progress transfers do not survive process restart |
| Approved unpacked-extension paths and manifest hashes | `extensions.json`; extension files stay in their selected folders                         |
| Optional maintained rules                             | `filter-cache.json`                                                                       |
| Encrypted provider keys                               | `ai-openrouter.bin` / `ai-gemini.bin`, using the OS secret backend                        |
| Website storage                                       | Chromium's separate persistent webpage session                                            |
| Quick Notes                                           | Local storage in the trusted shell's session                                              |

Validated recovery copies use `.bak`; damaged inputs are preserved as `.corrupt-<timestamp>-<uuid>` with restrictive permissions where supported. Failed quarantine/permission operations produce warnings instead of a false preservation claim; UUID suffixes avoid overwriting recovery copies with the same timestamp. Clearing all history clears its normal backup and removes its quarantined recovery copies. Individual deletions sanitize the normal backup; older corrupt copies are removed by Clear All. Clearing records is logical deletion, not a guarantee of forensic erasure from OS/disk backups.

Clearing site data removes webpage-session cookies, storage, cache and authentication state (including extension storage), not bookmarks/history/notes. Clearing finished download records does not delete downloaded files. Turning history off does not remove earlier visits. Uninstall is configured not to delete the profile automatically.

The new session isolation does **not** automatically import all website cookies or Quick Notes from older builds' default Chromium session. Those legacy session files are left in place rather than deleted; sign-in/import migration needs platform validation. Existing JSON bookmark/history/settings files are validated and migrated or preserved for recovery.

## Filter source maintenance

Core rules are versioned in `electron/blocker/filter-engine.ts` and reviewed in application releases. The optional [StevenBlack Unified Hosts](https://github.com/StevenBlack/hosts) source is fetched **only on Refresh**, via its fixed public GitHub endpoint, with a 30-second timeout and an 8 MB read limit. Errors are visible, and valid cached rules remain usable. A reserved `ads.lunar-shield.test` rule supports controlled native interception tests without contacting an ad server.

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
npm run dist:win        # Windows x64 NSIS installer, under release/
```

The Windows workflow requires native tests to pass **before** packaging/upload. CI artifacts are unsigned internal builds, not signed public releases. Authenticode signing, installer GUI testing and the manual [release checklist](docs/WINDOWS-RELEASE.md) remain required before distribution.

At the last local gate (2026-10-17): 76 automated tests passed across 14 files, all compiler/lint/build checks passed, and the headless Chromium renderer smoke passed. Native testing was blocked by an unavailable Electron runtime; Windows packaging reached binary acquisition and failed certificate validation. The full dependency audit still reports 15 development-tooling advisories (10 moderate, 5 high), notably Tailwind 3's transitive glob/parser tooling; `npm audit --omit=dev` reported zero. This is not a claim that compilation or an audit alone proves the browser secure.

**CI access is now working (2026-10-17):** the branch and workflow are published. The renderer/regression/Chromium job passed. Windows’ POSIX-only download-test fixture was corrected, and [run 39014043940](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39014043940) passed all strict Windows checks. Native preflight then found no runtime because Electron 44 uses a separate binary installer; CI now explicitly runs `npm run install:electron` with normal TLS/checksum verification. A native-and-installer rerun remains required; no installer or native pass is claimed yet.
