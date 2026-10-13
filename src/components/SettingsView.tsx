import React, { useState, useEffect } from 'react';
import { BrowserSettings } from '../../electron/types';

export const SettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('general');
  const [settings, setSettings] = useState<BrowserSettings>({
    searchEngine: 'google',
    theme: 'Lunar Dark',
    accentColor: '#00f0ff',
    glowIntensity: 70,
    animationIntensity: 100,
    density: 'comfortable',
    aiProvider: 'openrouter',
    activeWorkspaceId: 'personal',
    showBookmarksBar: true,
    verticalTabs: false,
    shield: {
      enabled: true,
      ads: true,
      trackers: true,
      popups: true,
      telemetry: true,
      social: true,
      cryptomining: true,
      annoyances: true,
      autoplay: false,
      fingerprintProtection: true,
      allowlist: [],
    },
    readerModeOptions: {
      font: 'sans-serif',
      fontSize: 16,
      theme: 'dark',
    },
  });

  useEffect(() => {
    if (window.lunarAPI) {
      window.lunarAPI.getSettings().then((s: BrowserSettings) => {
        if (s) setSettings(s);
      });
    }
  }, []);

  const handleUpdate = (partial: Partial<BrowserSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    if (window.lunarAPI) {
      window.lunarAPI.updateSettings(partial);
    }
  };

  const sections = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'shield', label: 'Lunar Shield', icon: '⚡' },
    { id: 'ai', label: 'Lunar AI', icon: '✨' },
    { id: 'extensions', label: 'Extensions', icon: '🧩' },
    { id: 'downloads', label: 'Downloads', icon: '📥' },
    { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
    { id: 'workspaces', label: 'Workspaces', icon: '📁' },
    { id: 'advanced', label: 'Advanced', icon: '🛠️' },
    { id: 'about', label: 'About', icon: '☾' },
  ];


  const renderSectionIcon = (id: string) => {
    switch (id) {
      case "general": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
      case "appearance": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
      case "search": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
      case "privacy": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
      case "security": case "shield": return <svg className="w-4 h-4 opacity-80 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
      case "ai": return <svg className="w-4 h-4 opacity-80 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>;
      case "extensions": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
      case "downloads": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
      case "workspaces": return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
      default: return <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>;
    }
  };

  return (
    <div className="flex-1 flex bg-[#050508] text-slate-100 h-full overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-56 bg-[#0d0f17] border-r border-white/10 p-3 space-y-1 overflow-y-auto">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 py-2">
          Settings
        </h2>
        {sections.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
              activeSection === sec.id
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <span>{renderSectionIcon(sec.id)}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT PANEL */}
      <div className="flex-1 p-8 overflow-y-auto max-w-3xl">
        {activeSection === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">General Settings</h3>
              <p className="text-xs text-slate-400 mt-1">Configure default startup behavior and density.</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-slate-200">Show Bookmarks Bar</h4>
                  <p className="text-[11px] text-slate-400">Display quick bookmark links under the address bar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showBookmarksBar}
                  onChange={(e) => handleUpdate({ showBookmarksBar: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-0"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-slate-200">Vertical Tabs</h4>
                  <p className="text-[11px] text-slate-400">Display tabs on the left side panel instead of top bar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.verticalTabs}
                  onChange={(e) => handleUpdate({ verticalTabs: e.target.checked })}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-0"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Appearance & Themes</h3>
              <p className="text-xs text-slate-400 mt-1">Customize Lunar Browser's visual identity and themes.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
              {['Lunar Dark', 'Midnight', 'Moonlight', 'Void', 'Nebula', 'Terminal'].map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => handleUpdate({ theme: themeName as any })}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition ${
                    settings.theme === themeName
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs font-bold">{themeName}</span>
                  <span className="text-[10px] text-slate-400">
                    {settings.theme === themeName ? 'ACTIVE' : 'Select'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'search' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Search Engine</h3>
              <p className="text-xs text-slate-400 mt-1">Choose your preferred default web search provider.</p>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              {['google', 'bing', 'duckduckgo'].map((se) => (
                <label key={se} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10">
                  <input
                    type="radio"
                    name="searchEngine"
                    value={se}
                    checked={settings.searchEngine === se}
                    onChange={() => handleUpdate({ searchEngine: se })}
                    className="text-cyan-500"
                  />
                  <span className="text-xs font-medium capitalize">{se}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-violet-500 to-lime-400 p-[2px]">
                <div className="w-full h-full bg-[#050508] rounded-2xl flex items-center justify-center text-3xl font-bold text-cyan-400">
                  ☾
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                  LUNAR BROWSER
                </h3>
                <p className="text-xs text-slate-400">Version 1.0.0 (Chromium Core Engine)</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-4 border-t border-white/10">
              Lunar Browser is a production-quality, private, secure, and AI-powered Chromium desktop browser built with Electron, React, TypeScript, and Tailwind CSS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
