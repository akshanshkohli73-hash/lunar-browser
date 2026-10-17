# Lunar Browser 2.0 — implementation evidence

## Stage 0 — baseline (2026-10-15)

Repository: clean at `abff085` on the assigned `arena/8b00471f-lunar-browser` branch before this work. The Arena branch is fixed; no branch switch or destructive reset was performed. Earlier edits in this session are retained and are being completed rather than discarded.

Actual baseline stack: Electron **33.4.11** (not 31), React 18.3, TypeScript 5, Vite 5.4, Tailwind 3, a sandboxed preload, and one WebContentsView per tab. No project tests or lint script existed.

| Classification                      | Evidence                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compilation verified                | `npx tsc --noEmit` and `npm run build` returned 0; renderer, main and preload bundles were emitted.                                                                                                                                                                                                                                                                      |
| Compiles, native runtime unverified | Native tab creation/navigation, downloads and the original desktop utilities. Electron binary installation failed due to certificate/network restrictions; the sandbox has no Windows GUI, Wine, Xvfb or Chromium.                                                                                                                                                       |
| Broken / misleading                 | Duplicate `notes` metadata overwrites Notes with Now; two Notes bodies mount; shell surface/desktop icons cover browser controls; native views cannot be covered by DOM utilities; no startup snapshot; stop is not wired into the toolbar; extension toggles only change a boolean; several settings are inert; AI demo responses and hard-coded Shield/privacy claims. |
| Partial                             | Tab cleanup and bounds use undocumented destruction/fixed offsets; no redirect/failure/stop consistency; JSON storage swallows writes and trusts corrupted data; bookmarks/history lack complete management; downloads retain native objects and miss final paths; Theme Studio custom tokens are not persisted or shared between shell and browser.                     |
| Missing                             | Sender-authorized and runtime-validated IPC, explicit permission consent, secure main-process AI credentials, session restoration, extension restoration and compatibility fixture, regression tests, CI/release validation.                                                                                                                                             |

Dependency installation: initial `npm install` failed at Electron's binary postinstall. `npm install --ignore-scripts` succeeded for compiler/build tools. No application security flags will be relaxed to bypass environmental restrictions. Initial audit reports 27 dependency advisories (including the old Electron/tooling); supported dependency updates will be checked separately.

## Evidence policy

Passing TypeScript/build/unit/DOM tests is not proof of a native Chromium workflow or Windows runtime. Native tests and Windows packaging are separate release gates. This document is updated with actual commands, results and remaining limitations below.

## Stage 1 — desktop integration

Implemented in `CoquetteDesktopPortfolio.jsx`, `CoquetteDesktopShell.tsx`, `DesktopMenuBar.tsx`, `ui/Icon.tsx`, `index.css` and `tests/desktop.test.tsx`:

- Preserved the original SVG artwork, wallpaper, dock, folders, utilities and animations; formatted the previously minified portfolio for review.
- Fixed a root rendering defect: `e.jsx` received the browser as a **key** instead of `children`. The workspace is now mounted exactly once, outside the utility registry.
- Separated `notes` and original `now` identifiers and bodies; all original dock icons remain present.
- Desktop/browser activation is explicit. Show Desktop reveals original shortcuts; browser activation restores the same workspace and minimizes utilities without changing tabs.
- Added a functional 28px menu bar and application controls; reserved dock space and removed desktop hit targets over the browser.

Verification (all exit 0): `npm run typecheck`; `npm test -- tests/desktop.test.tsx` (**3 tests**); `npm run build` (renderer + CJS main/preload). These are DOM tests, not native GUI tests.

Build tool updates: Vite 8, Electron 44.7.2 and electron-builder 26.15.3 are pinned from registry metadata. Removed unnecessary renderer Node shims and replaced coupled Vite/Electron plugins with explicit CJS esbuild entries. The first dependency upgrade failed on a missing registry tarball for node-abi 4.38.0; override 4.37.0 is pinned to an available, range-compatible tarball. Compiler/build verified against the installed Electron declarations. Native runtime upgrade remains unverified.

## Stages 2–3 — native engine, validated IPC, permissions and Shield

**Implemented:** independent native tab state, explicit startup snapshots/revisions, title/loading/failure/redirect handling, stop/reload, adjacent close selection, exact tab permutation validation, native content ownership, safe shutdown and keyboard handling in both chrome and native pages. Internal pages occupy unprivileged blank history entries, never an app renderer/preload. Renderer-measured geometry replaces fixed offsets; stale active-tab layouts are refused and bounds are clamped in content DIPs. Chrome zoom shortcuts cannot invalidate that coordinate system. Overlaid utilities detach the native view instead of trying to cover it using DOM z-index.

