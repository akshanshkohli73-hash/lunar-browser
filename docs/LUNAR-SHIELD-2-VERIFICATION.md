# Lunar Shield 2.0 — implementation and verification

> Working-branch implementation, not a release. Application version stays 2.6.0.
> Baseline: `fb12ed5` on `arena/8b00471f-lunar-browser`. No published installer,
> update channel, signing policy, profile data or previous release is replaced.

## Architecture and changes

The architecture audit is in [LUNAR-SHIELD-2-AUDIT.md](LUNAR-SHIELD-2-AUDIT.md).
The implementation reuses Electron 44.11.3, its `persist:lunar-web` session,
real sandboxed `WebContentsView` tabs and the installed MPL-2.0
`@ghostery/adblocker` 2.20.1 indexed matcher. It adds no runtime dependency,
second browser engine, webpage preload, scriptlet injection or SVG material.

- **Matching:** `electron/blocker/filter-engine.ts` extends the existing engine
  with exact-origin policy and indexed host/resource allowances; explicit custom
  exceptions and blocks; cross-subscription exceptions; distinct threat-feed
  categorization; 4,096 bounded, invalidated decisions; readable rule reasons.
  Ghostery's indexed exception bucket is queried explicitly: `match()` alone
  does not report exception-only sources. Unmatched traffic is permitted.
- **Data sources:** `sources.ts`, `subscriptions.ts` and
  `shared/filter-source-url.ts` implement restricted public HTTPS data downloads,
  no redirects/credentials, bounded streaming input, raw+ETag caches,
  SHA-256/engine/source validation, daily due checks, queued asynchronous
  updates, conditional 304s, last-good recovery, individual reset/removal and
  cancellation. Worker compilation is in `compiler.ts` / `compile-worker.ts`.
  `scripts/build-electron.mjs` and `verify-package.mjs` include its actual entry.
- **State/persistence:** `shared/shield.ts` defines strict operations/configuration;
  `profile-file.ts` serializes bounded validated asynchronous atomic writes and
  recovery. A failed primary replacement rolls back/removes its uncommitted
  backup, so a failed remembered Allow is not recovered as an accepted policy.
  `statistics.ts` stores genuine UTC-day/all-time aggregates and salted bounded
  distinct IDs, not event logs, site strings, page titles or full request URLs.
- **Session owner:** `shield.ts` owns exactly five webRequest listeners per
  attached session. Evaluations deduplicate request IDs/redirects; a block needs
  both a blocking decision and Chromium's terminal `ERR_BLOCKED_BY_CLIENT`.
  Other terminal failures remain allowed-with-error, unresolved/evicted requests
  are not guessed. Cookie header actions, popups and HTTPS upgrades are separate.
  Callback completion, session ownership, bounded diagnostics, reset/update
  races, lifecycle cancellation and awaited disposal are explicit.
- **Privileges:** existing `shared/api.ts`, preload and main sender checks are
  retained and extended with named schema-validated calls. Native dialogs govern
  persistent sensitive Allow, exports and destructive data operations.
  `electron/security/index.ts` supports actual media/audio, location,
  notifications and clipboard-read permissions, not invented device grants.
  `electron/services/privacy-data.ts` maps supported Electron cookie/cache/storage
  and recorded-history deletion, with scope/range validation and no cookie values.
  `tab-manager.ts` retains its architecture and delegates popup policy/attribution.
- **UI:** `ShieldPanel.tsx` is the compact toolbar surface. New
  `src/components/shield/{useShield,ShieldDetails,ShieldDashboard}` provide eight
  dashboard sections, timestamped metrics, source/rule editors, exact-site
  allowances, permissions, data controls and independent YouTube controls. Reads
  and mutations guard against stale origin/reply races. Existing App,
  ControlPages, SettingsView and dashboard wording are integrated, not a new shell.
  CSS uses existing Aqua/GlassPanel controls, readable surfaces, fixed hit targets,
  responsive layout, focus and reduced-motion/forced-color/coarse-pointer rules.

## Sources, formats and licensing

Full notices and exact component filenames are in
[`assets/licenses/FILTER-SOURCES.txt`](../assets/licenses/FILTER-SOURCES.txt).
External lists are not bundled; enabled downloads retain original source text and
notices locally. Source selection/last check/last successful data are separate.

| Source | Format/category | License / scope |
| --- | --- | --- |
| Lunar core | Bundled hostname ABP; explicit categories | Lunar application rules |
| StevenBlack unified hosts | Validated hosts to ABP; **Other**, not malware | MIT repository; included sources retain their licenses |
| EasyPrivacy | Four-file network subset; trackers | GPL-3.0-or-later OR CC-BY-SA-3.0-or-later; EasyList authors |
| EasyList | Eight-file network subset; advertising-related | Same dual-license choice; EasyList authors |
| HaGeZi TIF mini | ABP domain rules; distinct known-threat feed, opt-in | GPL-3.0-only; Gerd HaGeZi/upstream attributions |
| Custom subscriptions | Up to six deliberate trusted HTTPS ABP sources | User must check publisher trust and licensing |

