# Lunar Browser 2.5.0 — Liquid Engine

**Windows x64 · unsigned prerelease · manual updates**

This release uses the **unchanged, tested installer** from [successful verification run 42629657311](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42629657311), source **`a7e3b2b17991ab11bb12555fd49a125b9651fae0`**, artifact **`13679369612`**. It is a new 2.5.0 build, not a renamed 2.4.1 installer or an untested rebuild. Earlier releases remain unchanged.

**Signing:** the installer is **Authenticode `NotSigned`**. After signing availability was checked, the user explicitly selected publication of this unsigned prerelease. No trusted certificate/service was available to use; no self-signed trust, signing-provider setup, Windows warning bypass or standing publisher/updater has been added. Checksums below prove byte identity, **not** publisher trust or general safety.

## What changed

- One shared **WebGL2 Liquid Engine** samples the actual wallpaper texture with curvature/edge refraction, Fresnel-inspired lighting and pointer-driven specular highlights. It is not static glass artwork or CSS blur presented as refraction.
- Bounded spring-based material deformation and coordinated toolbar/menu/dock/panel morphs preserve logical hit geometry and the existing focus/keyboard controllers.
- Existing profile-owned image and MP4/WebM playback is reused; Studio shares the existing desktop video instead of adding another decoder. Available-frame uploads, bounded atlases, idle/activity pause, resource cleanup and context recovery are implemented.
- **Performance / Balanced / High / Experimental** are real quality policies. Studio refraction, edge lensing, specular, curvature, elasticity, responsiveness, tint, blur and speed affect rendering/physics with preview/apply/cancel/reset and persistence.
- Lunar's pastel-green Coquette desktop, widgets, native browser architecture and security boundaries remain. Images support **50 MB**, videos **150 MB**, with the same **20-file / 300 MB** profile quota.

## Verification

- **224 tests / 28 files**, TypeScript, ESLint, production renderer/main/preload builds, package validation and production dependency audit (**0 vulnerabilities** at verification time).
- Actual production Chromium tested painted refraction/control pixels, moving specular at zero elasticity, finite press/recovery, unchanged hit boxes, idle stop, quality budgets, resizing, tone/geometry retention, real menu/dock material morphs, dark-control contrast, CSS fallback and actual restored-context pixels.
- **Windows source Electron execution, new unsigned NSIS packaging and packaged-app execution all passed.** No packaging/packaged test was skipped. Native navigation/tab/security/occlusion, widget resize/drag and Studio restart-persistence gates remain.
- Real **MP4 and WebM** imported through the native private-media path proved moving video texture/pixel updates and actual native-window refraction differences; paused repeats were stable, only one existing wallpaper video was used, and material-uniform changes did not reupload a paused frame.
- Both source and packaged execution accepted/copied/decoded exactly **52,428,800 image bytes** and rejected **52,428,801 bytes**. That boundary fixture is valid **320×200 PNG content with synthetic ancillary padding**, not a large-resolution performance benchmark.

## Download and integrity

[Download `Lunar-Browser-2.5.0-win-x64.exe`](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.5.0/Lunar-Browser-2.5.0-win-x64.exe) · [SHA256SUMS.txt](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.5.0/SHA256SUMS.txt)

```text
ecc0d6dec4033b9764da97358d644d1183b4dad61d0a3ea63306fbf5effa6a76  Lunar-Browser-2.5.0-win-x64.exe
```

PowerShell byte/signature inspection:

```powershell
(Get-FileHash .\Lunar-Browser-2.5.0-win-x64.exe -Algorithm SHA256).Hash
(Get-AuthenticodeSignature .\Lunar-Browser-2.5.0-win-x64.exe).Status # Expected: NotSigned
```

Original CI ZIP: **113,752,625 bytes**, SHA-256 **`d986b5ea24d706d25450c2cffced89af5154f52304a9cfff55a403e5bd300b1d`**. This is distinct from the installer checksum above. The [one-time draft-staging job 129674139393](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42769635200/job/129674139393) passed pinned source/job/artifact provenance checks, verified the full ZIP and extracted EXE hashes, then uploaded both assets and downloaded/rehashed them again. Installer size: **113,748,642 bytes**. These checks do not add an Authenticode signature.

## Publication record

Manually published `2026-11-10T06:37:59Z` as a public unsigned prerelease, not marked as latest, after [draft-staging job 129674139393](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/42769635200/job/129674139393) passed the archive/installer/upload/download checks. Anonymous release page/API, the exact source tag and both public download endpoints were then verified. Previous 2.2.0, 2.4.0 and 2.4.1 asset IDs, bytes/digests, source targets and release notes remain unchanged. The temporary draft-only stager was removed after use; the regular workflow remains verification-only with explicit no-publish packaging. No signature or auto-updater was added.

## Important limitations

- **Unsigned preview:** Windows reputation, antivirus or Smart App Control may warn or block it. **Do not disable OS/antivirus protections.** This release makes no trusted-publisher or warning-free-install claim.
- **Back up your profile before upgrading.** Dashboard v1/v2/v3 data migrate to v4 while retaining layouts, notes, media choices and material preferences. Older application versions do **not** understand v4 data.
- Glass samples Lunar-owned wallpaper, **not native webpage pixels**. It is an independent screen-space recreation of optical principles, not Apple-native glass, physical ray tracing or website capture.
- Software CI recorded real stalls and dropped video frames. No consistently smooth **60 FPS**, physical-GPU, 4K, low-power/battery or universal-codec guarantee is made. Prefer Balanced/Performance on constrained systems; detailed measurements disclose the observed drops.
- Human-installed NSIS upgrade/uninstall, physical dialogs, personal codecs/media, touch, high DPI, multi-monitor and sustained hardware profiling remain manual. Development-tool advisories were not suppressed or force-upgraded.
- Updates remain manual. No auto-updater/publisher, npm package or app-store listing was enabled. The package remains **UNLICENSED**; publication grants no new open-source/redistribution license. Existing third-party notices and capability disclosures remain applicable.

[Architecture, verification evidence and measured limits](https://github.com/akshanshkohli73-hash/lunar-browser/blob/arena/8b00471f-lunar-browser/docs/LIQUID-ENGINE.md)