**Files:** `electron/browser/*`, `electron/main/index.ts`, `electron/preload/index.ts`, `shared/{api,schemas,navigation}.ts`, `src/components/{App,useNativeViewport}.tsx/.ts`, `src/state/BrowserContext.tsx`, `electron/security/*`, `electron/blocker/*` and their regression tests.

**Errors fixed:** undocumented destruction and swallowed cleanup exceptions; lossy reorder; missed startup events/focus-dependent resubscriptions; unsafe schemes, redirects and popup ownership; unvalidated/sender-agnostic IPC; sensitive permissions automatically granted; overbroad substring filtering, wrong allowlist context, hard-coded protection labels and inert category controls. Added session grants/denials with reset, fixed external-protocol policy and a default-deny popup policy for otherwise unowned contents.

**Verification:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all exited 0 after interface updates. The first complete core regression gate had 38 passing tests; the final local gate below has 70. The test harness checks native-manager state/resource behavior and the actual interceptor/permission callbacks, but does **not** prove Chromium or device behavior. The real maintained source was fetched through `gh api repos/StevenBlack/hosts/contents/hosts -H 'Accept: application/vnd.github.raw+json'`; parsing the returned 2,258,637-character file accepted 73,631 unique hosts. This is source/parser verification, not a native network-blocking claim.

**Remaining:** native/Windows geometry, display scaling and real permission/device workflows require the separate native/manual gates.

## Stage 4 — library, download lifecycle and durable profile

**Implemented:** add/edit/remove bookmarks with folders and a bookmark bar; searchable history with individual/selected/all deletion; eligible navigation recording with privacy preferences; native download progress/pause/resume/cancel/reveal and safe destination selection; final save paths; native resource release; interrupted-on-restart metadata; opt-in tab URL/order/pin/active-index restoration. Attachment navigations retain the source page address. Controls reflect native resume/cancel capability rather than offering inert actions.

**Files:** `electron/services/{atomic-file,storage}.ts`, `electron/downloads/download-manager.ts`, `shared/{schemas,defaults}.ts`, `src/components/{LibraryView,BookmarkEditor,NotesView,OnboardingModal}.tsx`, main/preload contracts and tests.

**Errors fixed:** JSON reads trusted arbitrary structures, write failures looked successful, bookmark editing was not wired, history clearing left stale UI, download paths were captured before selection, cancelled paused downloads were not handled, completed native objects/listeners remained retained, and late download events could update a later window. Atomic replacement updates memory only after successful writes; history clearing also clears normal backups and owned corrupt-history copies. Session opt-in does not report success if its first snapshot cannot be saved. Notes report local-save failure rather than always claiming auto-save.

**Verification:** strict compiler, lint, test and production build gates exited 0 throughout the completed increment. Tests use real temporary filesystem profiles for restart/corruption/failed-write/privacy semantics and behavioral native-download adapters. Onboarding tests verify the selected search engine is actually saved before dismissal.

**Remaining:** native Save As UI, network-resume server compatibility, Windows file reveal/ACL behavior and legacy Chromium-session import are not verified locally.

## Stage 5 — shared, persistent Theme Studio

**Implemented:** one source of theme state for desktop/browser/utilities, original cream/rose Coquette, green/dark/additional palettes, persistent full custom tokens, safe bounded import/export, color/blur/radius/browser-text-scale/density/tab-shape controls, OS/user reduced motion, visible focus, focus-managed modals and improved preset/button contrast. No page-color rewriting.

**Files:** `src/styles/themes.ts`, `src/state/BrowserContext.tsx`, `src/components/{CoquetteDesktopShell,ThemeStudioView,SettingsView}.tsx`, `src/components/ui/*`, `src/index.css`, `shared/schemas.ts`, `tests/{themes,renderer-state}.test.ts(x)`.

**Errors fixed:** competing shell/App theme state, remounting Theme Studio wrapper, preset-ID-only persistence that discarded custom colors, inert layout controls, malformed CSS imports and success labels before a write succeeded. The save-status label is explicit, avoiding ambiguity with range-output status roles in accessibility tests.

**Verification:** real profile-service + renderer tests verify actual CSS tokens, persisted custom colors/density after a service restart and no applied-theme change/success state on failed writes. Type/lint/test/build gates exited 0. The Chromium renderer smoke exercised real layout/hit testing, original folders, dock restoration, utility opening and resize with no page/console errors. Screenshots were inspected; generated evidence is ignored under `.artifacts/ui/`.

**Remaining:** native Windows appearance and multi-monitor scaling remain manual/native release gates.

## Stage 6 — genuine unpacked extension operations

**Implemented:** `session.extensions.loadExtension/getExtension/removeExtension`, permission review, no file access, persisted paths plus approved manifest hashes, real unload/re-enable/removal, restore errors and native-registry-derived enabled state. Duplicate approved folders do not fabricate extra entries. Failed writes do not cause silent activation or unsafe automatic reloading of a changed manifest.

