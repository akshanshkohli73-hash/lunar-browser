# Lunar Shield 2.0 — implementation and verification

> Working-branch implementation, not a release. Application version stays 2.6.0.
> Baseline: `fb12ed5` on `arena/8b00471f-lunar-browser`. No published installer,
> update channel, signing policy, profile data or previous release is replaced.
>
> **Verified runtime/test commit:** `d0954ef05bbf688a8b679eeb2635ff70bba4c5e5`.
> [Exact-commit verification run](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/43800945063): **SUCCESS**.
> The subsequent completion-report update changes documentation only.

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
  races, lifecycle cancellation and awaited disposal are explicit. History clear
  clears durable aggregates and in-memory request contexts but retains bounded numeric ID
  tombstones, so an old request redirect cannot resurrect cleared counters.
  Filtering continues during and after the clear; genuinely new identities count
  normally. The clear-boundary regression covers multiple sessions too.
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

| Source                    | Format/category                                      | License / scope                                             |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Lunar core                | Bundled hostname ABP; explicit categories            | Lunar application rules                                     |
| StevenBlack unified hosts | Validated hosts to ABP; **Other**, not malware       | MIT repository; included sources retain their licenses      |
| EasyPrivacy               | Four-file network subset; trackers                   | GPL-3.0-or-later OR CC-BY-SA-3.0-or-later; EasyList authors |
| EasyList                  | Eight-file network subset; advertising-related       | Same dual-license choice; EasyList authors                  |
| HaGeZi TIF mini           | ABP domain rules; distinct known-threat feed, opt-in | GPL-3.0-only; Gerd HaGeZi/upstream attributions             |
| Custom subscriptions      | Up to six deliberate trusted HTTPS ABP sources       | User must check publisher trust and licensing               |

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

The final runtime/test commit is **`d0954ef05bbf688a8b679eeb2635ff70bba4c5e5`**.
Verification-only run
[`43800945063`](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/43800945063)
completed successfully:

- **Renderer, types and regression tests:** job `133080803175`, success.
- **Windows native browser and NSIS:** job `133080803585`, success, including
  both source and actual packaged application executions.

Ignored local `.artifacts/shield2-audit/` logs are scratch evidence and can expire
when a sandbox is restored. The committed report preserves their measured
results; the linked CI run retains its logs, check annotations and uploaded
renderer/native evidence. No build, jsdom fixture or session adapter is presented
as native Chromium proof.

| Check                                          | Actual result and scope                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full local `npm run check`                     | **PASS:** types, lint, **362 tests / 46 files**, build and package policy; includes final backup rollback, callback, secure delegated-fullscreen and post-clear redirect regressions. Latest log: `final-push-check.log`; Vitest 48.09 s in this run                               |
| Final clear-boundary subset + types/lint       | **PASS:** 34 tests / three suites. A regression first reproduced four old requests reappearing after clear; late redirects, finished IDs, multiple sessions and arrivals during clear now remain excluded while genuinely new requests count normally                              |
| Actual worker on downloaded HaGeZi mini        | **PASS:** 3,906,230 input bytes, 185,809 rules, 7,784,909 compiled bytes, 2,257 ms in that sandbox run; caller timer ran. 256 MiB is the configured worker old-generation limit, **not measured total memory**                                                                     |
| Real-feed cache and warm recovery              | **PASS:** 185,809 HaGeZi rules, 14,472,299-byte validated JSON cache below the 16 MiB file limit, warm load with **one** fixture transport fetch total; update + reload 4,149 ms. Production worker/manager/file paths with a controlled Response, **not native HTTPS activation** |
| Full real Chromium renderer/material suite     | **PASS:** full local multiprocess/software-GPU run and exact-commit CI renderer job. Strict pixel equality, material switching, all nine shortcuts, keyboard menus, layout/scrolling, Studio/wallpapers and navigation retained; no console errors in the passing local run        |
| Capture-readiness browser regressions          | **PASS:** finite CSS animations and JS pointer retirement awaited; infinite CSS/non-retiring JS lighting rejected, without force-finishing motion, screenshot retries, masks or pixel tolerance                                                                                    |
| Windows source and packaged native integration | **PASS:** ten Shield groups in **both** actual app forms, plus existing native navigation, tabs, bookmarks, downloads, extensions, wallpapers/Studio, optical fallbacks, profile/restart, sender validation and geometry regressions                                               |
| Native remote-source update                    | **PASS in both source and packaged app:** actual HTTPS EasyPrivacy subset download, worker compilation and saved cache, **7,207 rules / six rejected rules with feedback**. Earlier HTTP 403 attempts were reported as unavailable, not success                                    |
| NSIS build and packaged runtime                | **PASS:** unsigned x64 NSIS build, actual packaged app execution, H.264 MP4 / VP8 WebM wallpaper and native checks, installer metadata/hash/NotSigned checks. **Not an installed-NSIS upgrade/uninstall test**                                                                     |
| Production-only dependency audit               | **PASS:** `npm audit --omit=dev` reports **0 vulnerabilities**. The development-inclusive install reports 16 moderate findings; no audit-force fix, security-check suppression or dependency replacement was used                                                                  |
| Local Electron binary install                  | **BLOCKED** in the sandbox: binary fetch/asset redirect failed; **Windows CI**, not a claimed local native execution, supplies native proof                                                                                                                                        |
| Live public YouTube                            | **Partial actual native observations**, detailed below; **not a passing playback or ad-removal certification**                                                                                                                                                                     |

