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

**Verification:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all exited 0 after interface updates. The first complete core regression gate had 38 passing tests; the final local gate below has 79. The test harness checks native-manager state/resource behavior and the actual interceptor/permission callbacks, but does **not** prove Chromium or device behavior. The real maintained source was fetched through `gh api repos/StevenBlack/hosts/contents/hosts -H 'Accept: application/vnd.github.raw+json'`; parsing the returned 2,258,637-character file accepted 73,631 unique hosts. This is source/parser verification, not a native network-blocking claim.

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
| `npm run check`                                                                                                                                                 | Exit 0: strict TypeScript, lint, **79 tests across 15 files**, renderer + main + preload build, packaging-input validation.                                                                       |
| `LD_LIBRARY_PATH=/tmp/al2023/lib CHROMIUM_PATH=/tmp/chromium UI_TEST_CHROMIUM_ARGS='["--no-zygote","--disable-gpu","--disable-dev-shm-usage"]' npm run test:ui` | Exit 0: actual headless Chromium renderer UI, single workspace, hit targets, folders, dock restore, Theme Studio and resizing; no console/page errors. This test browser is not the Electron app. |
| Native runtime availability / `npm run test:native`                                                                                                             | Exit 2: explicit BLOCKED result, Electron binary is absent; no native tests executed locally.                                                                                                     |
| `npm run dist:win`                                                                                                                                              | Exit 1: application compilation succeeded; Windows Electron binary acquisition failed with `unable to verify the first certificate`. No installer was produced locally.                           |
| `npm run verify:package`                                                                                                                                        | Exit 0: actual electron-builder configuration schema, compiled entries, icon headers/dimensions and non-destructive NSIS profile policy.                                                          |
| `npm audit --omit=dev`                                                                                                                                          | Exit 0, zero reported production-package advisories. Full audit still has 15 development-tooling advisories (10 moderate, 5 high); not hidden with force upgrades or disabled checks.             |
| `git diff --check`                                                                                                                                              | Exit 0 at the local review gate.                                                                                                                                                                  |

Initial UI-smoke launch failed on missing NSS/NSPR libraries; the isolated headless test browser's packaged runtime libraries were supplied, and the same UI smoke then passed without disabling application web security. Initial packaging-icon conversion tools were unavailable; ICO generation instead used the source SVG, Chromium PNG rasterization and a verified ICO directory. The original tests were kept and expanded, not removed to obtain passes.

**Outstanding release gates:** real native Electron/Windows results, installer GUI/install/uninstall, display scaling, device permissions, supported third-party extensions, live AI configuration and signing. CI execution results are recorded separately when available; adding a workflow is not proof that it ran.

## Follow-up verification — 2026-10-17

- Reinstalled the locked dependencies using `npm ci --ignore-scripts` after the transient dependency directory was absent. The clean install exited 0. Corrected the declared Node range to the actual ESLint/Vitest requirements: `^22.13.0 || ^24.0.0 || >=26.0.0`.
- Fixed a startup race: Theme Studio persistence and Preferences controls now wait for the authoritative saved-profile bootstrap rather than permitting defaults-based writes while it is pending. A real temporary-profile regression verifies the save is blocked during loading and works after the saved preferences arrive.
- Replaced the new-tab clock's unconditional one-second interval with a minute-aligned, focus-resynchronized clock. It has no timer in an inactive/covered workspace or on a non-new-tab page, and removes its timer/listener on cleanup. Three timer regressions cover boundaries, suspension/resumption, focus and disposal.
- Fixed misleading corrupt-file recovery reporting: a failed rename no longer claims the original was preserved, and failed permission restriction is reported separately. Recovery filenames include UUIDs so equal timestamps do not overwrite previous originals. Clear All History recognizes both the legacy timestamp-only and the new UUID-suffixed owned copies. Real-filesystem regressions verify denied quarantine, preservation of two same-timestamp inputs and clearing of both supported formats.
- The new bootstrap regression initially failed TypeScript with `TS2459` because its type was imported through a module that did not export it. Corrected the import to its defining `electron/types.ts` module; no type suppression or test removal was used.
- Latest `npm run check`: **exit 0, 14 files / 76 tests**, strict TypeScript, ESLint, renderer/main/preload builds and actual packaging-input validation. Latest production-package audit: **exit 0, zero advisories**. Actual Chromium renderer smoke passed after the clock/bootstrap changes; its screenshots were inspected. Fresh native preflight: **exit 2 BLOCKED**, with no native tests executed. Generated artifacts, dependency directories and browser test tooling remain outside tracked source; a secret-pattern source scan found no matches.

### Attempted Windows CI execution

The core implementation and release-gate definition were committed on the assigned branch. `git push origin arena/8b00471f-lunar-browser` then exited **1**, with GitHub rejecting the update:

> refusing to allow a GitHub App to create or update workflow `.github/workflows/verify.yml` without `workflows` permission

The remote branch lookup was empty, and `gh run list --branch arena/8b00471f-lunar-browser` returned no runs. This is a **workflow-write permission blocker**, not a passing Windows test or an installer result. No default branch was merged, no release was published, and no native gate was removed to bypass the restriction. The follow-up fixes are also retained on the same local session branch.

