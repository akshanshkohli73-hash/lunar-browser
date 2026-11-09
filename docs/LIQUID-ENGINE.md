# Lunar Liquid Engine — architecture and execution record

## Phase 0 · repository audit

- **Wallpaper:** `dashboard/Wallpaper.tsx` owns the existing image/video DOM elements, object fit/position, blur/shade, explicit muted playback, activity pause, finite image transitions and bounded one-shot palette sampling. Local assets remain UUID-named profile copies through the UI partition's `lunar-media://wallpaper/…` GET/HEAD/range handler (50 MB images, 150 MB videos). No graphics texture currently exists. Studio currently mounts its own video preview; the new graphics path must not add another decoder and will share the desktop video for its preview.
- **Materials:** `GlassSurface`, semantic `GlassBacking`/`GlassPanel`, three depths and `GlassMaterialProvider` already cover chrome, dock, widgets, portals and settings. The existing Optical backend is CSS backdrop filtering plus seeded SVG displacement. It is not curvature-dependent WebGL lensing. Keep it as a truthful fallback, not the claimed new engine.
- **Motion:** shared Framer springs, a delegated finite pointer/proximity scheduler, stable dock hit targets and mounted/inert modal/menu exits already exist. Extend their scheduler and semantic triggers rather than replacing browser controllers.
- **Electron:** one browser workspace; real websites use isolated native `WebContentsView` contents. Those pixels cannot be sampled by the shell WebGL renderer. New optical surfaces sample only Lunar-owned wallpaper, never website screenshots/DOM or privileged native-page capture. No native bounds/reservation changes are needed.
- **GPU capability:** no WebGL renderer or actual adapter probe exists today. WebGL2/program/texture/2D-output readiness, texture limits and context loss must be checked at runtime. Capability syntax is not painted-pixel proof. No hardware frame-rate guarantee is possible from this audit.
- **Origin cleanliness:** private media has no CORS texture contract today. Enable CORS checking for the scheme and permit anonymous media access only for the exact trusted shell origin, only on the UI partition's handler. Keep web security, sandboxing, sender validation, CSP and the website partition's lack of this handler. No wildcard origins, credentials, arbitrary paths, uploads or new filesystem bridge.

## Implementation decisions

1. One reusable WebGL2 program/quad/texture and one bounded atlas. Surface canvases use 2D atlas blits behind their existing DOM content. This preserves portal/scroll/native stacking without a context per widget or obscuring text. It is **not zero-copy**: output composition has a real, measured cost. The graphics loop does not call getImageData/readPixels per frame; browser-managed snapshots/blits may still copy or synchronize. This is measured, not claimed zero-copy.
2. `BackgroundTextureProvider` observes the existing wallpaper node. Image uploads occur on source/load changes; video uploads use the existing element and available video frames, at most once per rendered frame. No cloned video, independent playback system or forced security bypass.
3. Shader-rounded signed-distance geometry drives curvature/edge UV lensing, Fresnel-inspired grazing response, directional specular lighting, tint/saturation/blur and a readability wash. It is an independent screen-space approximation, not Apple-native glass, ray tracing or website refraction.
4. One shared frame clock coordinates graphics, bounded spring deformation, morph proxies and existing dock/pointer settling. Deformation affects material pixels, never DOM hit boxes or pointer capture. All loops stop when idle/inactive; context loss restores the normal CSS material.
5. Performance / Balanced / High / Experimental are actual policies for backend, resolution, samples, surface budget and pacing. Adaptive resolution uses measured submission/composition time; GPU timing is optional and explicitly identified. Reduced motion/transparency and forced colors take precedence.
6. Extend strict persisted glass settings and preserve old documents/overrides via migration. Existing refraction/tint/blur/animation controls remain real; new curvature, edge lensing, specular, elasticity, responsiveness and render-quality controls reach uniforms/physics/policy.

## Verification status

**Passed runtime/source:** `848dfa9e4b80dc20ef2c2024d27c8b09fb56f3ee` · [run 42622793883](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42622793883). Both renderer/regressions (**129178905714**) and Windows native/NSIS (**129178905388**) succeeded. This is new 2.5.0 evidence, not substituted historical 2.4.1 proof.