New suites are
`tests/shield2-{engine,service,permissions,data,statistics,profile,races,worker,renderer}.test.*`
and typed helpers: **79 tests in nine files**, retaining the existing **283**.
Existing fixtures were adapted to the actual asynchronous/terminal lifecycle,
without deleting coverage or relaxing strict checks.

### What the real native Shield gate executed

`scripts/shield-native-checks.mjs`, wired into `scripts/native-smoke.mjs`, uses the
production main/preload/renderer, real `WebContentsView` tabs, Electron webRequest
callbacks, actual local HTTP servers and the packaged worker entry. Native-dialog
choices are automated in the **test process**, not in application code.

1. Actual cancellation versus permitted bytes received at the server; one request
   identity across redirects; inactive-tab attribution.
2. Real compact popup, exact-origin toggle/allowance isolation, reset and native
   view occlusion.
3. Third-party Set-Cookie interception and exact-site override, separately from
   request-block counts.
4. All eight dashboard navigation hit targets and section switching at native
   800×600/content-size bounds.
5. Real custom-rule worker compilation, UI add/toggle, resource-type behavior,
   atomic invalid import, exception-only precedence and native-dialog export.
6. Independent YouTube toggle/reset, with truthful activity labels.
7. Actual Chromium notification denial, confirmed persistent Allow and reset;
   cancellation of native confirmation; no website preload bridge.
8. Actual delegated, user-activated cross-origin iframe fullscreen and exit,
   without granting sensitive iframe permissions.
9. Cookie/cache/storage inventory and deliberate selected deletion preserving an
   unrelated origin; rejected unsupported time range and cancelled deletion.
10. Confirmed aggregate clear; a **real in-flight redirect** remains blocked
    without resurrecting cleared counts; genuinely new terminal outcomes count
    normally. Rules/config/statistics also participate in restart assertions.

These are native controlled fixtures, not claims about arbitrary public services,
physical devices or a live YouTube player.

### Public YouTube: what actually happened

`scripts/youtube-live-checks.mjs` runs only when explicitly enabled in the source
native verification step. It uses a disposable signed-out profile, an observation
budget, actual native tabs and their main frames. It supplies **no credentials**,
does not silently accept a consent gate and does not change production behavior.
A failed fetch preflight alone is not called a failed browser/player test.

On the verified commit/run:

| Flow                                                                | Observed result                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP reachability                                                   | **HTTP 200** from the public YouTube preflight. Electron did not expose a response origin; no origin was invented                                                               |
| Homepage                                                            | Genuine native YouTube URL and app container rendered; title `YouTube`; no consent gate observed                                                                                |
| Search                                                              | Genuine results URL and app container rendered; a real search-result watch ID was selected                                                                                      |
| Watch                                                               | Genuine watch URL/app container rendered for `aqz-KE-bpKQ`; **the player observation timed out**. Media progression was **not verified**                                        |
| Embed                                                               | Genuine embed URL/player container rendered for that real result; **embed playback not verified**                                                                               |
| Shorts                                                              | Genuine `/shorts/` page/app container rendered; **Shorts playback not verified**                                                                                                |
| Live                                                                | Genuine `/feed/live` directory/app container rendered; **a directory is not a playing live stream**                                                                             |
| Network activity                                                    | Actual terminal-confirmed third-party advertising-related script/XHR cancellations from `static.doubleclick.net` and `googleads.g.doubleclick.net`, source `lunar-core`, rule ` |     | doubleclick.net^` |
| Audio, captions, quality, player keyboard, public-player fullscreen | **Not verified**: the watch player observation did not complete. The separate successful native iframe fullscreen fixture does not certify the YouTube player                   |
| Account/sign-in                                                     | **Not tested**, no credentials/account supplied                                                                                                                                 |
| Video-ad removal                                                    | **Not independently verified**; a third-party cancellation is not proof that a YouTube advertisement was removed                                                                |

The watch timeout does **not establish its cause**. No media-blocking diagnosis,
anti-adblock result, successfully removed advertisement or working audio/captions
is inferred. The bounded compatibility window recorded no qualifying allowed
endpoint network errors; an empty window is not a compatibility guarantee.
Actual media/player, account and live-stream verification remains outstanding.

Earlier probes are not substituted for this result: the sandbox itself could not
reach YouTube; an initial Windows probe mishandled empty `Response.url` metadata,
which was corrected to preserve the actual HTTP status. Another probe waited on
whole-page load rather than the live main frame. Neither was called a successful
player test. The final run genuinely observed the public page containers and
network cancellations above, while still reporting the player timeout.

