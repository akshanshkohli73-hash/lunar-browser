# Lunar Browser 2.6.0 — Aqua Coquette

**Windows x64 · unsigned prerelease · manual updates**

This release uses the **unchanged, newly built and tested 2.6.0 installer** from [successful verification run 43603502085](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/43603502085), source **`9bc0e9dd29136c6c4ec8bf0fdb7a80cb9926164b`**, artifact **`14118130231`**. It is not a renamed 2.5.0 EXE or an untested rebuild. Previous releases and their assets remain unchanged.

**Signing:** the user explicitly authorized an **unsigned prerelease**. Windows reports **Authenticode `NotSigned`**; no trusted certificate, self-signed trust, signing service or OS-warning bypass is added. Checksums prove byte identity, not publisher trust or general safety.

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

## Verification

- **259 tests / 34 files**, strict TypeScript, ESLint, production renderer/main/preload builds and package-input validation **PASS**. Production dependency audit: **0 vulnerabilities**.
- **PASS:** actual production Chromium UI/optical pixels, distinct presets, bounded localized ripple and exact recovery, fixed logical hit boxes, idle stop, intensity without texture reload, one shared context/owner, bright/dark contrast, geometry/input retention, responsive controls, context loss/restoration and all fallback/accessibility variants.
- **PASS:** real **Windows source Electron execution**, new **2.6.0 NSIS packaging** and **packaged-app execution**, including native navigation/tabs/bounds/overlays/security, persistent wallpaper lifecycle, MP4/WebM shader frames and pause stability, preview/cancel/apply/profile persistence, downloads and extensions.
- **PASS:** native acceptance/copy/decode at **52,428,800 image bytes** and rejection at **52,428,801 bytes**. This is a valid 320×200 PNG with synthetic ancillary padding, not a large-resolution performance benchmark.
- The actual source and packaged apps both report **2.6.0**, Electron **44.7.2** / Chromium **152.0.7977.149**, on Windows. The installer file/product versions also report **2.6.0**. This is runtime/resource evidence, not only a filename change.
- Exact source/job/artifact provenance, full archive and extracted EXE hashes are pinned before draft upload. Both assets are downloaded/rechecked before separate manual publication. No old installer is renamed and no untested rebuild replaces the verified artifact.

## Download and integrity

[Download `Lunar-Browser-2.6.0-win-x64.exe`](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.6.0/Lunar-Browser-2.6.0-win-x64.exe) · [SHA256SUMS.txt](https://github.com/akshanshkohli73-hash/lunar-browser/releases/download/v2.6.0/SHA256SUMS.txt)

```text
075435822e2eb7ea8c3b1eb212bf01efd0a47285cbae174b0ae3f74e33e181e5  Lunar-Browser-2.6.0-win-x64.exe
```

Installer size: **113,755,077 bytes**. Authenticode: **NotSigned**.

```powershell
(Get-FileHash .\Lunar-Browser-2.6.0-win-x64.exe -Algorithm SHA256).Hash
(Get-AuthenticodeSignature .\Lunar-Browser-2.6.0-win-x64.exe).Status # Expected: NotSigned
```

Original CI ZIP: **113,758,967 bytes**, SHA-256 **`89bc07075949bba3c8275a4494de2d41186360cfec6b624731253af0b0c94c44`**. The ZIP digest is distinct from the installer checksum above. The pinned artifact is staged without rebuilding; archive, extracted-file and release-upload/download checks gate manual publication. Anonymous public release-page/API/tag, installer and checksum downloads have also passed the pinned byte checks.

## Publication record

Manually published as a **public unsigned prerelease, not marked as latest**, after [one-time staging/public-integrity job 132475740514](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/43604379508/job/132475740514) passed source/native/package/artifact provenance checks, the full ZIP and extracted EXE hashes, and both draft upload/download checks. The same job then downloaded the release API, page, exact source tag, full installer and checksum from **anonymous public endpoints** and verified the bytes again.

Release ID: **445346245**. Installer asset: **747717230** (113,755,077 bytes). Checksum asset: **747717229** (98 bytes), SHA-256 **`63f013ca3251954678b643ccd582bc209b360f8f1e371c270bde2fd0814bb260`**. Source tag `v2.6.0` points exactly to **`9bc0e9dd29136c6c4ec8bf0fdb7a80cb9926164b`**; the new source and packaged runtimes and installer metadata all identify **2.6.0**. Earlier 2.2.0/2.4.0/2.4.1/2.5.0 releases and tags are unchanged.

The temporary draft-only stager is removed after this one authorized use. Regular verification remains read-only with explicit `--publish never`; no standing publisher, signature or updater is introduced. Subsequent documentation/cleanup builds do not replace these published bytes.

## Important limitations

- **Unsigned preview:** the installer is **Authenticode `NotSigned`**, not trusted/signed. Windows reputation, antivirus or Smart App Control may warn or block it. **Do not disable OS or antivirus protections.** Checksums establish byte identity, not publisher trust or general safety.
- This is an independent screen-space optical implementation, **not Apple-native Liquid Glass**, physical ray tracing or sampling of native webpage pixels. Unsupported native areas use readable clear material. CSS is not described as physical refraction.
- Software/virtual CI can show stalls and dropped frames. No sustained **60-FPS**, physical-GPU, 4K, battery, low-power or universal-codec guarantee is made. Performance/Balanced/High/Experimental and automatic fallback remain available.
- Human-installed NSIS upgrade/uninstall, physical dialogs/devices, personal media/codecs, complete assistive-technology/touch/high-DPI/multi-monitor coverage, live configured providers and sustained hardware profiling remain manual.
- Lunar Shield retains its disclosed filtering subset, not universal blocking/Brave parity/anonymity. Native pages remain sandboxed and have no privileged shell bridge. Provider secrets remain protected in the main process; no new credentials or signing service are requested.
- No standing publisher, updater/feed, npm package or app-store listing is enabled. The package remains **UNLICENSED**; this release grants no new redistribution license. Prior release assets, notes, tags, signatures and hashes are not replaced.

[Implementation, full file manifest, architecture, measured limits and controls](https://github.com/akshanshkohli73-hash/lunar-browser/blob/arena/8b00471f-lunar-browser/docs/AQUA-COQUETTE.md)
