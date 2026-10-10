# ☾ LUNAR BROWSER

A private, intelligent, beautiful Chromium desktop browser built with Electron, React, TypeScript, Vite, and Tailwind CSS.

---

## Features

- **Chromium Page Rendering**: Built on modern Electron `WebContentsView` architecture (not iframes).
- **Tab System**: Create, close, switch, pin, mute, duplicate, and reorder tabs.
- **Lunar Shield**: Advanced built-in ad, tracker, telemetry, cryptomining, and popup blocker.
- **Integrated AI Assistant**: AI sidebar supporting page summaries, term explanations, Q&A, and screenshot context (OpenRouter/Gemini support).
- **Lunar Extensions**: Load unpacked Chrome WebExtensions with permission inspection and diagnostics.
- **Command Palette (`Ctrl+K` / `Ctrl+Space`)**: Fast keyboard-driven command execution and tool navigation.
- **Reader Mode**: Distraction-free article reader mode.
- **Local Storage**: Built-in persistence for bookmarks, history, settings, and workspaces stored locally.

---

## Building and Packaging Executables

To build the project and package standalone binaries/installers:

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Web and Main Bundles
```bash
npm run build
```

### 3. Build & Package Release (.exe / .AppImage / .dmg)
```bash
npm run dist
```

Packaging artifacts are created under `release/` when running `npm run dist`.