### Other verification corrections retained

An initial serverless single-process Chromium closed when another page was
created. A multiprocess run passed; another scratch configuration timed out at the
20-material screenshot. The final full local software-GPU run passed that same
unchanged gate. Scratch flags are **not added to the shipped app**.

CI caught a strict Pearl pixel mismatch on `f4181af`. Capture readiness now also
waits for finite JS pointer retirement, which is not represented by the Web
Animations API. Equality remains strict and non-retrying; original screenshots,
hashes, styles and pixel-diff diagnostics are kept on failure. Subsequent full CI
renderer jobs, including the verified final commit, passed.

Initial native attempts exposed localhost resolution and an ambiguous origin
locator. The fixture now uses explicit local DNS and requires a committed,
non-error native document. The identity assertion targets the actual exact-origin
heading rather than duplicate request-diagnostic text. The final history-clear
regression was first demonstrated failing, then fixed in production code and
covered by the final **real native** delayed-redirect assertion.

## Completion categories and remaining work

### Implemented and tested

- Indexed real network filtering/precedence; exact-site policy/allowances;
  custom-rule CRUD/import/export; supported subscription validation, conditional
  updates, caches, reset/removal and last-good recovery.
- Terminal-confirmed, deduplicated and bounded statistics; genuine periods,
  categories, clear/recovery and redirect/reset races. Distinct IDs are capped
  (2,048/day, 8,192 all-time); the UI displays **+** for a bounded lower count.
- Real popup/dashboard and eight sections; loading/error/cancellation/stale-origin
  handling; genuine native permissions/data operations within the tested scopes.
- Independent conservative YouTube profile, reset/activity/data and permission
  controls; controlled compatibility matching and actual public-page network
  cancellation observations, **not complete player verification**.
- Existing renderer and source/packaged native regressions, plus NSIS packaging.
  Architecture, Coquette artwork, shared material modes, fixed hit targets and
  actual native browser workspace are retained.

### Implemented, not fully tested across real services/devices

- YouTube watch/embed/Shorts/live playback, audio, captions, quality, player
  keyboard/fullscreen and authenticated account flows: the real watch observation
  timed out; do **not** claim these passed or that Shield caused the timeout.
- Camera/microphone/location/clipboard physical device and OS-consent behavior;
  native notification/fullscreen checks are not a substitute.
- Live feed coverage is specific: EasyPrivacy native download/compile/save passed.
  StevenBlack, EasyList and HaGeZi native live activation have **not each** been
  exercised. Manifests/formats and generic updates have controlled coverage; the
  actual HaGeZi feed ran through the production worker/cache with controlled
  transport. Publisher completeness/threat accuracy is not independently certified.
- Installed NSIS launch/upgrade/uninstall, multi-monitor Windows DPI, physical GPU,
  manual accessibility, battery/60 FPS/4K and additional codec certification.

### Not implemented / deliberately outside the supported API

Universal YouTube/video-ad removal, player/ad-content outcome detection,
anti-adblock evasion, cosmetic/scriptlet/response injection, a complete storage-
origin or per-origin storage-byte inventory, reliable time-scoped cookie/cache/
storage deletion, screen/USB/Bluetooth/serial grants, telemetry, automatic app
updates and new publishing. Time ranges apply only to genuine recorded browsing-
history visits. Cookie clearing is registrable-domain scoped and may sign out
related subdomains/ports; running pages can recreate storage and active capture
requires reload/close. No anonymity, complete fingerprinting protection or
warning-free/signed installation claim is made.

The runtime, renderer, native and packaging gates **passed**. The outstanding
service/device/manual checks above still prevent an unqualified
“production-complete in every environment” claim. Any future fix needs its own
real checks, not relaxed assertions.

## Verification-only Windows artifact and push scope

Run `43800945063`, verified implementation `d0954ef`, produced an unsigned
`Lunar-Browser-2.6.0-win-x64.exe`: **114,253,130 bytes**, SHA-256:

```text
cfce383b5979faa23001720603ceb5753ad65d4f37ba0fc219ba460f96108428
```

Checks confirmed **NotSigned**, app **2.6.0**, Electron **44.11.3**, Chromium
**152.0.7977.169**, and actual packaged Windows execution. This is a temporary
verification artifact, **not a new published release**, not a signed installer,
and not installed-NSIS/upgrade certification. Packaging keeps `--publish never`.
The application package remains **UNLICENSED**; engine/list notices do not grant
an application redistribution license.

The user's “push the new version” is fulfilled as a push of the updated code to
**`arena/8b00471f-lunar-browser`**, not an inferred version bump or publication.
Existing public releases/installers and their hashes are not overwritten. The
existing public v2.6.0 installer is **not** silently updated by this branch push;
these improvements require a separately authorized, verified new release if they
are to be distributed as public installer bytes.
