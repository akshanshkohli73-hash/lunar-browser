# Lunar Liquid Glass 2.0 — material and spatial refinement

Application candidate: **2.3.0** (separate from the unchanged public **2.2.0** prerelease). This task does not authorize or perform a new public release.

## Audit and retained design

The existing Coquette meadow/rose/midnight art, pastel-green theme, widget registry, default five-widget arrangement, saved 12-column packing, all nine dock icons/order, browser menus and native WebContentsView remain in place. This is an in-place refinement, not a replacement dashboard. No new runtime dependency, renderer privilege, protocol, provider or storage format was introduced.

The audit reproduced three concrete issues in the previous UI:

1. A 72% base fill plus a 35–38% paper gradient produced about 82% effective coverage before reflections. This made the surfaces resemble pale opaque cards.
2. The customization modal used one outer scroller with overlapping sticky header/actions, so lower options could be covered and the preview could shrink. This was visible in actual pre-change Chromium captures.
3. Wallpaper was absolutely positioned inside the scrolling dashboard. Long layouts could scroll the media away while later widgets continued over the opaque page background.

Screenshots used for comparison were captured from the existing application in this workspace. No separate user screenshot attachment was available in this turn.

## One reusable material system

`shared/glass.ts` owns **GLASS_LEVELS** and the depth resolver. `GlassSurface.tsx` binds those tokens; `glass.css` implements one backdrop pass, restrained gradients, fine fixed specular light, inner/outer edge highlights and soft ambient contact/elevation shadows. Light/dark paper and ink are coherent with Coquette green. Wallpaper color itself supplies the changing light response; there is no pointer-light tracker, frame loop, canvas or animated filter in application code.

| Depth          | Uses                                                      | Blur scale / saturation | Elevation |
| -------------- | --------------------------------------------------------- | ----------------------- | --------- |
| Light Glass    | Clock, weather, focus timer, dock                         | 0.75× / 1.22            | 10px      |
| Standard Glass | Search, bookmark library, shortcut tiles; default surface | 1× / 1.18               | 16px      |
| Deep Glass     | Notes, calendar, recent-history content                   | 1.15× / 1.12            | 24px      |

Blur is capped at 24px; the saved slider remains the **base** intensity. The chosen widget's preview identifies its depth. Existing global/per-widget enable, opacity, blur, tint, border, reflection, shadow, inheritance, reset, preview, Apply/Cancel and Simple preferences still work.

At the unchanged 72% opacity default, the minimum light-tone effective fill is approximately 66%, 67% and 70% for the three depths rather than the old ~82%. 100% still becomes opaque. Tone-specific readability floors protect normal/muted material ink over extreme white/black frames. Tests exercise all depths, both tones, several opacity values and extreme tints against a 4.5:1 mathematical contrast bound; this is not a universal accessibility certification for every control/state.

Simple mode removes blur/reflections, retaining working opacity/tint and a more protective fill. Global off is solid. Reduced transparency and forced colors win at the end of the cascade, including in Simple mode. Reduced motion removes dock magnification/transitions. None of this changes website CSS.

## Spatial, interaction and layout fixes

- **Video and scrolling:** one media element in scene layer 0; transparent independently scrolling dashboard body at layer 1. Widget ancestors have no opaque wash, opacity/filter backdrop root or nested blur. The wallpaper stays in place while widgets/footer scroll. Media lifecycle, private profile copies, range serving, muted default, explicit audio, retry/error and inactive/reduced-motion behavior are retained.
- **Widget identity:** same footprints and functions; quiet clock typography, a search capsule, bookmark-list separators/row feedback, ruled notes with a margin, compact tabular calendar and distinct weather/timer/shortcut hierarchy. No forced uniform inner-card template.
- **Dock:** same nine SVG icons and order, one shared Light Glass backdrop, soft icon elevation, quiet active pill, keyboard focus/tooltips, small neighboring-icon response only with fine-pointer magnification enabled. Hit boxes/indicator stay fixed; no bouncing or perpetual animation. Compact sizing remains distinct on narrow screens.
- **Safe space:** browser/native viewport and desktop use one dock-clearance calculation (height + bottom safe-area inset + 20px). The dashboard adds bottom breathing room inside its own scroller, without subtracting another full dock from native bounds.
- **Customization modal:** fixed header, independently scrollable options and separate nonshrinking actions. Preview/fieldsets cannot shrink into clipped content. Focus trap skips hidden/inert options, Escape/backdrop close and focus restoration remain. Other modals also have an independent body scroller.
- **Performance constraints:** one backdrop pass per material, no persistent `will-change`/forced GPU transform, no blur animation and no new app rendering loop. Live layout animation is disabled while arranging; dragged/resized/exiting surfaces use the no-blur mode. Root and nested activity gates share one window-visibility subscription; offscreen/inactive workspaces reduce material work and pause media as before.

