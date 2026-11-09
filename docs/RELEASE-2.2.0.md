# Lunar Browser 2.2.0 — Liquid Glass preview

**Public prerelease · Windows x64 · unsigned installer**

This preview promotes the unchanged installer from [successful verification run 41663301595](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/41663301595), built from source `9e1106449a7b20e30ee1671850364c8a4be90e02`.

## What's included

- Shared Liquid Glass material across all nine existing widgets, with restrained translucency, blur, highlights, borders, reflections and shadows.
- Global/per-widget material controls, live preview, Apply/Cancel, inheritance/reset and a Simple no-blur mode for lower-powered systems.
- Preserved widget functionality and collision-aware layout, with visible editing selection, supported pointer/keyboard resizing and native HTML drag-and-drop.
- Existing Lunar control center, browser menus, network-only Lunar Shield, local image/video wallpapers and private media handling.
- Dashboard v1-to-v2 migration preserving widget configuration, layout, notes, events and wallpaper references. **Back up your profile before upgrading; older versions may not understand the migrated settings.**

## Verification

- Strict typecheck/lint, production build and **180 tests / 23 files** passed on Linux and Windows.
- Chromium UI checks covered all nine widget types, 20 simultaneous surfaces, bright/dark drafts, real material controls and fallbacks.
- Real Windows Electron and **packaged/app.asar-mode** integration passed, including MP4/WebM decoding/paint/seek behind glass, saved material settings after restart, pointer resizing, same-viewport native drag-and-drop and browser/security checks.
- NSIS x64 packaging completed. These are automated checks, not a claim of human-installed NSIS or hardware testing.

## Download and integrity

Download `Lunar-Browser-2.2.0-win-x64.exe`. `SHA256SUMS.txt` contains its checksum in standard SHA-256 format.

```text
2cf3a30c37a1542f54ab1d174b8674033a85b900bd7b8735d0f29e056c1afe20  Lunar-Browser-2.2.0-win-x64.exe
```

PowerShell verification:

```powershell
(Get-FileHash .\Lunar-Browser-2.2.0-win-x64.exe -Algorithm SHA256).Hash
```

A matching checksum verifies these bytes, **not** general safety, publisher identity or every hardware workflow.

## Important limitations

- **Authenticode status: NotSigned.** This is not a trusted/signed production release. Windows reputation, antivirus or Smart App Control may warn or block it. **Do not disable OS or antivirus protections.** No certificate, signing service or warning bypass is provided.
- Manual clean-account installation, upgrade/uninstall, physical OS dialogs/devices, cross-scroll/touch dragging, multi-monitor/high-DPI interaction and low-power GPU/FPS/battery profiling remain unverified.
- Balanced blur over moving video has GPU cost; Simple mode removes blur/reflections. Additional/hardware-dependent codecs and arbitrary user clips are not guaranteed.
- New application windows, reading list and offline saved pages remain explicitly unavailable. Extension support is partial. No anonymity, universal ad-blocking or fingerprinting-parity claim is made.
- Updates are manual; publishing this release does not add an auto-updater, npm package or app-store listing.
- The project package remains `UNLICENSED`; no new open-source/redistribution license is granted by this release. Included third-party notices remain applicable.
