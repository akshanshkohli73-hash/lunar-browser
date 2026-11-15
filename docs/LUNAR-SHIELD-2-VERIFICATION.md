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

## Executed evidence (in progress)

Evidence logs are local ignored `.artifacts/shield2-audit/`, not production assets.
No build, jsdom fixture or session adapter is presented as native Chromium proof.

| Check | Actual result at this checkpoint |
| --- | --- |
| Full `npm run check` | **PASS**: types, lint, 358 tests / 46 files, build and package policy; before the final primary/backup rollback and callback-hardening tests |
| Final backend transaction subset + types/lint | **PASS**: 38 tests / four files, including those final fixes |
| Actual worker on downloaded HaGeZi mini | **PASS**: 3,906,230 input bytes, 185,809 rules, 7,784,909 compiled bytes, 2,257 ms in this run, 256 MiB old-generation limit; caller timer ran. Not a general performance guarantee |
| Local full real Chromium UI suite | **NOT PASS**: initial common UI checks ran, then the serverless Chromium single-process runtime closed at a new-page gate; multiprocess rerun pending |
| Electron binary install in sandbox | **BLOCKED**: installer fetch failed and GitHub release-asset redirect returned EOF; no local Electron execution claimed |
| Windows source/packaged native/NSIS integration | **PENDING** on the exact working-branch commit; existing verification-only workflow, no publishing |
| Live public YouTube | **UNVERIFIED**: direct preflight failed before TLS; sandbox outbound hosts exclude YouTube |

New tests: `tests/shield2-{engine,service,permissions,data,statistics,profile,races,worker,renderer}.test.*`
and typed helpers; existing Shield/network/security fixtures were adapted to the
actual new async/terminal lifecycle, without weakening strict checks or deleting
coverage. `scripts/shield-native-checks.mjs` extends the real native smoke suite
with production IPC, actual server delivery/cancellation, redirects, inactive tabs,
compact popup/site isolation, rule compilation and toggling, export, permissions,
selected deletion, source-update attempt, statistics clearing and restart checks.
Those native assertions are authored, not yet a passing execution at this checkpoint.

## Completion categories and remaining acceptance gates

### Implemented and tested at unit/worker/controlled-renderer level

Indexed matching/precedence, exact-site policies, custom rule CRUD/import/export
payloads, bounded caches, five-event ownership/redirect/terminal accounting,
statistic categories/periods/clear/recovery, update/reset/remove/persistence races,
permission confirmation/policy scoping and selected-data API mappings. Loading,
error/cancellation and stale-origin feedback, dashboard sections and YouTube
independence have controlled React tests. See executed gates above for scope.

### Implemented, not fully verified end-to-end yet

Native network outcomes and permission decisions, actual deletion and persistent
worker/list integration, popup/dashboard hit targets and packaged app/installer
regressions await the new exact-commit native job. Camera/microphone/location/
clipboard OS/device behavior requires appropriate interactive hardware/platform
checks even after native notification tests. Physical GPU, battery/60 FPS/4K,
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

Finish the exact-commit real renderer/native/package gates; investigate any actual
failures rather than relaxing assertions. Perform or explicitly leave unverified
real reachable YouTube homepage/search/watch/embed/Shorts/live/captions/fullscreen/
audio/account flows; fixture media and network counters do not certify them.
No new release authorization has been requested or inferred.