## Files changed

- `shared/glass.ts`, `shared/dashboard.ts`: central levels/resolver and registry treatment mapping; saved schema/default data unchanged.
- `src/components/ui/GlassSurface.tsx`, `glass.css`: material composition and accessible/fallback modes.
- `src/components/dashboard/WidgetCell.tsx`, `DashboardStudio.tsx`: depth assignment, stable editing, visible depth preview and separate modal options/actions.
- `src/components/ui/Modal.tsx`, `src/index.css`: scroll boundaries, dock clearance, refined dock and widget hierarchy.
- `src/components/LunarDesktop.tsx`, `CoquetteDesktopShell.tsx`, `src/state/WorkspaceActivity.tsx`: shared dock surface and deduplicated activity gating.
- `tests/glass.test.ts`, `glass-surface.test.tsx`, `modal.test.tsx`: token/contrast/bounds, identity/draft/activity and modal keyboard regressions.
- `scripts/material-layout-checks.mjs`, `ui-smoke.mjs`, `native-smoke.mjs`: real geometry/hit targets, scrolling, material and physical video/pixel checks; no fake media success.
- `.github/workflows/verify.yml`: add upload of isolated native UI/video evidence only; read-only permissions and no-publish builds retained.
- `package.json`, `package-lock.json`: candidate version 2.3.0 only; dependency graph unchanged.

## Executed local checks

- Baseline `npm run check`: **180 tests / 23 files**, typecheck/lint/build/package validation passed.
- Current `npm run check`: **184 tests / 24 files**, strict typecheck/lint/build/package validation passed.
- Current `npm run test:ui` with actual external Chromium 153: passed without page/console errors. All three depths/real computed filters, built-in bright/dark drafts, working balanced/Simple opacity, off/Simple/forced-color modes, widget identities, 20 materials actually visible at 1280×2800, dock pointer/keyboard/reduced-motion/magnification preferences, nine routes/eight menus, fixed wallpaper scrolling and bottom safe space checked.
- Modal header/footer/option geometry and footer hit targets checked at **1280×840, 800×600, 700×650 and 520×500**, at top/middle/bottom scroll positions. Screenshots were inspected; the lower dock settings and actions are reachable without overlap.
- `npm audit --omit=dev`: **0 production advisories**. Installation reported **18 development-tool advisories** (17 moderate / 1 high); no forced dependency upgrade or suppression.
- Native script syntax and `git diff --check`: passed.

Renderer captures live under ignored `.artifacts/ui/`; bright/dark/all-20 screenshots are explicitly **draft renderer previews**, not persisted native profiles. The renderer-only preview cannot choose local files or save a desktop profile and does not fabricate those operations.

## Final Windows / packaged-app evidence

**[Run 42349969939](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939), source `d3cc0960abe0e21f63ab19c3ba7c08dd85c05bae`: SUCCESS.** Linux and Windows jobs both completed successfully. This supersedes the initial pending native status in the source-preparation commit.

| Executed gate                                                                                        | Actual result                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict typecheck/lint, unit/service tests, production build, package validation on Linux and Windows | **0; 184 tests / 24 files**                                                                                                                                                                                     |
| Actual Chromium renderer UI suite                                                                    | **0**; three material depths, bright/dark drafts, 20 actually visible static surfaces, responsive/scroll geometry, modal actions and dock controls                                                              |
| Real Windows Electron integration                                                                    | **0**; profile-selected patterned PNG, real H.264 MP4 / VP8 WebM, all existing native browser/security tests                                                                                                    |
| Actual compositing checks                                                                            | **0**; transparent widget ancestors, no nested backdrop root, changing captured video pixels through glass, and strictly lower captured pixel edge energy with backdrop blur enabled over the same paused frame |
| Modal/window layout                                                                                  | **0**; independently scrolling options and uncovered fixed header/footer, including **800×600 native window outer bounds**; unchanged native browser geometry checks                                            |
| Editing and persistence                                                                              | **0**; real pointer resize, genuine same-viewport browser drag, keyboard movement, preview/cancel/apply, saved material overrides and normal restart                                                            |
| Unsigned NSIS build                                                                                  | **0**; new 2.3.0 x64 candidate                                                                                                                                                                                  |
| Actual packaged/app.asar-mode application                                                            | **0**; same expanded native/media/material/layout suite, not just successful packaging                                                                                                                          |
| Production dependency audit                                                                          | **0**, no production advisories                                                                                                                                                                                 |

