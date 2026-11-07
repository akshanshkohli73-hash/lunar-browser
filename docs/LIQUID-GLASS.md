# Lunar Liquid Glass widgets — 2026-11-03

## Scope and audit

An in-place visual/interaction upgrade, not a browser rewrite. Audited `shared/dashboard.ts`, `StorageService`/`AtomicFile`, `BrowserContext`'s owner-scoped previews, `NewTabDashboard`, all nine registered `Widgets`, `DashboardStudio`/Theme Studio, wallpaper lifecycle, existing grid/DND/size definitions, CSS and the renderer/native suites before editing. Original browser, controls, nine widget implementations, local MP4/WebM protocol/player and native security/session/permission boundaries remain.

The initial workspace contained the preceding application's tracked/untracked changes with local HEAD `abff085`; baseline status/patch/check output was preserved under ignored `.artifacts/liquid-glass-baseline/`. Published application baseline is `f66a013d088c54ebaf97c2ca935eb6368133cbeb`. The diff against that published baseline was inspected before checkpointing, to preserve prior user work and history. No root deletion, reset/clean, branch switch or forced push.

## Material and controls

`GlassSurface` is a reusable memoized surface: one CSS backdrop pass, constrained translucency, saturation 1.18, static layered gradients, soft ambient shadow, inner edge highlights and noninteractive pseudo-element reflections. Clock, search, calendar, notes and weather have distinct treatments; all nine widgets keep their existing content/layout/behavior. No copied generic dashboard, placeholder provider data or emoji icons.

Real controls in **Appearance → Background & dock** and **Widgets**, all using the existing preview/Apply/Cancel persistence path:

- Global Liquid Glass enable/disable (cannot be overridden by a widget).
- Glass opacity **60–100%**, blur **0–24 px**, hex tint, border intensity, reflection intensity and shadow strength.
- **Balanced** rendering versus **Simple / low power**: no blur/reflections; opacity, tint, border and shadow remain functional. Blur/reflection controls are disabled while deliberately unavailable.
- Per-widget inheritance or custom material, including a per-widget off switch and reset to global.
- **Reset glass defaults** resets only global/individual materials, not notes, events, widget IDs/configuration/positions/sizes or wallpaper.

Changes affect actual live widget styles before Apply; Cancel restores the saved presentation. The settings preview samples the selected image/video through the existing player; it does not create a second playing dashboard video. Inactive/hidden workspaces pause preview playback and reduce material passes.

A deliberately stronger dark-material readability wash protects light text on bright wallpapers. Primary/muted token contrast is unit-tested with a conservative model at black/white wallpaper extremes, extreme tint choices and minimum opacity (4.5:1 threshold); this is **not** a universal accessibility certification for arbitrary custom content/themes, anti-aliasing or user imagery. Reflection strengths are restrained, especially on dark glass. Unsupported backdrop-filter gets a readable no-blur fallback; solid-color baseline, reduced-transparency and forced-color rules remain available.

## Persistence / compatibility

Dashboard schema **v1 → v2** migration adds glass tokens without altering saved widget data, notes/events or media IDs. A legacy profile's `widgetOpacity` seeds its new material opacity; the old field remains retained, but the old duplicate UI control is replaced by the actual glass control. Existing backups/corruption recovery remain in use.

Global glass is required in the current schema rather than using defaults inside a partial patch: a later note-only save must **not** silently reset material settings. Widget overrides are sparse, optional, strictly validated and inherit missing values. Tint accepts only six-digit hex; numeric ranges/unknown fields are rejected. No arbitrary CSS/URL/filesystem/IPC bridge or new renderer privilege.

## Interactions / performance

- Short transform/opacity entrances, exits, hover lift, press and focus-visible feedback; no continuous shimmer or pointer-follow lighting.
- Existing native HTML DND remains, now with source/target feedback and stable widget IDs. Supported resize handles appear **only in Arrange mode**: pointer resizing snaps to the registry's real sizes; click/keyboard cycles the same sizes. Unsupported sizes do not get fake handles. Existing editor size controls remain.
- Moved/resized cells still pass through the same deterministic collision packer. Save/cancel semantics and narrow-screen stacking remain.
- Memoized cells/material tokens and stable navigation callback. Resize state changes only at a supported-size boundary, not every pointer pixel. Blur/reflections reduce while dragging/resizing and when a workspace is hidden/unfocused; one workspace visibility subscription, no per-card animation loop.
- Reduced-motion disables transitions/layout animation; reduced-transparency/forced colors use simpler readable material. Simple rendering is an explicit lower-power option.
- Balanced backdrop filtering over moving video **still has GPU cost**. Rendering 20 surfaces is exercised, but no invented FPS, battery or hardware performance guarantee is claimed.

