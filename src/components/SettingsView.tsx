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
            <span>{sec.icon}</span>
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
