# Lunar Browser 2.4.0 — Organic Liquid Glass

**Windows x64 · unsigned prerelease · manual updates**

This release promotes the **unchanged, verified 2.4.0 installer** from [successful verification run 42356488823](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42356488823), source `f81a83fe8c4eb9b214025a898c9c76d8cf8fc6b1`, artifact `13567721877`. It is not an older installer renamed as 2.4.0 or an untested rebuild.

## What's included

- Lunar's sage/ivory Coquette identity with three shared glass depths across widgets, browser chrome, panels and the dock.
- Controlled deterministic SVG backdrop displacement at Optical quality, real blur/saturation and restrained pointer lighting. Balanced CSS and Simple/solid fallbacks remain available. This is not physical ray tracing or refraction of native webpages.
- A proximity-based dock, fluid finite panel/settings/wallpaper transitions and reduced-motion/accessibility fallbacks; no perpetual floating or video-copy shader loop.
- Upgraded clock, notes, calendar, bookmark library, search and existing utility widgets. Existing browser controls, saved themes, layouts and wallpaper paths remain.
- Fourteen real material/motion controls with immediate preview, Apply/Cancel/reset and persistence. Retained theme blur, tab shape and corner-radius controls still affect rendering.
- Dashboard v1/v2-to-v3 migration preserving notes, events, widget configuration, layouts, material overrides and wallpaper references. **Back up your profile before upgrading; older application versions do not understand the v3 material schema.**

## Verification

- **205 tests / 26 files**, strict typecheck/lint, production builds and package validation passed on Linux and Windows. Production dependency audit: **0 vulnerabilities** at verification time; development-tool advisories are not hidden.
- Actual Chromium pixel/layout/interaction checks passed, including bright/dark materials, responsive Studio actions, animated-menu keyboard replacement, proximity hit targets and unsupported-SVG/no-WebGL fallbacks.
- Real Windows source Electron and **packaged `win-unpacked/Lunar Browser.exe`** integration passed: profile-owned image/MP4/WebM decode and paint, real blur smoothing, changed SVG optical pixels with stable repeated captures, native-view occlusion during animated panel exits, browser/security checks and persistence.
- A new x64 NSIS installer was generated. These are automated checks, **not** human-installed NSIS, universal-codec or hardware-performance certification. Video observations used tiny synthetic clips and software compositing.

## Download and integrity

[Download `Lunar-Browser-2.4.0-win-x64.exe`](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.0/Lunar-Browser-2.4.0-win-x64.exe) · [SHA256SUMS.txt](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.0/SHA256SUMS.txt)

```text
8cc0584e34a65158e0424d89796a131584a365373400b020e723e4f343370651  Lunar-Browser-2.4.0-win-x64.exe
```

PowerShell verification:

```powershell
(Get-FileHash .\Lunar-Browser-2.4.0-win-x64.exe -Algorithm SHA256).Hash
```

A matching checksum verifies the bytes, **not** general safety or publisher identity. The original CI artifact ZIP digest is `2ba30b32f462e2bd22c1f378be70cf71696a659f8fd5dd59787237e5c4ff4947`; this is distinct from the installer checksum above.

## Important limitations

- **Authenticode: NotSigned.** Windows reputation, antivirus or Smart App Control may warn or block this unsigned preview. **Do not disable OS or antivirus protections.** No signing certificate, trusted-publisher claim or warning bypass is provided.
- Human clean-account installation, upgrade/uninstall, physical OS dialogs, personal codecs, touch/cross-scroll dragging, multi-monitor/high-DPI interaction and low-power GPU/4K/FPS/battery testing remain manual checks.
- Optical/blur compositing has device-dependent cost. Choose Balanced or Simple on lower-powered devices. No physical lens, arbitrary native webpage refraction or accessibility certification is claimed.
- Existing browser limitations remain: partial extension support; no anonymity, universal blocking or fingerprinting-parity claim. Some controls are explicitly unavailable rather than simulated.
- Updates remain manual. This publication does not enable an auto-publisher, auto-updater, npm package or app-store listing.
- The package remains **`UNLICENSED`**; no new open-source or redistribution license is granted. Included third-party notices remain applicable.
