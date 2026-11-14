# Lunar Browser 2.6.0 — Aqua Coquette

**Windows x64 · unsigned prerelease · manual updates**

**Release preparation:** the user explicitly authorized publication of this unsigned prerelease. Fresh **2.6.0** source verification, a new versioned NSIS installer, packaged-app execution and exact artifact/upload/download checks must pass before publication. The already-tested 2.5.0 Aqua implementation is the code baseline, **not** a substitute 2.6.0 installer. Final source/run/artifact/checksum/publication evidence will be recorded here after those gates complete. Previous releases and their assets remain unchanged.

## What changed

- **Aqua Coquette / Aqua Moonlit:** coordinated mint, pearl, aqua, lilac and teal tokens, paired readable inks, differentiated shared materials and preserved original Coquette artwork, palettes and frame.
- **Water Lens / Pearl Glass / Crystal:** distinct presets on the same shared optical engine, real saved 0–100% intensity, mint/aqua/lilac/adaptive/custom tints and Subtle/Gentle/Dynamic motion. Preview/apply/cancel/reset and fractional values genuinely reach their rendering targets without resetting quality, accessibility preferences or sparse widget overrides.
- **Actual wallpaper optics:** one WebGL2 context/program/background texture and packed atlas, finite localized press ripples, restrained dispersion, spring recovery and calm current-video-frame flow. Text/icons remain ordinary crisp DOM. SVG optical filters stay removed; the Pearl CSS fallback is explicitly non-refractive.
- **Accessible floating tabs:** manual activation, one roving tab stop, Arrow/Home/End exploration, Enter/Space activation, Delete/focus recovery, overflow controls, automatic reveal, actual HTML drag ordering and bounded create/remove/active-light motion. Closed native tabs no longer leave invisible projection controls mounted.
- **Persistent wallpaper:** desktop, Home and Theme Studio share the existing image/video owner and decoder. Preview reuses its texture; controls move to the active view. Native-page coverage/inactivity pauses video; returning resumes muted, and audio always requires explicit unmute.
- **Coordinated existing interface:** menu/toolbar/address/search, original vector Lunar dock, local-time greeting, nine configurable widgets and real Shield navigation. Existing native browsing, profile data, registry/collision packing, shortcuts and security boundaries are preserved.
- **Resource lifecycle fixes:** settled/zero-intensity glass stops rendering, one strip observer is retained, overflow is remeasured after tab removal, recoverable driver context loss wins over racing submission failures, and stale asynchronous work cannot poison restored resources. No per-widget GL contexts, React frame-state loop, extra decoder or native-webpage capture.

## Existing profiles and upgrade

- **Back up your profile before upgrading**, including the application's folder under `%APPDATA%` when the app is closed.
- This release keeps dashboard **schema 4**, the same application identity, existing data and non-destructive NSIS profile-retention policy. It does not silently replace saved palettes/materials or add a new schema migration. Older versions that do not support schema 4 must not be used against that data.
- Fresh profiles start with Aqua Coquette and Water Lens. To opt in on an existing profile, open **Appearance → Curated palettes → Aqua Coquette**, then **Background & dock → Aqua Coquette material → Water Lens → Apply dashboard**. Overall **Liquid intensity** is under **Your own touch**.
- Images retain the **50-MB inclusive** import limit; videos **150 MB**, with **20 files / 300 MB** profile quota. Updates remain manual.

## Verification required before publication

- **259 tests / 34 files**, strict TypeScript, ESLint, production renderer/main/preload builds, package-input validation and production dependency audit.
- Actual production Chromium UI/optical pixels, distinct presets, bounded localized ripple and exact recovery, fixed logical hit boxes, idle stop, intensity without texture reload, one shared context/owner, bright/dark contrast, geometry/input retention, responsive controls, context loss/restoration and all fallback/accessibility variants.
- Real **Windows source Electron execution**, new **2.6.0 NSIS packaging** and **packaged-app execution**, including native navigation/tabs/bounds/overlays/security, persistent wallpaper lifecycle, MP4/WebM shader frames and pause stability, preview/cancel/apply/profile persistence, downloads and extensions.
- Native acceptance/copy/decode at **52,428,800 image bytes** and rejection at **52,428,801 bytes**. This is a valid 320×200 PNG with synthetic ancillary padding, not a large-resolution performance benchmark.
- Pin the successful source commit, workflow/jobs and artifact; verify the full archive hash and extracted EXE hash. Upload only those unchanged bytes into an unpublished draft, download/recheck both assets, then separately publish after these checks pass. No old installer is renamed and no untested rebuild replaces the verified artifact.

## Download and integrity

The new release is **not published yet**. When publication completes, this section will contain the direct installer/checksum URLs, exact SHA-256, signing status and verification provenance. The existing public [2.5.0 release](https://github.com/akshanshkohli73-hash/lunar-browser/releases/tag/v2.5.0) is not modified.

## Important limitations

- **Unsigned preview:** the installer will be **Authenticode `NotSigned`**, not trusted/signed. Windows reputation, antivirus or Smart App Control may warn or block it. **Do not disable OS or antivirus protections.** Checksums establish byte identity, not publisher trust or general safety.
- This is an independent screen-space optical implementation, **not Apple-native Liquid Glass**, physical ray tracing or sampling of native webpage pixels. Unsupported native areas use readable clear material. CSS is not described as physical refraction.
- Software/virtual CI can show stalls and dropped frames. No sustained **60-FPS**, physical-GPU, 4K, battery, low-power or universal-codec guarantee is made. Performance/Balanced/High/Experimental and automatic fallback remain available.
- Human-installed NSIS upgrade/uninstall, physical dialogs/devices, personal media/codecs, complete assistive-technology/touch/high-DPI/multi-monitor coverage, live configured providers and sustained hardware profiling remain manual.
- Lunar Shield retains its disclosed filtering subset, not universal blocking/Brave parity/anonymity. Native pages remain sandboxed and have no privileged shell bridge. Provider secrets remain protected in the main process; no new credentials or signing service are requested.
- No standing publisher, updater/feed, npm package or app-store listing is enabled. The package remains **UNLICENSED**; this release grants no new redistribution license. Prior release assets, notes, tags, signatures and hashes are not replaced.

[Implementation, full file manifest, architecture, measured limits and controls](AQUA-COQUETTE.md)
