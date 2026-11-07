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

## Windows / video gate — pending execution

The expanded existing Windows job will test actual profile-selected patterned PNG, VP8 WebM and H.264 MP4, transparent widget ancestor composition, changed painted pixels through glass, reduced pixel edge energy when actual backdrop blur is enabled over a paused video, frame advancement with several visible materials, actual native minimum-size modal geometry, widget editing/pointer resize/drag, material persistence and normal browser/security behavior. It runs in both development Electron and packaged/app.asar mode. Isolated screenshots and video-frame observations will be uploaded as `windows-material-evidence`.

Until that run completes, these new native checks are **not** claimed as passed. Human-installed NSIS clean install/upgrade/uninstall, personal wallpaper codecs, cross-scroll/touch dragging, native OS dialogs/devices, multi-monitor/high-DPI and real low-power GPU/battery/1440p–4K video smoothness still need manual hardware verification. The small synthetic 160×90/12-fps video fixtures and CI frame observations cannot establish those performance guarantees. No public release, signing or security-warning bypass is part of this task.