This is network-only filtering. Cosmetics, scriptlets, full regex, response/HTML/
CSP rewriting, redirects and remote executable directives are excluded with
feedback. No ordinary advertisement is called malware. Download/check timestamps
are not independent verification of upstream completeness or accuracy.

## YouTube profile and boundaries

Genuine YouTube/YouTube-nocookie/youtu.be hosts and native frame/initiator identities
identify pages/embeds; look-alikes, credentials and URL substrings do not. The
profile toggle/reset does not change unrelated sites or global settings. Its
network activity includes genuine request categories and actual allowed player/
auth endpoint errors, without inventing detected playback failures.

Automatic rules preserve main-frame navigation, first-party YouTube endpoints,
all media resources/googlevideo delivery (including XHR), player/caption/API/
thumbnail/account hosts. Explicit user rules/allowances and optional threat
protection retain documented precedence. The global master and cookie preferences
still apply. Profile reset, known-origin YouTube data clearing and permission
restore are separate from global history/rules.

**A request cancellation is not an independently verified removed YouTube
advertisement.** First-party/server-inserted ads can pass; complete video-ad
removal, anti-adblock bypass, fingerprinting prevention and anonymity are not
promised. No player rewriting, scriptlet injection, login automation or credentials
are involved.

## Executed evidence

Evidence logs are local ignored `.artifacts/shield2-audit/`, not production assets.
No build, jsdom fixture or session adapter is presented as native Chromium proof.

| Check | Actual result at this checkpoint |
| --- | --- |
| Full `npm run check` | **PASS**: types, lint, **361 tests / 46 files**, build and package policy; includes final backup rollback, callback and secure delegated-fullscreen regressions. Local log: `full-check-final.log` |
| Final permission subset + types/lint | **PASS**: 12 tests / two files; secure delegated fullscreen remains available while sensitive iframe grants remain denied |
| Actual worker on downloaded HaGeZi mini | **PASS**: 3,906,230 input bytes, 185,809 rules, 7,784,909 compiled bytes, 2,257 ms in this run, 256 MiB old-generation limit; caller timer ran. Not a general performance guarantee |
| Real Chromium UI/material suite | **PASS** on implementation `4fd8ae5` locally, and exact `f9826f1` in CI. Existing strict pixel, material-switching, shortcuts, layout, keyboard, scrolling and navigation checks retained. Scratch-runtime failures and investigation are described below |
| Pearl capture-readiness browser regression | **PASS**: finite CSS animations and JS pointer retirement awaited; infinite CSS/non-retiring JS lighting rejected, without forcing completion, screenshot retries or paint masks |
| Real-feed cache and warm recovery | **PASS**: 185,809 HaGeZi rules, 14,472,299-byte validated JSON cache (below 16 MiB), warm load with **one** fixture transport fetch total; 4,149 ms for update + reload in this run. Production worker/manager/file paths with a controlled transport Response, not native HTTPS |
| Electron binary install in sandbox | **BLOCKED**: installer fetch failed and GitHub release-asset redirect returned EOF; no local Electron execution claimed |
| Windows source + packaged native/NSIS integration | **PASS** on exact `f9826f1`: renderer job `132733126948`; Windows job `132733126765`, run [`43688235705`](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/43688235705). Ten new native Shield groups in **both** source and packaged app, existing native regressions, unsigned NSIS build, packaged runtime and hash checks. No publishing |
| Native remote-source update | **PASS in packaged app:** actual HTTPS EasyPrivacy subset download, worker compilation and saved cache, **7,207 rules / six rejected rules with feedback**. The preceding source-app attempt received HTTP 403 and truthfully reported external-source-unreachable, not success |
| Live public YouTube | **UNVERIFIED** in the sandbox: preflight failed before TLS; outbound hosts exclude YouTube. An optional disposable signed-out Windows-native observation probe is added; inspect its actual result below before claiming any live page/player result |

New tests: `tests/shield2-{engine,service,permissions,data,statistics,profile,races,worker,renderer}.test.*`
and typed helpers; existing Shield/network/security fixtures were adapted to the
actual new async/terminal lifecycle, without weakening strict checks or deleting
coverage. `scripts/shield-native-checks.mjs` extends the real native smoke suite
with production IPC, actual server delivery/cancellation, redirects, inactive tabs,
compact popup/site isolation, rule compilation and toggling, export, permissions,
selected deletion, source-update attempt, statistics clearing and restart checks.
The source and packaged native assertions passed on `f9826f1` in run
`43688235705`. All network assertions use actual native requests and
server delivery, not jsdom or a substituted website bridge.

