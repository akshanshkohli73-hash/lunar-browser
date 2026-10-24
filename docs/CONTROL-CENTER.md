# Lunar control center & video repair — 2026-10-24

## Preserved baseline / audit

Started from the installed-and-launching 2.0.1 source on `arena/8b00471f-lunar-browser`. Existing README/implementation-log edits were retained; their original patch/status was saved under ignored `.artifacts/control-center-baseline/`. No repository replacement, branch switch, profile deletion, paid signing service or release publication.

Audited `CoquetteDesktopPortfolio.jsx` (`ge` desktop entries, `Le` 17-item dock, `ue`/`it`/`D` handlers, `Rt` Launchpad, `Et` Spotlight and desktop context menu), `DesktopMenuBar.tsx`, shell composition, App/internal routing, native tab/bounds management, preload/IPC schemas, Theme Studio/dashboard drafts, storage, media copying/protocol, CSS and playback effects. The application used **custom renderer chrome**, not an Electron native application menu (`Menu.setApplicationMenu(null)`); the redesign remains a renderer menu.

## A. Actual video diagnosis

Flow: Theme Studio → Background & dock → native `chooseWallpaper` → main-only dialog → magic-checked asynchronous profile copy → opaque UUID returned to UI → dashboard draft → Apply → validated atomic `dashboard.json` → UI-only `lunar-media://wallpaper/<UUID>` GET/HEAD/ranges → `<video>` in the new-tab background. Source paths are deliberately **not** persisted/exposed to renderer webpages. Packaged resolution uses the user profile, not paths relative to `app.asar`; deleting the originally selected file should not delete the profile copy.

Before changing player code, generated real local, silent H.264-baseline MP4 and VP8 WebM samples and added native Windows probes. Run **40106071261** passed actual decoding and advancing playback for both formats on the old implementation: neither a blanket local-file-access workaround nor a protocol/security relaxation was justified.

Then reproduced a real failure with a truncated MP4 container. Run **40107059632** reported exactly:

```text
Decoder retry defect: {"code":4,"paused":true,"ready":0}; controls=["Pause wallpaper"]
```

**Confirmed defect:** UI playback intent was treated as actual playback success. Decoder errors / rejected `play()` promises only set a generic error flag, leaving a stale Pause control. Retry did not reload a failed source; Play was deferred to an effect whose previous cleanup could pause a new user-initiated attempt. The original desktop “Change Wallpaper” was also an unrelated four-preset portfolio switch, not the profile-backed new-tab image/video system.

**Repair:** failed playback now enters a retryable paused state; media error categories distinguish read/network, decode/unsupported codec and autoplay policy. Explicit Play reloads a failed element when necessary and calls `play()` inside the click gesture. Source/unmount cleanup is separated from playback-state effects, stale/inactive promise rejections are ignored, and changing unrelated widget settings does not remount the source. Default/resumed sound is muted, loop is retained, manual sound controls remain explicit, reduced motion offers deliberate Play, and inactive/hidden/unfocused playback pauses. Media has an explicit noninteractive layer below widget hit targets. No unrestricted `file:` access, renderer filesystem bridge, autoplay-policy bypass or codec-transcoding claim was added.

This proves a concrete existing failure and repair target; it does **not** establish the codec/corruption status of an unknown user clip that was never supplied. Unsupported codecs remain unsupported and must report a useful error.

## B. Shortcut replacement / data preservation

`src/state/control-center.ts` is the one registry used by the desktop, nine-item dock, launcher, Window menu and command palette. `LunarDesktop` reuses the original **CoquetteFrame**, palette and artwork while permanently mounting the existing App. Panels render in its page viewport; no new BrowserWindows or portfolio-style utility instances are created. Opening a panel reuses an existing internal tab when possible and preserves the originating website. Active dock state follows the actual page; native content detaches while menus/launcher/dialogs cover it.

| Old visible entry                                                    | New destination / disposition                                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lunar Browser / original start shortcut                              | **Home** — actual new-tab dashboard                                                                                                                                        |
| Notes / Now / Calendar                                               | **Widgets** — real registry/configuration/layout editor, notes/calendar/focus widgets; previous Quick Notes remain readable/editable inside Widgets                        |
| Theme Studio / unrelated Change Wallpaper                            | **Appearance** — Theme Studio, profile-backed image/video backgrounds, effects and dock settings                                                                           |
| Preferences                                                          | **Settings** — browsing/startup/privacy/permissions/AI preferences                                                                                                         |
| Extensions                                                           | **Extensions** — existing real manager                                                                                                                                     |
| Finder / Websites / portfolio folders / Gallery                      | **Library** — existing bookmark folders; reading list and offline saved pages explicitly **not yet available**, disabled                                                   |
| About Me / Contact Me / Mail / Messages / Skills / Music Box / Trash | Retired from the installed desktop, dock, launcher and context menu; replaced by the nine browser destinations, including **Lunar Shield**, **Activity** and **Downloads** |
| Launchpad / Spotlight / Show All Work                                | **Lunar controls** — searchable launcher with exactly the same nine destinations                                                                                           |
| Generic Get Info / Clean Up / New Message context actions            | Retired; desktop context menu uses the actual browser View actions                                                                                                         |