- **224 tests / 28 files**, TypeScript, ESLint, renderer/main/preload builds, package configuration/input validation and production audit (**0 vulnerabilities**) passed. Development-tool advisories remain disclosed, not force-upgraded/suppressed.
- Actual production Chromium 153 with test-only software ANGLE/SwiftShader passed real wallpaper/optical-control pixels, specular movement with elasticity zero, press/release recovery with unchanged DOM hit boxes, idle-stop, quality/resolution budgets, resizing, context-loss fallback and actual restored pixels, toolbar-to-menu morph and keyboard roving. Existing broad CSS/SVG unsupported-WebGL, reduced-motion/forced-color, widget/theme/layout, dock/proximity/hit-target and portal/focus regressions also passed.
- Additional actual production-browser scenes verified Dock Appearance → Theme Studio heading expansion and a dark Midnight wallpaper with real WebGL output and light readable ink. These are app-owned wallpaper pixels, not a fake graphics backend.
- **Actual Windows source Electron and packaged `win-unpacked/Lunar Browser.exe` passed**: private image/MP4/WebM decode, exact-50-MB image-to-WebGL and 50-MB-plus-one-byte rejection, moving video texture/pixel advance at equal rendered resolution, native-window off/on lensing and stable paused repeats, no texture reupload for uniform-only changes, one existing video element, new Studio preview/apply/restart preferences, actual widget resize/native DND with shaders active, navigation/tabs/permissions/security, native occlusion through mounted exits and restart/profile persistence.
- New unsigned x64 NSIS packaging completed; this is packaged-app execution, **not a human-installed NSIS upgrade/uninstall test**. No public release/update feed was created for 2.5.0. Back up a profile before trying the candidate; older versions do not understand dashboard v4.

### Implemented details / current limits

- New engine modules live in `src/liquid/`; no runtime dependency was added. The original CSS/SVG path remains a tested fallback. Existing pointer/dock settling now shares the graphics frame clock. Framer retains its own normal finite component lifecycle.
- Existing images are converted once to an origin-clean, bounded bitmap (including SVG intrinsic-size handling); video uses direct `texSubImage2D` on the existing media element. Source stamps avoid reuploads for material/fit-only changes. Studio shares the desktop video; it owns a video only when that desktop player is absent.
- The only new native information bridge is a sender-validated read-only window-activity boolean/event. UI-frame blur is not treated as whole-app inactivity when focus moves into the native browser view. The web partition still receives no privileged preload or private media handler.
- The first actual Chromium pass used software ANGLE/SwiftShader. Static off/on refraction hashes differed and fixed-on repeated pixels matched; edge lensing, curvature, saturation, blur and specular each changed actual output. Panel press/release changed material pixels without changing its DOM rectangle; settled draw count stopped. Context restoration reuploaded/repainted a real surface. Measurements are software/test observations, including GPU/CPU copy costs and probe-induced readbacks, not desktop hardware FPS certification.
- Matrix/atlas, source lifecycle, bounded springs, migration/strict settings and exact private-media CORS are unit-tested. File import limits (50/150 MB), sandbox/context isolation/CSP, single native workspace and explicit no-publish packaging remain. No native webpage pixels are captured.

### First Windows attempt (not native completion)

Run [42617106421](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42617106421) from `1ae58c5` passed renderer checks but stopped at the first private-image decode, before native graphics/video or packaging. The initial CORS origin used URL.origin (`null`) instead of Chromium's file security-origin serialization (`file://`). The handler now uses the exact trusted shell security-origin representation; it remains UI-partition-only, without wildcard/credential access. Decoder-failure diagnostics retain only origin/status metadata. This attempt remains a real failure; the later successful run above, not this run, supplies native/packaged evidence.

### Composition and native-probe refinements

- Per-surface blits now use **one shared atlas ImageBitmap snapshot per frame**, not repeated WebGL-canvas snapshots. Composition is asynchronous/coalesced; pending snapshots are closed, stale generations are discarded, and new frame/interaction dirtiness survives the async boundary. CPU submission/composition time is separate from total frame/snapshot latency.
- Native file-origin decoding and the private **50 MB image → WebGL2** path passed in run 42618461491. Its subsequent CSS-blur comparison still stopped the gate; the comparison now isolates actual background pixels from foreground note rules/text and waits for material transitions, retaining strict smoothing and off/on difference assertions.
- Run 42619770887 then reached a live video WebGL2 preflight (one context, real video frames/uploads), but the motion gate sampled a stale High-quality baseline before the Balanced frame was painted. The gate now waits for the actually rendered quality/frame and compares moving pixels at equal current resolution; it still requires advancing presented frames and texture uploads. The corrected equal-resolution gate and full native/packaged suite passed in run 42622793883.
- Additional actual Chromium checks verify manual tint under adaptive tint, pointer-driven specular movement with elasticity set to zero, and the Experimental sampling/pixel budget. Decorative wallpaper images are non-draggable; they cannot start an unintended browser image-drag while pressing a material.

## Implementation map

