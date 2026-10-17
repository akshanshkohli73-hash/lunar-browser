# Windows release gates

The project is not release-complete just because `npm run build` passes. Record machine/OS, Electron version, display scale, commands, actual outcomes and defects for each gate below.

## CI execution status (2026-10-17)

[Run 39015958621](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39015958621), source revision `ec33afbd3d9b287ebaabf45dd235d909f3e21f8c`, is fully green: Linux regression/Chromium checks, Windows runtime installation, strict 80-test gate, expanded real native suite, NSIS packaging, hashing and artifact upload. The prior implicit-publishing failure is fixed with explicit `--publish never`; no token or release publishing is required.

### Verified internal artifact

- [Download `lunar-windows-x64-unsigned`](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39015958621/artifacts/12094054123); artifact ID `12094054123`, 113,024,572-byte ZIP according to GitHub metadata.
- Contains `Lunar-Browser-2.0.0-win-x64.exe` and `SHA256.txt`.
- **Installer** SHA-256, computed on Windows: `979358E6F8656EE0F1979F56CD4343995EBB51AA978A78CB3A24080C5B5B78A4`.
- ZIP digest reported separately by GitHub: `9674050b127e9d10e90c5070ca34368d9f7a6ef385e1b6ef4f720b4514b14b48`. Do not compare the ZIP with the installer hash.
- Actual Windows Authenticode result: **`NotSigned`**. This is an unsigned internal candidate, not a signed public release. Builder log wording about signing is not accepted as evidence of a signature.
- Artifact expiry currently `2027-01-15`; this is retained CI output, not a permanent release asset. No GitHub release was published.
- Metadata, job-step success and Windows hash/signature notices were inspected via the GitHub API. The installer was **not** downloaded or manually installed in this Linux workspace.

Verify the extracted installer with `(Get-FileHash .\Lunar-Browser-2.0.0-win-x64.exe -Algorithm SHA256).Hash`. A matching hash verifies these bytes, not that all release workflows below are complete. Unsigned builds can trigger Windows reputation/security warnings; do not disable OS or antivirus protection.

## Automated gates

- [x] `npm ci` and `npm run install:electron` complete with normal TLS/checksum verification, including the real Electron runtime (run 39015958621).
- [x] `npm run check` passes on Windows: 80 tests / 15 files (run 39015958621).
- [x] `npm run test:native` actually executes and passes on Windows (run 39015958621; not a BLOCKED result).
- [x] Native test: different pages in independent tabs; back/forward/reload/stop; shell/page API isolation; geometry and utility occlusion; controlled Shield request blocked when enabled and received by the loopback server when disabled; actual unpacked content script/unload; downloaded bytes; malformed/unauthorized IPC rejection; restart and exact repeated-close webContents cleanup; background focus retention and native Ctrl+L.
- [x] `npm run dist:win` creates the NSIS x64 installer and SHA-256 is recorded (run 39015958621).
- [x] CI job steps, check notices and artifact metadata reviewed; retained artifact contains installer/hash. Full redirected log/ZIP downloads are unavailable from this sandbox; no local byte rehash is claimed. Unsigned CI installers are internal validation builds, not signed public releases.

## Manual native workflows (not replaced by CI compilation)

- [ ] Clean launch; original Coquette art, menu, desktop shortcuts and dock; no duplicate browser workspace or React key warnings.
- [ ] Every original dock utility opens, focuses, closes and restores from minimized/closing states. Browser activation preserves tabs. Notes persist and report failed saves.
- [ ] Multiple representative HTTP/HTTPS sites; independent history; redirects; errors; loading/stop; pinned/muted/duplicated/reordered tabs; external mail/telephone confirmation; dangerous schemes denied.
- [ ] Resize, maximize, restore, minimize and display moves at 100%, 125%, 150% and 200% scaling. Native content never covers chrome/dock/utilities or stale inactive content.
- [ ] Camera, microphone, notifications, geolocation and clipboard: allow/deny/reset by origin; hidden and cross-origin frames denied; active capture behavior after reload/reset documented.
- [ ] Save As cancellation/overwrite, long downloads, supported pause/resume, cancellation while paused, interrupted transfer, file reveal after move/deletion and shutdown while downloading. No automatic execution.
- [ ] Add/edit/organize/delete bookmarks; history search/selected/all removal; logical backup-clearing behavior; opt-in restoration and corrupted/locked/full-disk profiles.
- [ ] Theme presets/custom tokens, import errors, restart persistence, native viewport updates after toolbar density changes, reduced motion, keyboard focus and text contrast.
- [ ] Run the real extension fixture; test at least one real compatible third-party extension. Record supported APIs/limitations rather than assuming complete Chrome compatibility.
- [ ] Configure a real AI provider/key/model; verify OS key protection and no key-returning IPC/logs. Test no-consent messages, one-message sharing consent, URL changes, timeout/auth/rate-limit errors and disabled/unconfigured browsing.
- [ ] Install into a clean Windows account, shortcut branding, upgrade, launch after install, uninstall without accidental profile deletion and reinstall. Test installed artifacts, not only `electron .`.

## Public distribution

- [ ] Review full dependency audit, including Electron/Chromium and build-tool advisories; refresh supported runtime versions and rerun native tests after upgrades.
- [ ] Choose/confirm licensing and product ownership metadata. The package is currently `UNLICENSED`; no new redistribution license is invented by this work.
- [ ] Authenticode-sign and timestamp the installer/executable using protected CI signing configuration. Never commit or send certificates, private keys or secrets in chat.
- [ ] Confirm SmartScreen/antivirus behavior on the signed installer, hashes, release notes and an update/security-maintenance policy.
- [ ] Document remaining limitations honestly. Do not label a local Linux build or renderer screenshot “Windows tested.”
