import React, { useState, useEffect, useRef } from 'react';
import { TabInfo, ShieldStats, Bookmark, HistoryItem, DownloadItemInfo } from '../../electron/types';
import SettingsView from './SettingsView';
import ExtensionsView from './ExtensionsView';
import AISidebar from './AISidebar';
import CommandPalette from './CommandPalette';
import OnboardingModal from './OnboardingModal';
import ReaderModeView from './ReaderModeView';
import ThemeStudioView from './ThemeStudioView';
import { BUILTIN_THEMES, applyThemeTokens, ThemeTokens } from '../styles/themes';

declare global {
  interface Window {
    lunarAPI?: any;
  }
}

export const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [isOmniboxFocused, setIsOmniboxFocused] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<string>('newtab');
  const [shieldStats, setShieldStats] = useState<ShieldStats>({
    totalBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    analyticsBlocked: 0,
    telemetryBlocked: 0,
    cryptominersBlocked: 0,
    socialBlocked: 0,
    popupsBlocked: 0,
    annoyancesBlocked: 0,
  });
  const [showShieldPopup, setShowShieldPopup] = useState<boolean>(false);
  const [showAISidebar, setShowAISidebar] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isReaderMode, setIsReaderMode] = useState<boolean>(false);
  const [readerContent, setReaderContent] = useState<string>('');

  const [currentTheme, setCurrentTheme] = useState<ThemeTokens>(BUILTIN_THEMES['lunar-coquette']);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);

  const omniboxInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    applyThemeTokens(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (!window.lunarAPI) return;

    window.lunarAPI.getSettings().then((settings: any) => {
      if (settings && settings.isFirstRun !== false) {
        setShowOnboarding(true);
      }
      if (settings && settings.themeId && BUILTIN_THEMES[settings.themeId]) {
        setCurrentTheme(BUILTIN_THEMES[settings.themeId]);
      }
    });

    const unsubscribeTabs = window.lunarAPI.onTabsUpdated((updatedTabs: TabInfo[], activeId: string) => {
      setTabs(updatedTabs);
      setActiveTabId(activeId);
      const current = updatedTabs.find((t) => t.id === activeId);
      if (current) {
        if (!isOmniboxFocused) {
          setUrlInput(current.url === 'lunar://newtab' ? '' : current.url);
        }
        if (current.url.startsWith('lunar://')) {
          setActivePage(current.url.replace('lunar://', ''));
        } else {
          setActivePage('browser');
        }
      }
    });

    const unsubscribeShield = window.lunarAPI.onShieldStatsUpdated((stats: ShieldStats) => {
      setShieldStats(stats);
    });

    const unsubscribeDownloads = window.lunarAPI.onDownloadsUpdated((dls: DownloadItemInfo[]) => {
      setDownloads(dls);
    });

    return () => {
      unsubscribeTabs?.();
      unsubscribeShield?.();
      unsubscribeDownloads?.();
    };
  }, [isOmniboxFocused]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrl) {
        if (key === 't') {
          e.preventDefault();
          handleNewTab();
        } else if (key === 'w') {
          e.preventDefault();
          handleCloseTab();
        } else if (key === 'l') {
          e.preventDefault();
          omniboxInputRef.current?.focus();
          omniboxInputRef.current?.select();
        } else if (key === 'r') {
          e.preventDefault();
          if (activeTabId) window.lunarAPI?.reloadTab(activeTabId);
        } else if (key === 'k' || e.code === 'Space') {
          e.preventDefault();
          setShowCommandPalette((prev) => !prev);
        } else if (key === 'tab') {
          e.preventDefault();
          if (tabs.length > 1) {
            const currIdx = tabs.findIndex((t) => t.id === activeTabId);
            const nextIdx = e.shiftKey
              ? (currIdx - 1 + tabs.length) % tabs.length
              : (currIdx + 1) % tabs.length;
            window.lunarAPI?.switchTab(tabs[nextIdx].id);
          }
        } else if (/^[1-9]$/.test(key)) {
          e.preventDefault();
          const targetIndex = parseInt(key, 10) - 1;
          if (tabs[targetIndex]) {
            window.lunarAPI?.switchTab(tabs[targetIndex].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (!window.lunarAPI) return;
    if (activePage === 'history') {
      window.lunarAPI.getHistory().then(setHistory);
    } else if (activePage === 'bookmarks') {
      window.lunarAPI.getBookmarks().then(setBookmarks);
    } else if (activePage === 'downloads') {
      window.lunarAPI.getDownloads().then(setDownloads);
    }
  }, [activePage]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId || !urlInput.trim()) return;
    window.lunarAPI?.navigateTab(activeTabId, urlInput);
    setIsOmniboxFocused(false);
  };

  const handleNewTab = () => {
    window.lunarAPI?.createTab('lunar://newtab');
  };

  const handleCloseTab = (tabId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetId = tabId || activeTabId;
    if (targetId) {
      window.lunarAPI?.closeTab(targetId);
    }
  };

  const handleSwitchTab = (tabId: string) => {
    window.lunarAPI?.switchTab(tabId);
  };

  const handleOpenReaderMode = async () => {
    if (!activeTabId) return;
    try {
      const pageText = await window.lunarAPI?.getPageText(activeTabId);
      setReaderContent(pageText || 'Could not extract article content.');
      setIsReaderMode(true);
    } catch (_) {
      setReaderContent('Error extracting page text.');
      setIsReaderMode(true);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--lunar-bg)] text-[var(--lunar-text)] font-sans overflow-hidden select-none">
      {/* BROWSER TABS BAR */}
      <div className="flex items-center bg-[var(--lunar-bg-secondary)] h-9 px-2 border-b border-[var(--lunar-border)] select-none">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className={`group relative flex items-center gap-2 h-7 px-3 max-w-[200px] min-w-[120px] rounded-md text-xs transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--lunar-surface)] text-[var(--lunar-primary)] border-[var(--lunar-border)] shadow-[0_0_10px_var(--lunar-glow)]'
                    : 'bg-white/5 text-[var(--lunar-text-muted)] border-transparent hover:bg-white/10 hover:text-[var(--lunar-text)]'
                }`}
              >
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
                ) : (
                  <span className="text-[10px]">🌐</span>
                )}
                <span className="truncate flex-1 font-medium">
                  {tab.url === 'lunar://newtab' ? 'New Tab' : tab.title || 'Loading...'}
                </span>

                {tab.audible && <span className="text-[10px] text-[var(--lunar-primary)] animate-pulse">🔊</span>}

                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/20 p-0.5 rounded transition"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button
            onClick={handleNewTab}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 hover:bg-[var(--lunar-surface-hover)] hover:text-[var(--lunar-primary)] transition"
            title="New Tab (Ctrl+T)"
          >
            +
          </button>
        </div>
      </div>

      {/* NAVIGATION BAR & OMNIBOX */}
      <div className="flex items-center gap-2 h-10 px-3 bg-[var(--lunar-bg)] border-b border-[var(--lunar-border)] select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.lunarAPI?.goBack(activeTabId)}
            disabled={!activeTab?.canGoBack}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30"
            title="Back"
          >
            ←
          </button>
          <button
            onClick={() => window.lunarAPI?.goForward(activeTabId)}
            disabled={!activeTab?.canGoForward}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30"
            title="Forward"
          >
            →
          </button>
          <button
            onClick={() => window.lunarAPI?.reloadTab(activeTabId)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
            title="Reload"
          >
            ↻
          </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 relative flex items-center">
          <div className="absolute left-3 flex items-center gap-1.5 text-xs">
            {activeTab?.url.startsWith('https://') ? (
              <span className="text-[var(--lunar-primary)] text-[11px]" title="Secure Connection">
                🔒
              </span>
            ) : (
              <span className="text-[11px]">🌐</span>
            )}
          </div>
          <input
            ref={omniboxInputRef}
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onFocus={() => setIsOmniboxFocused(true)}
            onBlur={() => setIsOmniboxFocused(false)}
            placeholder="Search the web or type a URL..."
            className="w-full h-8 pl-8 pr-20 bg-[var(--lunar-surface)] text-xs text-[var(--lunar-text)] placeholder-[var(--lunar-text-muted)] rounded-md border border-[var(--lunar-border)] focus:border-[var(--lunar-primary)] focus:shadow-[0_0_12px_var(--lunar-glow)] focus:outline-none transition"
          />
          <div className="absolute right-2 flex items-center gap-1 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--lunar-border)] font-mono text-[var(--lunar-primary)]">
              Ctrl+K
            </span>
          </div>
        </form>

        <button
          onClick={() => window.lunarAPI?.navigateTab(activeTabId, 'lunar://themestudio')}
          className="px-2 py-1 rounded-md bg-[var(--lunar-surface)] border border-[var(--lunar-border)] text-xs hover:border-[var(--lunar-primary)] transition"
          title="Theme Studio"
        >
          🎨
        </button>

        {activePage === 'browser' && (
          <button
            onClick={handleOpenReaderMode}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--lunar-surface)] border border-[var(--lunar-border)] text-xs hover:text-[var(--lunar-primary)] transition"
            title="Reader Mode"
          >
            📖
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowShieldPopup(!showShieldPopup)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition ${
              shieldStats.totalBlocked > 0
                ? 'bg-[var(--lunar-surface)] border-[var(--lunar-primary)] text-[var(--lunar-primary)]'
                : 'bg-[var(--lunar-surface)] border-[var(--lunar-border)] text-[var(--lunar-text-muted)]'
            }`}
          >
            <span>🛡️</span>
            <span className="font-mono text-[11px]">{shieldStats.totalBlocked}</span>
          </button>

          {showShieldPopup && (
            <div className="absolute right-0 top-10 w-72 bg-[var(--lunar-bg-secondary)] border border-[var(--lunar-border)] rounded-lg p-4 shadow-2xl z-50 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-[var(--lunar-border)] pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--lunar-primary)] tracking-wider">LUNAR SHIELD</h3>
                    <p className="text-[10px] text-[var(--lunar-text-muted)]">Active Protection</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--lunar-primary)] text-black">
                  PROTECTED
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[var(--lunar-border)]">
                  <span className="text-[var(--lunar-text-muted)]">Ads Blocked</span>
                  <span className="font-mono text-[var(--lunar-primary)] font-bold">{shieldStats.adsBlocked}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--lunar-border)]">
                  <span className="text-[var(--lunar-text-muted)]">Trackers Blocked</span>
                  <span className="font-mono text-[var(--lunar-secondary)] font-bold">{shieldStats.trackersBlocked}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--lunar-text-muted)]">Total Intercepted</span>
                  <span className="font-mono font-bold">{shieldStats.totalBlocked}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAISidebar(!showAISidebar)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition ${
            showAISidebar
              ? 'bg-[var(--lunar-surface)] border-[var(--lunar-secondary)] text-[var(--lunar-secondary)]'
              : 'bg-[var(--lunar-surface)] border-[var(--lunar-border)]'
          }`}
        >
          <span>✨</span>
          <span>Lunar AI</span>
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 relative flex overflow-hidden">
        {isReaderMode ? (
          <ReaderModeView
            title={activeTab?.title || 'Article View'}
            url={activeTab?.url || ''}
            content={readerContent}
            onClose={() => setIsReaderMode(false)}
          />
        ) : activePage === 'themestudio' ? (
          <ThemeStudioView
            currentTheme={currentTheme}
            onThemeChange={(newTheme) => {
              setCurrentTheme(newTheme);
              window.lunarAPI?.updateSettings({ themeId: newTheme.id });
            }}
          />
        ) : activePage === 'newtab' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--lunar-bg)] relative overflow-y-auto">
            <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center space-y-6">
              <div>
                <h1 className="text-6xl font-extralight tracking-tight text-[var(--lunar-text)]">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </h1>
                <p className="text-xs font-mono tracking-widest text-[var(--lunar-primary)] uppercase mt-2">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <h2 className="text-xl font-medium tracking-wide text-[var(--lunar-text-muted)]">
                Browse beyond.
              </h2>

              <form onSubmit={handleNavigate} className="w-full relative">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Search the web or enter URL..."
                  className="w-full h-12 pl-12 pr-4 bg-[var(--lunar-surface)] text-sm text-[var(--lunar-text)] placeholder-[var(--lunar-text-muted)] rounded-xl border border-[var(--lunar-border)] focus:border-[var(--lunar-primary)] focus:shadow-[0_0_20px_var(--lunar-glow)] focus:outline-none backdrop-blur-md transition"
                />
                <span className="absolute left-4 top-3.5 text-base">🔍</span>
              </form>

              <div className="w-full grid grid-cols-3 gap-4 p-4 rounded-xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-[var(--lunar-primary)]">{shieldStats.totalBlocked}</span>
                  <span className="text-[11px] text-[var(--lunar-text-muted)]">Trackers & Ads Blocked</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-[var(--lunar-secondary)]">100%</span>
                  <span className="text-[11px] text-[var(--lunar-text-muted)]">Local Privacy</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-[var(--lunar-accent)]">Active</span>
                  <span className="text-[11px] text-[var(--lunar-text-muted)]">Lunar Shield</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                {[
                  { name: 'GitHub', url: 'https://github.com', icon: '💻' },
                  { name: 'YouTube', url: 'https://youtube.com', icon: '📺' },
                  { name: 'Wikipedia', url: 'https://wikipedia.org', icon: '📚' },
                  { name: 'Reddit', url: 'https://reddit.com', icon: '💬' },
                ].map((site) => (
                  <button
                    key={site.name}
                    onClick={() => window.lunarAPI?.navigateTab(activeTabId, site.url)}
                    className="flex flex-col items-center gap-2 p-3 w-20 rounded-xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] hover:border-[var(--lunar-primary)] transition group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition">{site.icon}</span>
                    <span className="text-xs text-[var(--lunar-text-muted)]">{site.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : activePage === 'settings' ? (
          <SettingsView />
        ) : activePage === 'extensions' ? (
          <ExtensionsView />
        ) : activePage === 'history' ? (
          <div className="flex-1 bg-[var(--lunar-bg)] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--lunar-border)] pb-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <span>📜</span> Browsing History
                </h1>
                <button
                  onClick={() => {
                    window.lunarAPI?.clearHistory();
                    setHistory([]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition"
                >
                  Clear All History
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-[var(--lunar-text-muted)]">No browsing history yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => window.lunarAPI?.navigateTab(activeTabId, h.url)}
                      className="p-3 rounded-lg bg-[var(--lunar-surface)] border border-[var(--lunar-border)] hover:border-[var(--lunar-primary)] flex items-center justify-between cursor-pointer transition"
                    >
                      <div>
                        <h4 className="text-xs font-bold">{h.title || h.url}</h4>
                        <p className="text-[11px] text-[var(--lunar-primary)]">{h.url}</p>
                      </div>
                      <span className="text-[10px] text-[var(--lunar-text-muted)] font-mono">
                        {new Date(h.visitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activePage === 'bookmarks' ? (
          <div className="flex-1 bg-[var(--lunar-bg)] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-xl font-bold flex items-center gap-2 border-b border-[var(--lunar-border)] pb-4">
                <span>🔖</span> Bookmarks Manager
              </h1>
              <div className="grid grid-cols-2 gap-3">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => window.lunarAPI?.navigateTab(activeTabId, bm.url)}
                    className="p-4 rounded-xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] hover:border-[var(--lunar-primary)] flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <h4 className="text-xs font-bold">{bm.title}</h4>
                      <p className="text-[11px] text-[var(--lunar-text-muted)]">{bm.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activePage === 'downloads' ? (
          <div className="flex-1 bg-[var(--lunar-bg)] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-xl font-bold flex items-center gap-2 border-b border-[var(--lunar-border)] pb-4">
                <span>📥</span> Download Manager
              </h1>
              {downloads.length === 0 ? (
                <p className="text-xs text-[var(--lunar-text-muted)]">No recent downloads.</p>
              ) : (
                <div className="space-y-3">
                  {downloads.map((dl) => (
                    <div key={dl.id} className="p-4 rounded-xl bg-[var(--lunar-surface)] border border-[var(--lunar-border)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{dl.filename}</span>
                        <span className="text-[var(--lunar-primary)] uppercase font-mono text-[10px]">{dl.status}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-[var(--lunar-primary)] transition-all"
                          style={{
                            width: `${dl.totalBytes > 0 ? (dl.receivedBytes / dl.totalBytes) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showAISidebar && (
          <AISidebar onClose={() => setShowAISidebar(false)} activeTabId={activeTabId} />
        )}
      </div>

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigatePage={(page) => window.lunarAPI?.navigateTab(activeTabId, page)}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          window.lunarAPI?.updateSettings({ isFirstRun: false });
        }}
      />
    </div>
  );
};

export default App;