## Exact feature files

New:

- `shared/glass.ts` — strict material/override schemas, defaults, inheritance, global kill switch and tone resolution.
- `src/components/ui/GlassSurface.tsx`, `src/components/ui/glass.css` — reusable composited material/fallback/accessibility rules.
- `src/components/dashboard/GlassControls.tsx` — working global/per-widget material controls.
- `src/components/dashboard/WidgetCell.tsx` — existing widget composition with stable identity, transitions, selection, real DND/resize handles.
- `src/state/WorkspaceActivity.tsx` — shared visibility/activity signal for materials and settings preview video.
- `tests/glass.test.ts`, `tests/glass-surface.test.tsx` — migration/token safety/contrast/identity/activity/resize tests.
- `docs/LIQUID-GLASS.md` — this audit/evidence/limitations record.

Modified:

- `shared/dashboard.ts`, `electron/services/storage.ts` — v2 persistence and non-destructive v1 migration.
- `src/components/dashboard/NewTabDashboard.tsx` — shared cells, live materials, selection/drag/drop state; unchanged packer/registry.
- `src/components/dashboard/DashboardStudio.tsx` — global/override controls, actual wallpaper/material preview, Apply/Cancel/reset.
- `src/components/App.tsx` — non-DOM activity provider plus stable navigation callback; browser operations are retained.
- `src/components/ui/Icon.tsx`, `src/index.css` — SVG resize icon, per-widget hierarchy/spacing, editable handles and readable surfaces; wallpaper stays behind widgets.
- `tests/renderer-state.test.tsx` — real validated service-backed preview/save/cancel/reset/draft preservation tests.
- `scripts/ui-smoke.mjs`, `scripts/native-smoke.mjs` — real CSS/material/multiple-widget/image/video/layout/restart checks.
- `package.json`, `package-lock.json` — version **2.2.0** only, no new application dependencies. Temporary Chromium tooling is ignored, not shipped.

Earlier README/control-center/unified-log edits from the provided workspace remain preserved and are not misrepresented as newly implemented glass code.

## Commands/results so far

