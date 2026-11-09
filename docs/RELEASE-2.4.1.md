# Lunar Browser 2.4.1 — 50 MB background images

**Windows x64 · unsigned prerelease · manual updates**

This release promotes the **unchanged, tested installer** from [successful verification run 42600154938](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42600154938), source `e60fdf2ad1719f23da18850e2ef96c124db72709`, artifact `13665926660`. It is not a renamed 2.4.0 installer or an untested rebuild. The existing 2.4.0 release is unchanged.

## What changed

- Local background **images now support up to 50 MB**, inclusive (50 × 1024 × 1024 bytes), instead of 20 MB.
- Native import validation, error messages and Dashboard Studio help text share the same limit definition.
- **MP4/WebM remain at 150 MB.** The 20-file / 300 MB profile storage quota, supported-format checks, private media protocol and asynchronous chunked copying remain in place.
- Existing themes, layouts, notes, wallpapers, Organic Liquid Glass controls and browser functionality are retained. No new dashboard schema migration is introduced by this patch.

## Verification

- **210 tests / 26 files**, typecheck, lint, production builds and package validation passed on Linux and Windows; production dependency audit passed with **0 vulnerabilities** at verification time. Development-tool advisories were not suppressed or force-upgraded.
- Actual Chromium UI, pixel, layout, interaction and fallback checks passed.
- **Real Windows source Electron integration, unsigned NSIS packaging and packaged-app integration all passed.** Neither installer packaging nor packaged testing was skipped.
- In **both source and packaged execution**, the native file-selection/IPC/import/private-media path accepted and fully copied **52,428,800 bytes**, then decoded the wallpaper. A file of **52,428,801 bytes** was rejected without another asset/partial copy; restoration and pruning were checked.
- That boundary PNG is a valid **320×200 synthetic checker with ancillary padding**, not a 50 MB personal photo or large-resolution performance benchmark. Existing MP4/WebM decode/paint/seek, actual blur/optical displacement with stable repeated captures, native occlusion, resize/drag, browser/security and persistence gates also passed.

## Download and integrity

[Download `Lunar-Browser-2.4.1-win-x64.exe`](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.1/Lunar-Browser-2.4.1-win-x64.exe) · [SHA256SUMS.txt](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.4.1/SHA256SUMS.txt)

```text
d695343e49323b1950bc979a4879a57c95ae47d452f86d71e55da1f36dac51f6  Lunar-Browser-2.4.1-win-x64.exe
```

PowerShell verification:

```powershell
(Get-FileHash .\Lunar-Browser-2.4.1-win-x64.exe -Algorithm SHA256).Hash
```

The original CI artifact ZIP SHA-256 is `2b61ca2d282035025714e5a4c9efd57a088172c6ba78e67671b60e159d46a293`. This is distinct from the installer checksum above. A matching checksum verifies byte identity, **not** general safety or publisher trust.

## Important limitations

- **Authenticode: NotSigned.** Windows reputation, antivirus or Smart App Control may warn or block this unsigned preview. **Do not disable OS or antivirus protections.** No certificate, trusted-publisher claim or security-warning bypass is provided.
- Back up your profile before upgrading. Human-installed NSIS upgrade/uninstall, physical OS dialogs, personal codecs, touch/multi-monitor/high-DPI and low-power/large-display hardware checks remain manual. Older application versions may not understand dashboard-v3 data introduced in 2.4.0.
- The tests use small synthetic imagery/video and software compositing; no universal FPS, GPU/battery improvement, physical refraction, arbitrary-codec support or accessibility certification is claimed.
- Updates remain manual. This release does not enable an auto-publisher, auto-updater, npm package or app-store listing.
- The package remains **UNLICENSED**; publication grants no new open-source/redistribution license. Existing third-party notices and browser capability disclosures remain applicable.