**Files:** `electron/extensions/extension-manager.ts`, `src/components/ExtensionsView.tsx`, typed contracts, `tests/extensions.test.ts`, `tests/fixtures/extension/*`, `scripts/native-smoke.mjs`.

**Verification:** manager/registry/persistence harness tests pass; the real MV3 loopback content-script fixture is present in the native gate, including unload/reload and no injection into the privileged shell. It has **not** been executed inside native Electron in this sandbox. Compatibility is always labelled partial; manifest version alone is not treated as full compatibility.

**Remaining:** native fixture execution and real compatible third-party extension testing. No Chrome Web Store or extension-action-toolbar claim.

## Stage 7 — optional main-process AI

**Implemented:** OS-encrypted provider vault, migration/scrubbing of known legacy plaintext keys, no key in settings/status/bundles, main-process OpenRouter/Gemini adapters with user-supplied model IDs, bounded responses, 30-second timeouts, rate/auth/transport errors, request cancellation on window shutdown, actual connection testing and fresh active-page-text consent per message. No demo completions or screenshot sharing.

**Files:** `electron/services/{ai-service,ai-extractor,legacy-credentials,response-text}.ts`, `src/components/{AISidebar,SettingsView}.tsx`, contracts and AI/migration/renderer tests. Removed `src/ai/ai-service.ts`, the old renderer-side provider client.

**Verification:** request paths/auth formats were checked against official OpenRouter and Google GitHub sources. Controlled transport tests verify request bodies/headers, actual supported response parsing, no default page extraction, rejected stale-page consent, no key-returning status, failure handling and abort on shutdown. UI tests verify sharing resets after each message. Type/lint/test/build gates exited 0.

**Remaining:** no live provider key was configured; provider connectivity, billing/model availability and Windows OS-encrypted vault behavior are not locally runtime-verified.

## Stage 8 — checks, packaging and release gates

**Implemented:** `npm run check`, `test:ui`, `test:native`, `verify:package`, deterministic CJS main/preload packaging, a seven-size PNG-backed Windows ICO plus source SVG/PNG, NSIS x64 configuration with profile preservation, and separate Linux renderer/Windows native-and-installer CI jobs. Packaging is gated behind native tests; CI artifacts are explicitly unsigned.

**Files:** `package.json`/lockfile, Vite/esbuild/test/lint configs, `scripts/*`, `.github/workflows/verify.yml`, `assets/icons/*`, `.gitignore`, README and release checklist.

**Local commands/results:**

| Command/workflow                                                                                                                                                | Result                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                                                 | Exit 0: strict TypeScript, lint, **70 tests**, renderer + main + preload build, packaging-input validation.                                                                                       |
| `LD_LIBRARY_PATH=/tmp/al2023/lib CHROMIUM_PATH=/tmp/chromium UI_TEST_CHROMIUM_ARGS='["--no-zygote","--disable-gpu","--disable-dev-shm-usage"]' npm run test:ui` | Exit 0: actual headless Chromium renderer UI, single workspace, hit targets, folders, dock restore, Theme Studio and resizing; no console/page errors. This test browser is not the Electron app. |
| Native runtime availability / `npm run test:native`                                                                                                             | Exit 2: explicit BLOCKED result, Electron binary is absent; no native tests executed locally.                                                                                                     |
| `npm run dist:win`                                                                                                                                              | Exit 1: application compilation succeeded; Windows Electron binary acquisition failed with `unable to verify the first certificate`. No installer was produced locally.                           |
| `npm run verify:package`                                                                                                                                        | Exit 0: actual electron-builder configuration schema, compiled entries, icon headers/dimensions and non-destructive NSIS profile policy.                                                          |
| `npm audit --omit=dev`                                                                                                                                          | Exit 0, zero reported production-package advisories. Full audit still has 15 development-tooling advisories (10 moderate, 5 high); not hidden with force upgrades or disabled checks.             |
| `git diff --check`                                                                                                                                              | Exit 0 at the local review gate.                                                                                                                                                                  |

Initial UI-smoke launch failed on missing NSS/NSPR libraries; the isolated headless test browser's packaged runtime libraries were supplied, and the same UI smoke then passed without disabling application web security. Initial packaging-icon conversion tools were unavailable; ICO generation instead used the source SVG, Chromium PNG rasterization and a verified ICO directory. The original tests were kept and expanded, not removed to obtain passes.

**Outstanding release gates:** real native Electron/Windows results, installer GUI/install/uninstall, display scaling, device permissions, supported third-party extensions, live AI configuration and signing. CI execution results are recorded separately when available; adding a workflow is not proof that it ran.