The standalone historical portfolio component/artwork source and its regression tests remain, but the installed browser does **not** mount its shortcut, utility, dock, menu or launcher registry. Its old UI-session Quick Notes data is not deleted. No fabricated reading-list, saved-page, mail, messaging or update service was introduced.

## C. Custom menu actions

| Menu      | Implemented actions                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lunar     | About, control launcher, Settings, quit the owning application window                                                                                                           |
| File      | New/close/duplicate tab, Downloads; **New window disabled** (single application window)                                                                                         |
| Edit      | Undo/redo/cut/copy/paste/select-all through fixed Electron commands; restores the original chrome input selection or targets the active website, never returns clipboard values |
| View      | Reload/bypass cache, website-only bounded zoom/reset, fullscreen, dashboard, desktop toggle, Appearance; zoom clearly disabled on internal pages                                |
| History   | Local recent entries, Activity, confirmed clear-history action                                                                                                                  |
| Bookmarks | Bookmark current website, manage/open real bookmarks; reading list/offline saving explicitly disabled                                                                           |
| Window    | All nine panels plus actual tab switching and active marks                                                                                                                      |
| Help      | Shared keyboard-shortcut reference, diagnostics and real app/runtime version information                                                                                        |

Arrow/Home/End/Escape handling, outside dismissal, focus restoration, F10 menu focus and existing native-page shortcuts are retained/covered. Main/preload expose only a strict command enum, explicit editing target and non-secret runtime metadata. No arbitrary script, IPC channel, filesystem target or clipboard-read response is exposed. Native/default menu accelerators are not duplicated. Chrome zoom stays 1 so DOM bounds remain content DIPs; website zoom and F11 are handled once by TabManager.

## D. Changed areas

- `CoquetteDesktopShell`, `LunarDesktop`, `DesktopMenuBar`, `control-center`: one mounted workspace and one consistent registry/menu system. Original frame/art remains in `CoquetteDesktopPortfolio`; historical example chrome is isolated under `legacy/`.
- `App`, `ControlPages`, `CommandPalette`, `LibraryView`, `ThemeStudioView`, `DashboardStudio`, `SettingsView`, `BrowserContext`: route real panels, explicit unavailable features, scoped previous-site Shield controls, shared keyboard help, dedicated widget editor and persistent drafts.
- `Wallpaper.tsx`, `index.css`: playback/error/retry/lifecycle repair, nonintercepting stacking, cohesive green SVG chrome, responsive dock and accessible focus/active/disabled states. Clear-history status is in chrome flow so a native child cannot cover its dismiss control.
- `shared/{api,navigation}`, main/preload, `browser/{commands,tab-manager}`, Shield getter: validated narrow menu operations, known internal URLs, website zoom/fullscreen and site-specific diagnostics. Security/session boundaries remain intact.
- New/extended tests plus small generated fixtures; native script adds codec, painted-frame, seek, pointer, Appearance apply, source-deletion/restart, reduced-motion, menu/edit/clear-history and real-panel assertions. Existing Windows workflow adds a **packaged-app** execution gate after NSIS building, with an explicit command-line + environment isolated test profile; ordinary installed launches do not use it.

## E. Executed checks / current status

| Command / gate                                          | Actual result so far                                                                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                         | **Exit 0: 149 tests / 21 files**, TS, ESLint, production renderer/main/preload build and package-input validation.                                                                                                             |
| `npm run test:ui` (external Chromium 153)               | **Exit 0**, actual renderer layout/hit targets, all nine panel routes, searchable launcher, eight menus/keyboard navigation, one permanent workspace, preview/cancel, narrow stacking and dock bounds; no page/console errors. |
| `npm audit --omit=dev`                                  | **Exit 0, 0 production advisories.**                                                                                                                                                                                           |
| `node --check scripts/native-smoke.mjs` / targeted lint | **Exit 0** after preserving error causes in the diagnostic probe.                                                                                                                                                              |
| Old-player Windows video run `40106071261`              | **Passed** real MP4/WebM decoding/advancing playback; not proof of the new UI or packaged application.                                                                                                                         |
| Old-player Windows regression `40107059632`             | **Failed (exit 1)** with the genuine decoder/incorrect-Pause state above; intentional reproduction, not a passed gate.                                                                                                         |
| New Windows native + packaged tests                     | **Pending** until the current implementation is actually run in Windows CI. No local Electron binary/display is available; compilation and media-method mocks are not codec proof.                                             |

Local renderer command:

```sh
LD_LIBRARY_PATH=/tmp/al2023/lib CHROMIUM_PATH=/tmp/chromium \
UI_TEST_CHROMIUM_ARGS='["--no-zygote","--disable-gpu","--disable-dev-shm-usage"]' npm run test:ui
```

The temporary FFmpeg/Chromium tools are ignored test tooling, not application dependencies or Electron security flags. Production stays on the pinned Electron/builder/lockfile; NSIS profile retention and `--publish never` remain. Version is **2.1.0** to distinguish this control-center build from the already-working 2.0.1 installer.

Manual installed Windows NSIS upgrade/uninstall, physical device/audio behavior, additional codecs/GPU drivers and multi-monitor DPI must still be tested on suitable hardware. Automated native/packaged results will be appended when known. Screenshots under ignored `.artifacts/ui/` were inspected for menu/dock/dashboard spacing and actual onscreen layout; they are renderer evidence, not a manual installed-app claim.