| Phase             | Actual code / behavior                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Shared engine | `src/liquid/LiquidEngine.ts`, `LiquidRenderer.ts`, `LiquidMaterial.ts`, `FrameClock.ts`; one WebGL2 context/program/quad/texture, bounded atlas and one asynchronous atlas snapshot per frame. Existing DOM layers receive required 2D blits, not independent shader contexts.                                                                                                    |
| 2 · Optics        | `shaders.ts`: rounded SDF normals, curvature/edge-weighted UV displacement of the actual background texture, Fresnel-inspired grazing response, directional specular, bounded tint/saturation/blur and per-pixel readability protection. No random optical noise or static distorted source.                                                                                      |
| 3 · Physics       | `LiquidInteractionController.ts` + exact critically damped spring math in `shared/liquid.ts`: 96px proximity, press/release, drag influence and finite settling. Only material pixels change; controls are not transformed/captured by the engine.                                                                                                                                |
| 4 · Morphing      | `LiquidMotionController.ts`: semantic trigger/target IDs on existing menus, toolbar/modal controls, dock and settings headings. Rounded material proxies expand/contract independently of DOM focus/hit geometry. Exit proxies are bounded by existing mounted portal occlusion; no native view is uncovered early.                                                               |
| 5 · Backgrounds   | `BackgroundTextureProvider.ts` and existing `Wallpaper.tsx`: images upload once (bounded bitmap); video uploads directly from the existing element using available-frame notifications. Pause/seek/visibility, ownership transfer, cancellation and no-decoder-clone behavior are retained. A missing video-frame API falls back rather than pretending a static texture is live. |
| 6 · Integration   | Extended existing `GlassSurface`/backings/panels cover menu bar, tab strip, toolbar/address, dock, widget registry, menus/modals, Theme Studio, Shield and settings headings/sections. Original frame/art, native workspace reservation and content functionality remain. Native webpages are never sampled.                                                                      |
| 7 · Policies      | Real quality budgets below, frame pacing/coalescing, adaptive scale, bounded texture dimensions, inactivity pause, resource/bitmap cleanup, context restoration and CSS/SVG/solid accessibility fallbacks.                                                                                                                                                                        |
| 8 · Controls      | Existing refraction/blur/tint/reflection/animation controls plus edge lensing, specular, curvature, elasticity, responsiveness and render quality modify uniforms/physics/policy. Preview/Apply/Cancel/reset and strict v4 persistence preserve notes, layouts, media and sparse widget overrides. Shader-only controls are disabled when the active backend cannot render them.  |

### Quality policies (upper limits, not promised FPS)

| Quality      | Backend / base scale                                        | Pace cap         | Blur samples | Surface cap | Atlas pixel budget |
| ------------ | ----------------------------------------------------------- | ---------------- | ------------ | ----------- | ------------------ |
| Performance  | Existing CSS/SVG; Simple remains available for no live blur | No graphics loop | —            | —           | —                  |
| Balanced     | Shared WebGL2, 0.65 × capped DPR × adaptive scale           | 30 Hz            | 5            | 24          | 2,097,152          |
| High         | Shared WebGL2, 1.0 × capped DPR × adaptive scale            | 60 Hz            | 9            | 32          | 4,194,304          |
| Experimental | Shared WebGL2, 1.25 × capped DPR × adaptive scale           | 60 Hz            | 13           | 40          | 8,388,608          |

DPR is capped at 1.5; adaptive scale reduces cost on slow submission/composition. Texture/atlas dimensions are checked against actual GL limits (and a 4096 engine maximum). Unsupported/oversized sources or failed resources have a readable fallback. Partially clipped DOM materials still use their full material rectangle; this is bounded by atlas/surface budgets, not perfect occlusion culling. Native navigation may retain the last **paused wallpaper environment** after its DOM player unmounts; it does not refract the native webpage. A source change invalidates that environment.

## Measured observations — software tests, not hardware certification

Local actual Chromium image probe: refraction off/on hashes **4088233121 → 1294868485**, repeated-on **1294868485**. These are bounded RGBA probe hashes, not cryptographic hashes. Manual tint changed **3456920283 → 1728668213** while adaptive tint stayed enabled. Pointer specular changed **2287099668 → 2535484162** with **elasticity 0**. Idle draw count stayed **166 → 166**. Dock material expanded from a measured 42×42 trigger into its actual settings heading; the dark scene retained `rgb(244, 248, 239)` ink.

The local Balanced snapshot measured atlas **375×399**, effective scale **0.26**, last CPU submission/composition **8.00ms**, total snapshot/frame latency **8.80ms**; Experimental used scale **0.5** and **13** samples. These are individual samples amid software/test readbacks, not sustained GPU FPS. Startup/context-recovery and readback-induced hitches were also observed; EMA values include those hitches.

Native tests forced software ANGLE/SwiftShader using **test-launch flags only**. Electron's GPU-compositing status was `enabled`, which does **not** mean physical GPU certification here. The following cadence window restored the normal High policy after the controlled Balanced optical probe. Clips are silent, synthetic **160×90 / 12fps**. Browser frame counters include dropped frames.

