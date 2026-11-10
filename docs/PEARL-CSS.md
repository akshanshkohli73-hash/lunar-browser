# Aqua Coquette materials — Pearl CSS (unreleased)

This workspace update removes the 2.5.0-era SVG optical fallback. It does **not** replace, re-sign or publish the existing 2.5.0 installer, change the profile schema, or add an updater. Historical release notes and their SVG-era evidence describe the unchanged older binaries.

## Rendering contract

| Variant         | What actually renders                                                                                                                                          | Used for                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `liquid-webgl`  | The existing shared WebGL2 wallpaper-texture renderer, after a successful composition for that surface                                                         | Optical chrome, floating dock, search, widgets, menus and panel backings when available/enabled |
| `pearl-css`     | Pearl/aqua color layers, restrained static highlights, translucent rims, inner light and soft role-specific shadows; one bounded backdrop pass where supported | Automatic alternative to WebGL2, or an explicitly CSS-only surface                              |
| `clear-surface` | A quiet translucent pearl wash, thin edge and no additional backdrop or material canvas                                                                        | Address bar inside its toolbar, text-heavy Theme Studio forms and nested settings fieldsets     |

**Pearl CSS and Clear Surface are not physically refractive.** They do not sample a wallpaper texture, displace pixels, simulate water, or refract native webpage pixels. Refraction/lensing/curvature/elasticity controls are disabled when their real renderer is unavailable; saved values are retained. Decorative CSS reflection is a separate, real paint control, not an optical claim.

`shared/materials.ts` contains presentation-only variants, role profiles, the pearl/aqua palette and conservative readability floors. Existing `shared/glass.ts` preferences, sparse overrides, three depths, tint/opacity/blur controls, theme geometry and v4 persistence remain intact. CSS blur caps do not change saved values or the shader's original blur range.

```tsx
// Same dimensions/spacing, semantic children and hit/focus handling in every mode.
<GlassSurface materialRole="dock">…</GlassSurface> // automatic WebGL → Pearl CSS
<GlassSurface materialVariant="pearl-css" materialRole="search">…</GlassSurface>
<GlassSurface materialVariant="clear-surface" materialRole="control">…</GlassSurface>
```

The engine writes `data-material-variant="liquid-webgl"` only after actual pixels have been composed. The initial and failure paint is always CSS. `data-material-request` is the component's intent, not a claim that a GPU probe succeeded. Explicit CSS surfaces are not allocated individual output canvases or packed into the optical atlas. Switching an existing surface to CSS releases that output; switching back registers it once.

## Deliberate hierarchy

| Role                       | CSS blur cap | Treatment                                                                                                   |
| -------------------------- | -----------: | ----------------------------------------------------------------------------------------------------------- |
| Dock                       |         12px | Floating pearl with an aqua lower rim, broad static upper reflection and stronger soft elevation            |
| Homepage search            |          8px | Clear, gently illuminated shelf with centered upper light; existing prominent search typography and spacing |
| Menu bar                   |          4px | Relatively transparent, quiet chrome with a fine lower edge; no floating-card shadow                        |
| Toolbar / tabs / bookmarks |          6px | Transparent readable chrome, low reflection and very little elevation                                       |
| Address                    |          0px | Clear Surface on the toolbar; no nested blur or shader canvas                                               |
| Clock                      |          8px | Airier pearl and a wider side highlight; existing serif display/organic shape                               |
| Notes / reading widgets    |          6px | Calmer, deeper matte pearl, stronger readability backing and very little reflection                         |
| Other widgets              |         10px | Mid-depth material retaining individual shapes, controls and content hierarchy                              |
| Floating menus             |         10px | More readable pearl backing, restrained top light and distinct floating shadow                              |
| Panel backings             |         10px | Deeper supporting material; nested text controls do not repeat its backdrop pass                            |
| Nested forms / fieldsets   |          0px | Clear Surface, thin inner edge, no live sampling                                                            |

These are maximum radii, not a filter at every maximum. User blur zero remains zero; theme chrome blur scaling still works within the role cap. A retained legacy 14px setting gives the dock 11px of blur; the clearer fresh Aqua Coquette 4px setting gives it 3px. The hard CSS cap remains 12px. Inactive/Simple materials retain the same pearl vocabulary without a live backdrop. No-backdrop environments use a stronger readable pearl backing rather than transparency. Global glass off, reduced transparency and forced colors remain solid/high-contrast paths.

## Detection, recovery and performance

