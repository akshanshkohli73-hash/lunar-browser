# Windows release gates

The project is not release-complete just because `npm run build` passes. Record machine/OS, Electron version, display scale, commands, actual outcomes and defects for each gate below.

## CI execution status (2026-10-17)

The workflow-write permission blocker is resolved and the assigned branch is published. [Run 39013794819](https://github.com/akshanshkohli73-hash/lunar-browser/actions/runs/39013794819) passed the Linux regression/build/Chromium-renderer job. Windows dependency installation succeeded, but a hard-coded POSIX path in a download-test assertion failed the regression check; native integration and packaging were skipped. The fixture has been made portable and the full local 76-test gate passes. The Windows rerun is still required; there is not yet a native pass or installer artifact. Manual release gates remain unchecked.

## Automated gates

- [ ] `npm ci` completes with normal TLS verification, including the real Electron runtime.
- [ ] `npm run check` passes on Windows.
- [ ] `npm run test:native` executes and passes (an explicit BLOCKED result is not a pass).
- [ ] Native test: different pages in independent tabs; back/forward/reload/stop; shell/page API isolation; geometry and utility occlusion; controlled Shield request blocked when enabled and received by the loopback server when disabled; actual unpacked content script/unload; downloaded bytes; malformed/unauthorized IPC rejection; restart and repeated tab cleanup.
- [ ] `npm run dist:win` creates the NSIS x64 installer and SHA-256 is recorded.
- [ ] CI logs/artifacts are reviewed. Unsigned CI installers are internal validation builds, not signed public releases.

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