| Executed gate                                            | Actual result                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npm ci --ignore-scripts`, then `npm run check` | **0**, 168 tests / 21 files; existing deprecated dev-tool packages/advisories recorded, no forced dependency upgrade                                                                                                                                                |
| Current `npm run check`                                  | **0**, **180 tests / 23 files**, strict typecheck/lint, renderer/main/preload production build and package-input validation                                                                                                                                         |
| `npm run test:ui` with external Chromium 153             | **0**, actual computed backdrop/opacity changes, all nine widget types, 20 simultaneous materials, bright/dark draft captures, Simple/off modes, forced-color fallback, one workspace, existing control/menu routes and responsive stacking; no page/console errors |
| `npm audit --omit=dev`                                   | **0**, **0 production advisories**; full install reported 28 existing development advisories (27 moderate / 1 high)                                                                                                                                                 |
| `node --check scripts/native-smoke.mjs`                  | **0**; Windows execution pending                                                                                                                                                                                                                                    |

Intermediate checks caught and corrected an unused extraction import, an incomplete media-query mock and an immediate-vs-rendered preview count assertion (replaced by an actual awaited count, not weakened). A native-probe edit assertion failed before file write and was corrected before syntax/full checks. No security errors suppressed, tests deleted or TS/lint rules weakened.

Local renderer command:

```sh
LD_LIBRARY_PATH=/tmp/al2023/lib CHROMIUM_PATH=/tmp/chromium \
UI_TEST_CHROMIUM_ARGS='["--no-zygote","--disable-gpu","--disable-dev-shm-usage"]' npm run test:ui
```

The bright/dark local images are **draft renderer previews** captured with the settings portal temporarily hidden for component inspection, not a claim of a persisted desktop save or native Windows screenshot. Unit tests use the actual profile storage service for persistence; DOM media mocks are not treated as codec proof.

## Pending native/platform evidence

The existing Windows workflow will run the expanded real native suite, build the existing unsigned NSIS target and run the same suite in packaged/app.asar mode. Added checks cover glass above actual MP4/WebM frames, keyboard material controls, per-widget overrides, pointer resize, native HTML DND, inactive reduction/video pause and restart persistence. Full material tests explicitly emulate no reduced-transparency preference in the **test** browser; production never overrides accessibility preferences.

Until that run completes, no new Windows/installer success is claimed. Manual installed NSIS upgrade/uninstall, additional codecs, physical-device/multi-monitor/high-DPI interaction and real low-power GPU/FPS/battery profiling remain hardware/manual gates. No signing service, public release or warning/reputation bypass was introduced.

## Final verified evidence — supersedes pending status

**[Run 41663301595](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/41663301595), source `9e1106449a7b20e30ee1671850364c8a4be90e02`: SUCCESS.** Both jobs completed successfully.

| Final command / environment                                                                | Exit and result                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` — local, Linux CI and Windows CI                                           | **0**; **180 tests / 23 files**, strict typecheck/lint, all production bundles and package-input checks                                                                                                                                                                             |
| `npm run test:ui` — local Chromium 153 and Linux CI                                        | **0**; actual rendered material/opacity/blur controls; all nine widget kinds; 20 simultaneous surfaces; bright/dark decoded wallpaper draft captures; forced-color/Simple/solid fallbacks; caption contrast binding; unchanged controls/routes/responsive layout; no console errors |
| `npm run test:native` — real Windows Electron                                              | **0**; actual video frames behind glass, global/per-widget preview/apply, pointer resize, native HTML DND with a visible collision target, inactive reduction/video pause and restart persistence, alongside all prior browser/security/media checks                                |
| `npm run dist:win` — Windows                                                               | **0**, existing unsigned NSIS x64 target built                                                                                                                                                                                                                                      |
| `LUNAR_PACKAGED_EXECUTABLE=<win-unpacked/Lunar Browser.exe> npm run test:native` — Windows | **0**; the same real native suite in packaged/app.asar mode, actual MP4/WebM decode/paint/seek, preserved wallpaper source-copy/restart and saved glass tokens/overrides                                                                                                            |
| `npm audit --omit=dev`                                                                     | **0**, no production advisories                                                                                                                                                                                                                                                     |
| Native script syntax, targeted lint and `git diff --check`                                 | **0**                                                                                                                                                                                                                                                                               |

The first Windows run `41660910672` failed at the new offscreen `dragTo` saved-position assertion after the resize/material/video checks. The test was corrected to wait for layout stability and use a same-viewport collision target; it still performs real browser dragging and asserts a saved x/y change. Later runs `41661940624`, `41662740814` and the final run passed both development and packaged native gates. Cross-scroll/touch dragging remains a manual hardware/automation limitation, not an invented pass. Pointer cancellation/keyboard resize recovery also gained a regression assertion. Manual screenshot review caught a dark-caption color inherited from light chrome; that was corrected to use material ink and verified by an actual browser-computed color assertion.

### New Windows candidate

[Download 2.2.0 artifact ZIP](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/41663301595/artifacts/13244556225), artifact ID **13244556225**, ZIP **113,733,298 bytes**, containing `Lunar-Browser-2.2.0-win-x64.exe` and `SHA256.txt`.

Installer SHA-256, computed by the Windows job:

```text
2CF3A30C37A1542F54AB1D174B8674033A85B900BD7B8735D0F29E056C1AFE20
```

Authenticode: **NotSigned**. ZIP digest (not the EXE hash): `ac1f8d5c4b8bb139c7461dc5cb285934cc4de96b4124a542c6d391dd6e68fe6e`. This sandbox cannot retrieve the artifact's redirected storage host; no local installer rehash or direct attachment is claimed.

**Visual review completed:** current bright/dark renderer drafts and dashboard spacing/hierarchy were inspected, with image decoding awaited before capture. These are real rendered drafts, not persisted/native screenshots. Automated Windows GUI tests did execute against both development and packaged applications. A human did not manually operate an installed NSIS upgrade/uninstall, native OS color/file picker, physical touch/DPI/multi-monitor hardware, or low-power GPU/battery benchmarks. Those limits remain; no universal FPS, arbitrary-codec or accessibility certification is claimed. Existing Electron security, local-media handling, unsigned/no-publish policy and prior user functionality remain intact.