To unblock: update/reconnect the Arena GitHub integration with permission to write workflow files, or push the same branch using an already authorized normal Git setup. Then review the real Windows CI outcome and continue the manual release checklist. Never paste tokens, signing keys or passwords into chat. Native Windows runtime, installed-app workflows and live AI remain unverified until their gates actually execute.

## Windows CI permission resolved and first run — 2026-10-17

The next assigned-branch push succeeded, publishing `eea5ada960d842811a4fad6d19d77b3a316d5a7d`. The workflow was registered and [run 39013794819](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39013794819) actually executed:

- **Linux renderer/regressions: success.** Clean install, strict check (76 tests), production audit, real Chromium renderer smoke and evidence upload all completed.
- **Windows: regression failure.** Normal `npm ci` succeeded, but `tests/downloads.test.ts:87` compared the production native path `\downloads\_CON.exe` with a hard-coded POSIX string `/downloads/_CON.exe`. This was a platform-specific test-fixture defect, not justification for changing the production path API or weakening the assertion. Native integration, installer packaging and installer upload were correctly skipped.
- Fixed all download-fixture destinations to use a real temporary directory and `path.join`, retaining exact safe-name, destination, overwrite-confirmation and final-save-path assertions. Latest local `npm run check` exited 0 with **76 tests across 14 files**, all production builds and packaging-input validation; `npm audit --omit=dev` exited 0.
- Full CI log downloads redirected to an inaccessible Actions-hosted log server in this sandbox. Native failures now also emit escaped GitHub check annotations and remain hard failures, so the actual diagnostic is available through the GitHub API without bypassing network or application security restrictions.

A follow-up CI run is required for these corrections. The earlier permission error is historical/resolved; native Windows and installer results remain pending, not successful.

## Windows strict checks pass; explicit runtime setup — 2026-10-17

[Run 39014043940](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39014043940), revision `29b4e67`, passed all strict Windows checks and the Linux regression/Chromium job. Native preflight stopped immediately and packaging was skipped. Inspection of the actual locked Electron 44.7.2 package confirmed it has **no postinstall script**: its `install-electron` binary is separate, and `index.js` otherwise downloads opportunistically on first require. The native preflight deliberately avoids that side effect, so `npm ci` was insufficient runtime setup.

Added `npm run install:electron`, invoking the locked package’s real installer, and an explicit Windows CI runtime-install step before the checks/native test. TLS and bundled checksum verification remain enabled. The preflight message now names the exact setup command. The CI runtime/native steps preserve the child exit status and also expose startup/preflight errors in check annotations, including failures outside the native test’s assertion catch. Native tests and installer packaging remain unverified until the next run actually executes them; a dependency-install or compiler pass is not promoted to native success.

## Real runtime startup ordering defect — 2026-10-17

[Run 39014362217](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39014362217), revision `2d05c34`, successfully installed the pinned Windows Electron binary, passed Windows strict checks and passed the Linux renderer job. Actual native launch then timed out after connecting both Node and Chromium debugging endpoints; installer packaging remained skipped.

The shell called and awaited `webContents.setVisualZoomLevelLimits(1, 1)` before `window.loadURL`. The official Electron 44.7.2 implementation in `lib/browser/api/web-contents.ts` confirms this method invokes renderer-side IPC, so waiting before a renderer exists prevents startup from reaching page loading. Extracted the small typed `loadShellWindow` lifecycle helper: set shell zoom to 1, await the real page load, then await visual zoom setup. Three regressions verify that the load begins before renderer IPC and that both load and zoom failures propagate rather than reporting successful startup. Latest local full check: **exit 0, 79 tests / 15 files**, strict TypeScript/lint/build/input validation; production audit zero.

The native test still launches the actual binary with explicit executable path; it does not substitute Playwright’s generic Chromium loader, which appends flags including disabled extensions and a mock keychain. No sandbox/web-security relaxation or timeout extension was used to hide this startup failure. A new Windows native run is required to validate the fix in the actual engine.

## Native startup fixed; real download verification — 2026-10-17

[Run 39014721038](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39014721038), revision `39558f0`, passed all 79 tests on Windows and Linux. Actual Windows Electron now starts and passed the native assertions preceding download verification: independent page tabs and back/forward, page API isolation, unsafe navigation/IPC rejection, actual measured geometry/resize/maximize/restore, utility detachment/restore, real Shield request interception enabled/disabled, and actual MV3 content-script load/unload with shell isolation. These are partial native results, not a full-suite pass.

The download gate then failed reading the expected destination (`ENOENT`) despite completed metadata. The fixture now waits for the actual filesystem result rather than assuming a completion-event/disk-observability ordering, still requires exact downloaded bytes, and captures the real native item's initial/final save paths plus persisted metadata in any failure. No production download path or assertion was weakened. A follow-up run is required to distinguish a timing race from an actual destination-handling defect; native-suite completion and packaging remain pending.