- WebGL2 context/program/texture/output creation and paint must succeed. Unsupported or disabled contexts, source/upload/composition errors and surface/atlas limits leave the corresponding CSS material visible. No SVG capability detection, filter definitions, displacement URLs, turbulence maps or wavy-border replacement remain in the active material system. SVG icons and existing artwork are not removed.
- Real `webglcontextlost` immediately stops GPU/video-frame work, clears lost output buffers, hides optical output and reinstates CSS. Background fill **does not animate from transparent** during this handoff. Layout, input identity, drafts, selection, focus and click targets are unchanged.
- Context restoration rebuilds the existing renderer and reuploads its source. Existing open menus settle without replaying entry morphs or fading their focused content. New menus opened later may still use their ordinary finite morph. Stale asynchronous compositions cannot promote an ineligible/removed/solid surface.
- CSS media guards also reinstate readable paint immediately for reduced motion, reduced transparency or forced colors, even if a previous GPU frame's backend/mode attributes are still in flight. The browser suite emulates the real preferences and checks this pre-subscriber handoff.
- Reduced motion disables decorative pointer movement, hover transforms and GPU morphing; the CSS reflections are already static, with **no continuous animation loop**. Existing keyboard/touch paths and accessibility overrides remain.
- The CSS fallback introduces no decoder, texture-copy pipeline, WebGL context, global animation timer or per-frame React state. Pointer lighting remains delegated, finite and shares the existing frame clock. React receives backend **status changes**, not frame telemetry unless the user opens the existing measurement disclosure.
- Prefixed backdrop declarations precede their standard counterparts. Actual production-browser assertions ensure the optimized CSS disables the CSS backdrop under WebGL; otherwise Chromium can retain a redundant pass even with a visible optical canvas. Clear Surface also always computes `backdrop-filter: none`.
- The renderer's shared atlas, one snapshot per composed frame, bounded surface budgets and video ownership remain unchanged. CSS is a designed alternative, not a claim of identical optical pixels or a performance/FPS guarantee.

## Verification

### Automated local gates

**Local result:** 233 tests in 30 files, TypeScript/ESLint/build/package validation, production audit (0 vulnerabilities), and the complete actual production Chromium 153 suite passed. The browser used a test-only software adapter; this is not physical-hardware certification or native Windows proof.

- `npm run check`: TypeScript, ESLint, unit/integration tests, renderer/main/preload build and package-policy/input validation.
- `npm audit --omit=dev`: production dependency audit. Development-tool advisories are not suppressed or force-upgraded by this rendering change.
- `npm run test:ui`: actual built production renderer in Chromium, not jsdom graphics. Existing strict shader optical-control/pixel, press/recovery, idle, quality, morph, resize, dark-scene, widget, Studio, menu/focus, layout, scroll, density and forced-color gates remain.
- `scripts/pearl-material-checks.mjs`: same mounted dock, search, menu bar, toolbar, address, notes/calendar and floating menu compared across actual WebGL → context loss → CSS → restored WebGL. Bounds, radii, borders, spacing and identities are retained; real pixels must return after restoration. The real editor draft, focus and selection survive. Explicit CSS intent releases/recreates exactly one output. Cold WebGL failure, cold no-backdrop, reduced motion, actual reduced-transparency and forced-color emulation (including the immediate CSS preference-handoff guard) remain editable and keyboard navigable, with no SVG filters, distorted content, transparent holes or decorative render loop.
- `tests/pearl-contrast.test.ts`: conservative interior token model at black/white wallpaper extremes, minimum/full opacity, extreme manual/adaptive tint and maximum overlapping highlights; primary/muted text must remain at least 4.5:1. Address is modeled on its actual toolbar owner. This is a model guard, **not universal accessibility certification** for custom artwork/content/themes.

Actual Chromium comparison evidence is written to ignored `.artifacts/ui/pearl-comparison.json` and separate `pearl-{webgl,css-context-lost,menu-webgl,menu-css,reduced-motion,forced-colors,reduced-transparency,cold-css,cold-no-blur}.png` captures. Color/layout readbacks use disposable diagnostic canvases, not the runtime material output contexts. Test-only software ANGLE/SwiftShader flags are not shipped application settings.

### Native/packaged gate

**Initial full Windows pass:** source `157fbf6a3f724ee8ae902b3b96e30f72c7605c0a`, [run 42778863012](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42778863012), including source Electron, NSIS packaging and packaged-app execution. The subsequent CSS-only preference-handoff guard has also passed the complete local production Chromium suite, real OS-preference emulation and the 233-test suite; branch CI reruns the Windows gates for it rather than inferring Windows results from the web preview.

The existing `Verify Lunar Browser` workflow runs real Windows source Electron, unsigned NSIS packaging, and the packaged `win-unpacked/Lunar Browser.exe`. `scripts/native-smoke.mjs` now also forces loss/restoration of the actual shared context and verifies the **enabled native address field** retains its draft, selection, focus and geometry. The renderer-only preview intentionally keeps that native field disabled; its equivalent editable-draft proof uses the real dashboard note rather than a fake bridge.

Native material readiness is observed atomically in one main-thread snapshot (backend, output visibility/dimensions, CSS filter/backing and OS preferences), so separate protocol reads cannot combine two different rendering modes during promotion. Failure annotations retain the complete observed state.

Native PNG/MP4/WebM import/decode, actual painted-video CSS blur smoothing, stable decorative CSS highlights, unchanged CSS pixels for a shader-only refraction change, live WebGL video refraction, single existing video ownership, security, navigation, viewport/overlay occlusion, resize/DND, persistence and profile retention continue to be gated. The native comparison evidence is emitted as `*-pearl-switch.json` and `*-pearl-context-lost.png` for both source and packaged runs.

This does not substitute a web preview for Electron, a packaged-app launch for a human-installed NSIS upgrade/uninstall, or software CI for physical GPU/touch/DPI/battery/codec testing. Publication remains manual and requires a separate request.