| Execution / clip | Observed ms | Video callbacks | Total frame counter | Dropped frames | Max callback gap ms |
| ---------------- | ----------- | --------------- | ------------------- | -------------- | ------------------- |
| Source webm      | 2348        | 9               | 28                  | 13             | 313                 |
| Source mp4       | 2370        | 9               | 24                  | 11             | 328                 |
| Packaged webm    | 2222        | 10              | 24                  | 10             | 328                 |
| Packaged mp4     | 2260        | 8               | 20                  | 9              | 672                 |

**The dropped frames/stalls are real limitations of this software test setup.** They are not hidden and these results do not establish consistently smooth 60-FPS performance. During the controlled Balanced moving probes, sampled submission/composition ranged roughly 0.9–94.7ms and snapshot latency 2.5–181.6ms; steady paused samples were lower. Select Balanced/Performance on constrained systems. Physical GPUs, low-power devices, high DPI, large displays/4K video, personal codecs, battery use and sustained interaction latency still require hardware/manual profiling. No universal performance improvement or accessibility certification is claimed.

All four source/packaged optical probes required a moving, uploaded video frame and real painted native-window refraction; fixed paused repeats were stable, with one existing video element and no new texture upload for a refraction-uniform change:

| Execution / clip | Native window off hash → on hash | Repeat stable |
| ---------------- | -------------------------------- | ------------- |
| Source webm      | 3420594612 → 309948011           | True          |
| Source mp4       | 3966374528 → 3849680048          | True          |
| Packaged webm    | 2543740689 → 309948011           | True          |
| Packaged mp4     | 3966374528 → 3849680048          | True          |

## Candidate artifacts — unreleased / unsigned

The **newly built** `Lunar-Browser-2.5.0-win-x64.exe` is `NotSigned`, CI-computed SHA-256 **`A704230882A9A8FD8334CB016B411C381B2F55B93558479B76A3D9FBCECD4D98`**. It is not the previous 2.4.1 EXE renamed. The actual packaged app was executed before hashing/upload. GitHub artifact authentication/retention applies; this is not a public release or an auto-update feed.

- [lunar-windows-x64-unsigned · 13678395050](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42622793883/artifacts/13678395050): ZIP **113,752,457 bytes**, `sha256:b83187ef3dd286e33a1c9a1f041abad9cf164c71a96f26ac99cc4e31a0a39105`.
- [chromium-renderer-evidence · 13677890219](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42622793883/artifacts/13677890219): ZIP **7,998,807 bytes**, `sha256:70c271c5d21e8ab5bc106e8c12ce48fcf3cb83beac5dfaecf850f971a7e66039`.
- [windows-material-evidence · 13676179260](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42622793883/artifacts/13676179260): ZIP **4,943,579 bytes**, `sha256:fd21131b9de7946a7e46e82d6100884c05a3e8f790a6f10f1e6b6f8922ec8555`.

Local evidence is under `.artifacts/liquid-engine/` and `.artifacts/ui/liquid*`; CI uploads the actual graphics/native screenshot/JSON folders. Manual installed-NSIS upgrade/uninstall, physical file/color dialogs, touch, multi-monitor/DPI, user media and sustained hardware performance remain distinct unverified checks. The package remains `UNLICENSED`. Do not disable Windows/antivirus protections or describe this unsigned candidate as a trusted/signed public release.

### Retained-control and scene regressions

A final audit found two inheritance paths that must not be left as CSS-only controls: changing dashboard text tone without changing the wallpaper, and changing saved theme radii on `:root`. The engine now observes root theme-token changes, tone attributes and the actual per-surface optical-strength variable. Production-browser probes assert the **drawn** dark/light shader tone and zero/restored shader radii, not just CSS. Additional scene coverage is retained in `scripts/liquid-scenes-checks.mjs` for Dock → Theme Studio and dark-wallpaper readability.

Graphics test readbacks use a disposable readback-only canvas from a snapshot of real output, never getImageData on the runtime output context. This avoids Chromium moving a production output context to CPU rendering because of diagnostic reads. Physics polling reads the submitted/painted uniform diagnostics and takes actual pixel captures before/after; it does not repeatedly read GPU pixels merely to poll a three-number spring state. Real pixel-difference, stable-repeat, stationary-hitbox and recovery assertions remain.

### Final visual/interaction review

Actual dark-scene screenshots exposed a light-theme hover background being paired with automatically dark-material white ink on the selected wallpaper button. Material-backed modal/sidebar/toolbar/widget hover controls now keep ink and backing paired; forced colors retain their system path. The actual Chromium dark scene checks the selected hovered button's resolved colors for an opaque background and at least 4.5:1 normal-text contrast. This is a specific regression check, not an accessibility certification.
