# Aqua Coquette — implementation and verification

**Status:** implementation complete; final renderer/native regression verification in progress; unreleased. The existing public 2.5.0 installer and source tag are not replaced by this work.

## Phase 0: actual repository audit

- Electron 44.7.2: `electron/main/index.ts` owns a sandboxed shell, validated IPC, profile storage, downloads, permissions, extensions and Lunar Shield. `electron/browser/tab-manager.ts` owns isolated `WebContentsView` tabs; only the selected native view is attached. `useNativeViewport.ts` synchronizes the measured viewport and overlay visibility. Websites have no shell preload bridge.
- React 18 / TypeScript strict / Vite 8.3.4 / Tailwind 3: `CoquetteDesktopShell → BrowserProvider → GlassMaterialProvider → LunarDesktop → App`, with one mounted browser workspace inside the preserved Coquette frame. The original portfolio implementation remains isolated; it is not a second browser shell.
- `src/liquid/`: one WebGL2 context, shader program, background texture and packed atlas; one shared RAF multiplexer. Actual wallpaper UV lensing, SDF-derived curved normals, Fresnel/specular lighting, finite springs and origin-to-panel material morphs already exist. An atlas snapshot and per-surface 2D blits are still composition costs, not zero-copy rendering.
- `Wallpaper.tsx` owns local image/video playback, muted resume, errors and transitions. `BackgroundTextureProvider` reuses that element and its video-frame notifications. `WallpaperStore` limits imports and serves only profile-owned media to the exact trusted shell origin. No per-frame native webpage screenshots.
- Nine existing widget types have real content: clock, search, bookmarks, explicit-consent/manual-update weather, calendar, notes, optional recent history, shortcuts and focus timer. Registry sizes, sparse per-widget materials and collision-safe packing are preserved.
- Theme Studio already persists full validated palettes and previews dashboard/material/dock/wallpaper drafts with Apply/Cancel/Reset. Shield UI reports actual engine decisions, not claimed universal protection.
- Existing material variants are `liquid-webgl`, `pearl-css`, and `clear-surface`. The removed SVG displacement/turbulence fallback must remain removed. Ordinary vector artwork and icons are not optical filters.

### Gaps found

1. No named Water Lens / Pearl Glass / Crystal presets or Subtle / Gentle / Dynamic motion presets.
2. The default identity is still meadow/cream rather than a coordinated mint/pearl/aqua/lilac palette; existing palettes must remain selectable and existing profiles must not be silently rethemed.
3. Tabs have horizontal scrolling but no roving keyboard navigation, active-tab reveal or explicit overflow controls.
4. Desktop mode substitutes built-in wallpaper and remounting routes can retire the existing player. Improve ownership rather than adding another video decoder.
5. Theme Studio still contains stale copy describing the removed SVG fallback.
6. Localized finite optical ripples, restrained dispersion and an independent overall optical-intensity token can build on the existing shader, scheduler and saved theme fields.

## Controlled implementation plan

1. **Tokens/presets:** shared Aqua palette, fresh-profile theme and retained original themes; atomic validated material/motion preset patches without a new persisted preset ID or schema reset.
2. **Engine:** extend the existing shader/material/physics pipeline with bounded localized ripples, restrained chromatic separation and overall intensity using the already-persisted theme `appearance.glassIntensity`. No idle decorative loop, text deformation or extra WebGL context.
3. **Wallpaper:** lift the existing owner to the shell so desktop, dashboard and Studio reuse the same image/video element. Pause when a native page or inactive window covers it; resume muted. Preview consumes the existing texture rather than cloning a video.
4. **Coherent interface:** refine existing menu/toolbar/address/search/widget/dock styles and implement functional keyboard/overflow/creation/removal tab interactions. Preserve native bounds, actions, hit targets and original Coquette art.
5. **Verification:** baseline and regression tests, new preset/physics/tabs/ownership tests, real production Chromium optical/UI comparisons, accessibility preferences and context switching, then existing Windows source/NSIS/packaged gates. Record actual evidence and remaining manual/hardware limits.

## Baseline

The incoming workspace tree was compared byte-for-byte with the previously verified `69fa4ff1e8d5a29e10e6a1717f61593715293ab3` tree, preserved in a local checkpoint and joined to the existing assigned-branch history without resetting or deleting work. `npm test`: **233 tests / 30 files passed** before runtime edits. Dependency installation required a serial, cached retry after transient TLS/network errors; TLS verification was not disabled.

## Results and limitations

### Implemented

