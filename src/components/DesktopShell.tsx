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
        now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
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
      position: { x: 90, y: 45 },
      size: { width: 1020, height: 660 },
      zIndex: 10,
    },
    bookmarks: {
      id: 'bookmarks',
      title: 'Finder — Documents & Favorites',
      icon: '📁',
      component: (
        <div className="p-6 h-full bg-[#FAF7F2] text-[#3D3535] font-sans selection:bg-[#FFD1DC]">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#E8DFC8]">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎀</span>
              <h2 className="text-sm font-semibold tracking-wide text-[#3D3535]">Coquette Documents & Bookmarks</h2>
            </div>
            <span className="text-xs text-[#8C7A7A]">4 items</span>
          </div>
          <div className="grid grid-cols-4 gap-5">
            {[
              { label: 'School Notes', icon: '🎀', count: '12 items' },
              { label: 'Gaming & Setup', icon: '🌸', count: '8 items' },
              { label: 'Research Papers', icon: '🩰', count: '15 items' },
              { label: 'Coding Projects', icon: '☕', count: '24 items' },
            ].map((folder) => (
              <div
                key={folder.label}
                className="group p-4 rounded-xl bg-white border border-[#E8DFC8] hover:border-[#F4C2C2] hover:shadow-sm flex flex-col items-center gap-2 cursor-pointer transition-all duration-200"
              >
                <div className="relative w-14 h-12 bg-[#F7EBE8] rounded-lg border border-[#EADFD5] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="absolute top-1 text-xs">🎀</span>
                  <span className="text-xl mt-2">{folder.icon}</span>
                </div>
                <span className="text-xs font-medium text-[#3D3535] group-hover:text-[#D87093]">{folder.label}</span>
                <span className="text-[10px] text-[#A39292]">{folder.count}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 140, y: 75 },
      size: { width: 720, height: 460 },
      zIndex: 5,
    },
    notes: {
      id: 'notes',
      title: 'TextEdit — Quick Notes',
      icon: '📝',
      component: <NotesView />,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      position: { x: 190, y: 95 },
      size: { width: 520, height: 420 },
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
      position: { x: 150, y: 65 },
      size: { width: 860, height: 560 },
      zIndex: 7,
    },
    themestudio: {
      id: 'themestudio',
      title: 'Theme Studio & Design Tokens',
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
      position: { x: 170, y: 85 },
      size: { width: 920, height: 610 },
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
      className="relative w-screen h-screen overflow-hidden select-none bg-[#FAF7F2] text-[#3D3535] font-sans"
      style={{
        backgroundImage: `radial-gradient(#E8DFC8 0.75px, transparent 0.75px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* COQUETTE MACOS TOP MENU BAR */}
      <div className="flex items-center justify-between h-7 px-4 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EADFD5] text-[12px] font-medium z-40 text-[#4A3E3E]">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#D87093] cursor-pointer hover:opacity-80 flex items-center gap-1.5">
            <span>🎀</span>
            <span>Lunar</span>
          </span>
          <span className="cursor-pointer hover:text-[#D87093]" onClick={() => handleDockClick('browser')}>
            Finder
          </span>
          <span className="cursor-pointer hover:text-[#D87093]" onClick={() => handleDockClick('browser')}>
            File
          </span>
          <span className="cursor-pointer hover:text-[#D87093]" onClick={() => handleDockClick('notes')}>
            Edit
          </span>
          <span className="cursor-pointer hover:text-[#D87093]" onClick={() => handleDockClick('themestudio')}>
            Theme
          </span>
          <span className="cursor-pointer hover:text-[#D87093]" onClick={() => handleDockClick('settings')}>
            Window
          </span>
        </div>

        <div className="flex items-center gap-3.5 text-[11px] text-[#7A6B6B]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#A3E4D7] inline-block"></span>
            <span>Shield Active</span>
          </span>
          <span className="text-[#C19A6B]">✨ Lunar AI</span>
          <span>{timeStr}</span>
        </div>
      </div>

      {/* COQUETTE DESKTOP FOLDERS & ICONS */}
      <div className="p-8 grid grid-cols-1 gap-6 w-36 relative z-10">
        {[
          { id: 'browser', title: 'Lunar Browser', icon: '🌐', tag: 'Web' },
          { id: 'bookmarks', title: 'Favorites', icon: '📁', tag: 'Folder' },
          { id: 'notes', title: 'Quick Notes', icon: '📝', tag: 'TextEdit' },
          { id: 'themestudio', title: 'Theme Studio', icon: '🎨', tag: 'Design' },
          { id: 'settings', title: 'Preferences', icon: '⚙️', tag: 'System' },
        ].map((item) => (
          <div
            key={item.id}
            onDoubleClick={() => handleDockClick(item.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/50 cursor-pointer group transition-all duration-150"
          >
            {/* RIBBON-TIED DESKTOP FOLDER ITEM */}
            <div className="relative w-14 h-14 rounded-2xl bg-white border border-[#EADFD5] shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex items-center justify-center text-2xl group-hover:scale-105 group-hover:border-[#F4C2C2] group-hover:shadow-md transition-all">
              <span className="absolute -top-1.5 -right-1 text-[11px]">🎀</span>
              <span>{item.icon}</span>
            </div>
            <span className="text-[11px] font-medium text-center text-[#3D3535] line-clamp-1 leading-tight">
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

      {/* COQUETTE DOCK */}
      <Dock items={dockItems} activeWindowId={activeWindowId} onAppClick={handleDockClick} />

      {/* CONTEXT MENU */}
      {contextMenuPos && (
        <div
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          className="fixed z-50 w-52 bg-white/95 backdrop-blur-xl border border-[#EADFD5] rounded-xl py-1.5 shadow-xl text-xs text-[#3D3535]"
        >
          <div className="px-3 py-1 font-semibold text-[10px] text-[#A39292] uppercase tracking-wider border-b border-[#F0E6DF] mb-1">
            Coquette Desktop
          </div>
          <button
            onClick={() => handleDockClick('browser')}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FFF0F3] hover:text-[#D87093] flex items-center gap-2 transition"
          >
            <span>🌐</span> Open Lunar Browser
          </button>
          <button
            onClick={() => handleDockClick('bookmarks')}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FFF0F3] hover:text-[#D87093] flex items-center gap-2 transition"
          >
            <span>📁</span> Open Finder
          </button>
          <button
            onClick={() => handleDockClick('themestudio')}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FFF0F3] hover:text-[#D87093] flex items-center gap-2 transition"
          >
            <span>🎨</span> Theme Studio
          </button>
          <button
            onClick={() => handleDockClick('settings')}
            className="w-full text-left px-3 py-1.5 hover:bg-[#FFF0F3] hover:text-[#D87093] flex items-center gap-2 transition"
          >
            <span>⚙️</span> System Preferences
          </button>
        </div>
      )}
    </div>
  );
};

export default DesktopShell;