### Observed multi-widget video behavior

These observations used **five configured and five visible material surfaces**, 160×90 synthetic **12-fps** fixtures and Windows CI **software compositing** (`disabled_software`). They are not desktop GPU/FPS/battery certification.

| Runtime / format   | Observation window | Video frame callbacks | New decoded frames | Reported dropped frames | Largest callback gap |
| ------------------ | ------------------ | --------------------- | ------------------ | ----------------------- | -------------------- |
| Development / WebM | 2201ms             | 26                    | 27                 | 0                       | 94ms                 |
| Development / MP4  | 2201ms             | 26                    | 26                 | 0                       | 125ms                |
| Packaged / WebM    | 2201ms             | 26                    | 27                 | 0                       | 109ms                |
| Packaged / MP4     | 2201ms             | 26                    | 26                 | 0                       | 125ms                |

Physical captured-pixel edge energy decreased with blur: development WebM **485234 → 473832**, packaged WebM **484726 → 473314**, and both MP4 runs **480773 → 472777**. The test also asserted a changed image hash and changed painted pixels across seeks. These are evidence that backdrop filtering really samples the video, not merely that `backdrop-filter` is present in computed CSS. No FPS improvement relative to the old version is claimed.

### Evidence and new test installer

- [Windows material screenshots / observations](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939/artifacts/13565276351): artifact **13565276351**, 3,662,308-byte ZIP, digest `5e2f4ccfe2ba448e1bcfd31f0687975b4e1034f04452dc75187ffb2a3e3a25fb`.
- [Chromium renderer screenshots](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939/artifacts/13565765355): artifact **13565765355**, 3,852,582-byte ZIP, digest `8677089225461703eea2ecb90fd5692e93eaa825945d32120ed5037ee92e48b6`.
- [New Windows 2.3.0 unsigned installer ZIP](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42349969939/artifacts/13565196723): artifact **13565196723**, 113,734,415-byte ZIP, digest `fe411dbbb2af682e4b3ad17fb279dbb70862e6222b0e61d895c91086d70fb8c7`. Contains `Lunar-Browser-2.3.0-win-x64.exe` and `SHA256.txt`.

EXE SHA-256 (not the ZIP digest), computed by the Windows job:

```text
8CE70C8F531290275D29626338DE964ABC7058F6553A6AD2E58CA9FEB0466DF5
```

Authenticode: **NotSigned**. This candidate was **not publicly released**; the earlier 2.2.0 public prerelease and its bytes/tag remain untouched. Actions artifact downloads require GitHub access and expire according to repository retention. No auto-publisher, auto-updater, signing service, license grant or security-warning bypass was added.

### Remaining limits

- Local native preflight returned **2 / BLOCKED** because the sandbox has no Electron runtime binary. Native success above comes from the real Windows runner, in both development and packaged modes. Redirected artifact storage is inaccessible here, so no local installer download/rehash or local viewing of the Windows screenshot ZIP is claimed. Local Chromium captures were actually viewed.
- Native file selection was controlled by the integration test while exercising the actual import/copy/protocol/decoder path. A human did not operate a physical OS picker.
- Human-installed NSIS clean install/upgrade/uninstall, personal wallpaper codecs, cross-scroll/touch dragging, physical devices, multi-monitor/high-DPI and real low-power GPU/battery/1440p–4K video smoothness remain manual hardware checks. The small fixtures and short CI observations cannot establish those guarantees.
- Mathematical material contrast and tested focus/forced-color/reduced-motion modes are not universal accessibility certification for every custom theme/control/state.
- There are 18 reported development-tool advisories from the local install; production audit passed. Dependency versions and security boundaries were not relaxed to obtain a pass.