- `shared/aqua.ts`, `material-presets.ts`: shared palette, paired readable inks, bounded optical budgets, fresh Water Lens values and validated preset patches. Aqua Coquette / Aqua Moonlit are added without deleting any original palette or silently changing saved settings.
- Theme Studio and dashboard controls: actual Water Lens / Pearl Glass / Crystal values; Subtle / Gentle / Dynamic motion; mint / aqua / lilac, existing adaptive/custom tint; real saved theme intensity with a 0–100% readout. Numeric input steps represent the actual preset values (including 0.32 refraction and 0.18 elasticity), rather than silently rounding them in Chromium. Apply/Cancel/Reset still use validated drafts and native persistence; presets do not reset quality, accessibility preferences or sparse overrides.
- Existing Liquid Engine: paired paper/highlight uniforms, bounded edge dispersion, finite localized optical ripples and sub-pixel flow driven only by already-presented video frames. Old impulses expire in real time, including for newly mounted or previously offscreen surfaces. Foreground text/icons remain ordinary crisp DOM, not a refracted screenshot.
- Existing Wallpaper owner lifted into `WallpaperEnvironment`: one persistent image/video source across desktop, dashboard and Studio; controls/errors are portaled to the active view. Video previews use the existing texture, not a second decoder. Native page coverage, inactivity and reduced motion pause playback; returning resumes muted. Images crossfade only for a finite interval; video is never cloned for a transition. Local limits and trusted-origin media handling are unchanged.
- `BrowserTabs`: manual ARIA tabs, one roving stop, Arrow/Home/End exploration, Enter/Space activation, Delete close/focus recovery, active/focused reveal, overflow arrows, HTML drag reorder, existing context menu/pin/mute/loading/close actions and finite create/remove/active-light motion. One strip observer is retained; removal completion remeasures overflow. All native actions still use the existing TabManager/IPC.
- Shared interface refinements: floating tab light, aqua dock curvature, original vector Lunar icons, local-time greeting using the existing minute ticker, search focus treatment, readable internal-page backing and a real Shield footer action. Original Coquette frame/artwork, widget registry/collision packing/supported resize and native viewport ownership remain.

### Rendering and performance contracts

One WebGL2 context/program/background texture, packed atlas, shared frame clock and one atlas snapshot per rendered frame; final surfaces still require 2D blits. This is **not zero-copy**. No per-widget WebGL contexts, native webpage capture, screenshot-per-frame pipeline or perpetual static-water loop. Static glass stops once springs/ripples settle. Hidden/ineligible surfaces are bounded by the existing quality budgets; an empty visible set skips atlas draw/snapshot and retires video callbacks. Intensity edits do not reload an unchanged texture. Performance / Balanced / High / Experimental and automatic CSS fallback remain available. Pointer effects never move logical hit targets or capture editing input.

### Verification recorded so far

- Baseline: **233 tests / 30 files PASS**.
- `npm run check`: **254 tests / 34 files PASS**, plus strict TypeScript, ESLint, production renderer/main/preload builds and package-input validation. One additional same-length tab-reorder/observer regression subsequently passed with the focused tests (full rerun pending).
- `npm audit --omit=dev`: **0 vulnerabilities**.
- New production Chromium/SwiftShader Aqua checks **PASS**: three distinct actual shader pixel hashes at identical 67×35 output dimensions; localized nonzero ripple pixels and exact settled-pixel recovery; stationary hit boxes; finite ripple expiry; no idle draws; actual zero/one intensity shader output; no extra texture upload; one context; persistent owner through desktop/Studio/Home; no SVG optical filters or browser exceptions. These are actual graphics tests, not jsdom rendering guesses.
- Full existing Chromium suite: previously reached its final dark scene after passing the main CSS/UI, WebGL, fallback/context-loss and geometry checks; a stale old-ink literal was corrected to the new paired pearl ink. The latest attempt overlapped a build/CPU-heavy full check and timed out taking an intermediate screenshot; it is **not a full-suite pass**. Rerun sequentially.
- Added actual Windows-source and packaged-app probes for native preset preview/apply/cancel, saved intensity, Shield footer navigation, real tab keyboard/overflow/HTML drag and persistent video ownership through desktop/Studio/native coverage. **Not yet executed for this revision.** Existing native browser/security/media/50-MB-boundary/NSIS gates remain intact.
- Evidence is kept outside Git under `.artifacts/aqua/` and `.artifacts/ui/`. Nonfatal existing Framer Motion `use client` bundler warnings remain; no strict check or contrast threshold was disabled.

### Using the new controls

Fresh profiles start with Aqua Coquette and Water Lens. Existing profiles keep their palette and exact saved values. To opt in, use **Appearance → Curated palettes → Aqua Coquette**, then **Background & dock → Aqua Coquette material → Water Lens**, and **Apply dashboard**. The same controls are available through **Customize dashboard**. Choose **Your own touch → Liquid intensity** for the overall saved optical strength. Render quality and reduced-motion/transparency preferences take priority. Arrow keys explore browser tabs without changing pages; Enter/Space activate, Delete closes. Wallpaper audio always requires explicit unmute and is remuted on view/visibility changes.

### Remaining limits

No new release, signature, universal blocking, Apple-native implementation, arbitrary native-page refraction or guaranteed 60-FPS claim is authorized or implied. The renderer-only preview intentionally has no native browser bridge or fake provider data. SwiftShader measurements are software CI observations, not hardware certification; physical GPUs, low-power/high-DPI/4K/battery/sustained video performance and multi-monitor behavior require profiling. Human-installed NSIS upgrade/uninstall, OS device consent, arbitrary personal codecs and complete assistive-technology/touch testing remain manual checks. The existing public 2.5.0 release is unchanged.