Verification iterations are recorded honestly: the initial serverless
single-process Chromium closed on creating another page. A full multiprocess run
passed; a subsequent differently configured scratch run timed out taking the
20-material screenshot. A final full local run using the scratch binary's
in-process software GPU (not single-process browser) passed, including the
unchanged 20-visible-material gate; `chromium-ui-final-inprocessgpu.log`. None
of these scratch-only flags are added to the shipped app. CI on `f4181af` caught the unchanged strict Pearl pixel
comparison; its readiness guard now also waits for genuine finite JS pointer
retirement, which is not represented by the Web Animations API. Equality remains
strict and non-retrying; original screenshots, hashes, style state and pixel-diff
diagnostics are retained on failure. The exact `f9826f1` CI renderer job passed.
Initial native attempts also exposed localhost resolution and an ambiguous
identity locator. The fixture now uses explicit local DNS and requires a committed,
non-error native document. Its identity assertion targets the actual exact-origin
heading, not duplicate request-diagnostic text. Neither failure was called a pass.

`scripts/youtube-live-checks.mjs` is a test-only, two-minute-budget observation
probe, enabled explicitly in the Windows source-native verification step. It first
records real TLS/HTTP reachability; if reachable it opens actual native homepage,
search, genuine-result watch/embed, Shorts and live-directory pages. It records
only observed renderer/player states, media-element time progression, player-button
fullscreen and caption-control responses. Consent gates are not silently accepted.
No credentials or account are supplied. A live directory is not a playing live
stream; a media element progressing is not proof of content versus an ad, audible
speakers, correct captions or all quality/keyboard behavior. Unreachable, gated or
failed cases remain unverified in its JSON/CI annotation, not fake passing tests.

## Completion categories and remaining acceptance gates

### Implemented and tested (scope-specific evidence above)

Indexed matching/precedence, exact-site policies, custom rule CRUD/import/export
payloads, bounded caches, five-event ownership/redirect/terminal accounting,
statistic categories/periods/clear/recovery, update/reset/remove/persistence races,
permission confirmation/policy scoping and selected-data API mappings. Loading,
error/cancellation and stale-origin feedback, dashboard sections and YouTube
independence have controlled React tests. The new suites contain 78 tests in nine
files; existing 283 tests are retained. Actual Windows source-native tests also
exercise request cancellation/server receipt, redirect identity, inactive-site
attribution, cookie headers, exact-origin controls, eight-section minimum-bound
hit targets, custom worker/rules/export, notifications and delegated iframe
fullscreen, selected data removal, source updates, statistics clear and restart.
See executed gates above: source-native success is not automatically packaged or
live-YouTube certification.

### Implemented, not fully verified across real services/devices

Source and packaged app integration/NSIS packaging passed on `f9826f1`.
Installed NSIS launch/upgrade/uninstall remain manual checks, not proved by
packaging or unpacked-app tests. Live external YouTube observations
must be read individually, not inferred from fixture success. Camera/microphone/
location/clipboard OS/device behavior requires appropriate interactive hardware/
platform checks even after actual native notification/fullscreen tests. Physical GPU, battery/60 FPS/4K,
manual accessibility and multi-monitor Windows certification are not inferred.

### Not implemented / deliberately outside the supported API

Universal YouTube/video-ad removal, player/ad-content outcome detection,
anti-adblock evasion, cosmetic/scriptlet/response injection, a complete storage-
origin or per-origin storage-byte inventory, reliable time-scoped cookie/cache/
storage deletion, screen/USB/Bluetooth/serial grants, telemetry, auto-updates and
new publishing. Time ranges apply only to actual recorded browsing-history
visits. Cookie clearing is registrable-domain scoped and may sign out related
subdomains/ports; running pages can recreate data and already-active capture
requires reload/close.

### Still required before a production-complete claim

Keep the real renderer/native/package gates green on the final test/report
commit; investigate failures rather than relaxing assertions. Perform or
explicitly leave unverified
real reachable YouTube homepage/search/watch/embed/Shorts/live/captions/fullscreen/
audio/account flows; fixture media and network counters do not certify them.
No new release authorization has been requested or inferred.

## Verification-only Windows artifact (not a release)

Run `43688235705`, implementation `f9826f1`, produced an unsigned
`Lunar-Browser-2.6.0-win-x64.exe`: 114,253,104 bytes,
SHA-256 `bf5dbe2d88e4576481dbd984d289c5d341d7e8dafb097fc5af29e0830ff39e8a`.
The check confirmed `NotSigned`, app 2.6.0, Electron 44.11.3 and Chromium
152.0.7977.169. This is a temporary verification artifact, not a new release,
not a signed installer, and not an instruction to overwrite the existing
published installer. Packaging uses `--publish never`. Existing public releases
and their hashes remain unchanged; this branch's improvements are not silently
backported into those old bytes.
