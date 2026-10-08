import React, { useState, useEffect } from 'react';
import Window, { WindowState } from './Window';
import Dock, { DockItem } from './Dock';
import App from './App';
import SettingsView from './SettingsView';
import ExtensionsView from './ExtensionsView';
import ThemeStudioView from './ThemeStudioView';
import NotesView from './NotesView';
import { BUILTIN_THEMES, applyThemeTokens, ThemeTokens } from '../styles/themes';

export const DesktopShell: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeTokens>(BUILTIN_THEMES['lunar-coquette']);
  const [activeWindowId, setActiveWindowId] = useState<string>('browser');
  const [topZIndex, setTopZIndex] = useState<number>(10);
  const [timeStr, setTimeStr] = useState<string>('');
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    applyThemeTokens(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
          ' ' +
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const [windows, setWindows] = useState<Record<string, WindowState>>({
    browser: {
      id: 'browser',
      title: 'Lunar Browser',
      icon: '🌐',
      component: <App />,
      isOpen: true,
      isMinimized: false,
      isMaximized: true,
      position: { x: 80, y: 50 },
      size: { width: 1000, height: 650 },
      zIndex: 10,
    },
    bookmarks: {
      id: 'bookmarks',
      title: 'Finder - Bookmarks & Files',
      icon: '📁',
      component: (
        <div className="p-8 h-full bg-[var(--lunar-bg)] text-[var(--lunar-text)]">
          <h2 className="text-lg font-bold mb-4">📁 Favorites & Bookmarks</h2>
          <div className="grid grid-cols-4 gap-4">
            {['School', 'Gaming', 'Research', 'Coding'].map((folder) => (
              <div key={folder} className="p-4 rounded-xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] flex flex-col items-center gap-2 hover:border-[var(--lunar-primary)] cursor-pointer">
                <span className="text-3xl">🎀</span>
                <span className="text-xs font-semibold">{folder}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 120, y: 80 },
      size: { width: 700, height: 450 },
      zIndex: 5,
    },
    notes: {
      id: 'notes',
      title: 'Notes & TextEdit',
      icon: '📝',
      component: <NotesView />,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 180, y: 100 },
      size: { width: 500, height: 400 },
      zIndex: 6,
    },
    settings: {
      id: 'settings',
      title: 'System Preferences',
      icon: '⚙️',
      component: <SettingsView />,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 140, y: 70 },
      size: { width: 850, height: 550 },
      zIndex: 7,
    },
    themestudio: {
      id: 'themestudio',
      title: 'Theme Studio',
      icon: '🎨',
      component: (
        <ThemeStudioView
          currentTheme={currentTheme}
          onThemeChange={(newTheme) => {
            setCurrentTheme(newTheme);
            applyThemeTokens(newTheme);
          }}
        />
      ),
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 160, y: 90 },
      size: { width: 900, height: 600 },
      zIndex: 8,
    },
  });

  const handleFocusWindow = (id: string) => {
    const nextZ = topZIndex + 1;
    setTopZIndex(nextZ);
    setActiveWindowId(id);
    setWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        isMinimized: false,
        zIndex: nextZ,
      },
    }));
  };

  const handleCloseWindow = (id: string) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false },
    }));
  };

  const handleMinimizeWindow = (id: string) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true },
    }));
  };

  const handleMaximizeWindow = (id: string) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], isMaximized: !prev[id].isMaximized },
    }));
  };

  const handleUpdatePosition = (id: string, pos: { x: number; y: number }) => {
    setWindows((prev) => ({
      ...prev,
      [id]: { ...prev[id], position: pos },
    }));
  };

  const handleDockClick = (id: string) => {
    const win = windows[id];
    if (!win) return;
    if (!win.isOpen) {
      const nextZ = topZIndex + 1;
      setTopZIndex(nextZ);
      setActiveWindowId(id);
      setWindows((prev) => ({
        ...prev,
        [id]: { ...prev[id], isOpen: true, isMinimized: false, zIndex: nextZ },
      }));
    } else if (win.isMinimized) {
      handleFocusWindow(id);
    } else if (activeWindowId === id) {
      handleMinimizeWindow(id);
    } else {
      handleFocusWindow(id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-titlebar') || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const dockItems: DockItem[] = Object.values(windows).map((w) => ({
    id: w.id,
    title: w.title,
    icon: w.icon,
    isOpen: w.isOpen,
    isMinimized: w.isMinimized,
  }));

  return (
    <div
      onContextMenu={handleContextMenu}
      onClick={() => setContextMenuPos(null)}
      className="relative w-screen h-screen overflow-hidden select-none bg-[var(--lunar-bg)] text-[var(--lunar-text)]"
    >
      {/* TOP MACOS MENU BAR */}
      <div className="flex items-center justify-between h-7 px-4 bg-[var(--lunar-bg-secondary)]/90 backdrop-blur-md border-b border-[var(--lunar-border)] text-xs z-40">
        <div className="flex items-center gap-4 font-medium">
          <span className="font-bold text-[var(--lunar-primary)] cursor-pointer">☾ Lunar macOS</span>
          <span className="cursor-pointer hover:text-[var(--lunar-primary)]" onClick={() => handleDockClick('browser')}>
            Browser
          </span>
          <span className="cursor-pointer hover:text-[var(--lunar-primary)]" onClick={() => handleDockClick('bookmarks')}>
            Finder
          </span>
          <span className="cursor-pointer hover:text-[var(--lunar-primary)]" onClick={() => handleDockClick('themestudio')}>
            Theme Studio
          </span>
          <span className="cursor-pointer hover:text-[var(--lunar-primary)]" onClick={() => handleDockClick('settings')}>
            Preferences
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--lunar-text-muted)]">
          <span>🛡️ Shield Active</span>
          <span>✨ Lunar AI</span>
          <span>{timeStr}</span>
        </div>
      </div>

      {/* DESKTOP ICONS / SHORTCUTS */}
      <div className="p-6 grid grid-cols-1 gap-6 w-32 relative z-10">
        {[
          { id: 'browser', title: 'Lunar Browser', icon: '🌐' },
          { id: 'bookmarks', title: 'Bookmarks / Finder', icon: '🎀' },
          { id: 'notes', title: 'Quick Notes', icon: '📝' },
          { id: 'themestudio', title: 'Theme Studio', icon: '🎨' },
          { id: 'settings', title: 'Settings', icon: '⚙️' },
        ].map((item) => (
          <div
            key={item.id}
            onDoubleClick={() => handleDockClick(item.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/10 cursor-pointer group transition"
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] flex items-center justify-center text-2xl group-hover:scale-110 group-hover:border-[var(--lunar-primary)] shadow-lg transition">
              {item.icon}
            </div>
            <span className="text-[11px] font-medium text-center text-[var(--lunar-text)] drop-shadow">
              {item.title}
            </span>
          </div>
        ))}
      </div>

      {/* WINDOWS */}
      {Object.values(windows).map((win) => (
        <Window
          key={win.id}
          windowState={win}
          onClose={handleCloseWindow}
          onMinimize={handleMinimizeWindow}
          onMaximize={handleMaximizeWindow}
          onFocus={handleFocusWindow}
          onUpdatePosition={handleUpdatePosition}
        />
      ))}

      {/* DOCK */}
      <Dock items={dockItems} activeWindowId={activeWindowId} onAppClick={handleDockClick} />

      {/* RIGHT CLICK CONTEXT MENU */}
      {contextMenuPos && (
        <div
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          className="fixed z-50 w-48 bg-[var(--lunar-surface)]/90 backdrop-blur-xl border border-[var(--lunar-border)] rounded-xl py-1.5 shadow-2xl text-xs"
        >
          <button
            onClick={() => handleDockClick('browser')}
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--lunar-primary)] hover:text-black transition"
          >
            🌐 Open Browser
          </button>
          <button
            onClick={() => handleDockClick('themestudio')}
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--lunar-primary)] hover:text-black transition"
          >
            🎨 Open Theme Studio
          </button>
          <button
            onClick={() => handleDockClick('settings')}
            className="w-full text-left px-3 py-1.5 hover:bg-[var(--lunar-primary)] hover:text-black transition"
          >
            ⚙️ System Preferences
          </button>
        </div>
      )}
    </div>
  );
};

export default DesktopShell;
