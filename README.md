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

## Getting Started & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build & Package an Executable / Installer (.exe / .dmg / .AppImage)

To generate a standalone setup file (`.exe` on Windows, `.dmg` on macOS, or `.AppImage` on Linux), run:

```bash
npm run dist
```

The installer setup files will be generated inside the `release/` directory!
