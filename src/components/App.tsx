import React, { useState, useEffect, useRef } from 'react';
import { TabInfo, ShieldStats, Bookmark, HistoryItem, DownloadItemInfo } from '../../electron/types';
import SettingsView from './SettingsView';
import ExtensionsView from './ExtensionsView';
import AISidebar from './AISidebar';
import CommandPalette from './CommandPalette';
import OnboardingModal from './OnboardingModal';
import ReaderModeView from './ReaderModeView';

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

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);

  const omniboxInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (!window.lunarAPI) return;

    window.lunarAPI.getSettings().then((settings: any) => {
      if (settings && settings.isFirstRun !== false) {
        setShowOnboarding(true);
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
    <div className="flex flex-col h-screen w-screen bg-[#050508] text-slate-100 font-sans overflow-hidden border border-white/10 rounded-lg select-none">
      {/* WINDOW TITLE BAR & TABS */}
      <div className="flex items-center bg-[#0d0f17] h-11 px-2 border-b border-white/10 drag select-none">
        {/* LOGO */}
        <div className="flex items-center gap-2 px-2 no-drag mr-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 via-violet-500 to-lime-400 p-[1px]">
            <div className="w-full h-full bg-[#050508] rounded-full flex items-center justify-center text-[10px] font-bold text-cyan-400">
              ☾
            </div>
          </div>
          <span className="text-xs font-semibold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">
            LUNAR
          </span>
        </div>

        {/* TABS CONTAINER */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-drag scrollbar-none">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className={`group relative flex items-center gap-2 h-8 px-3 max-w-[200px] min-w-[120px] rounded-md text-xs transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#131622] text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]'
                    : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
                ) : (
                  <span className="text-slate-500 text-[10px]">🌐</span>
                )}
                <span className="truncate flex-1 font-medium">
                  {tab.url === 'lunar://newtab' ? 'New Tab' : tab.title || 'Loading...'}
                </span>

                {tab.audible && <span className="text-[10px] text-cyan-400 animate-pulse">🔊</span>}

                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/20 p-0.5 rounded text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button
            onClick={handleNewTab}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-400 transition no-drag"
            title="New Tab (Ctrl+T)"
          >
            +
          </button>
        </div>

        {/* WINDOW CONTROLS */}
        <div className="flex items-center gap-1 no-drag ml-2">
          <button
            onClick={() => window.lunarAPI?.minimize()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white text-xs"
          >
            ⎯
          </button>
          <button
            onClick={() => window.lunarAPI?.maximize()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white text-xs"
          >
            ▢
          </button>
          <button
            onClick={() => window.lunarAPI?.close()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500 hover:text-white text-slate-400 text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* NAVIGATION BAR & OMNIBOX */}
      <div className="flex items-center gap-2 h-11 px-3 bg-[#08090f] border-b border-white/10 select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.lunarAPI?.goBack(activeTabId)}
            disabled={!activeTab?.canGoBack}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Back"
          >
            ←
          </button>
          <button
            onClick={() => window.lunarAPI?.goForward(activeTabId)}
            disabled={!activeTab?.canGoForward}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Forward"
          >
            →
          </button>
          <button
            onClick={() => window.lunarAPI?.reloadTab(activeTabId)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-300"
            title="Reload"
          >
            ↻
          </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 relative flex items-center">
          <div className="absolute left-3 flex items-center gap-1.5 text-xs text-slate-400">
            {activeTab?.url.startsWith('https://') ? (
              <span className="text-cyan-400 text-[11px]" title="Secure Connection">
                🔒
              </span>
            ) : (
              <span className="text-slate-500 text-[11px]">🌐</span>
            )}
          </div>
          <input
            ref={omniboxInputRef}
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onFocus={() => setIsOmniboxFocused(true)}
            onBlur={() => setIsOmniboxFocused(false)}
            placeholder="Search the web or type a URL (e.g. youtube.com or @tabs github)..."
            className="w-full h-8 pl-8 pr-20 bg-[#131622] text-xs text-slate-200 placeholder-slate-500 rounded-md border border-white/10 focus:border-cyan-500/50 focus:shadow-[0_0_12px_rgba(0,240,255,0.2)] focus:outline-none transition"
          />
          <div className="absolute right-2 flex items-center gap-1 text-[10px] text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-cyan-400">
              Ctrl+K
            </span>
          </div>
        </form>

        {activePage === 'browser' && (
          <button
            onClick={handleOpenReaderMode}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-400 hover:bg-white/10 text-xs transition"
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
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span>🛡️</span>
            <span className="font-mono text-[11px]">{shieldStats.totalBlocked}</span>
          </button>

          {showShieldPopup && (
            <div className="absolute right-0 top-10 w-72 bg-[#0d0f17] border border-cyan-500/30 rounded-lg p-4 shadow-2xl z-50 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <h3 className="text-xs font-bold text-cyan-400 tracking-wider">LUNAR SHIELD</h3>
                    <p className="text-[10px] text-slate-400">Active Protection</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  PROTECTED
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-slate-400">Ads Blocked</span>
                  <span className="font-mono text-cyan-400 font-bold">{shieldStats.adsBlocked}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-slate-400">Trackers Blocked</span>
                  <span className="font-mono text-violet-400 font-bold">{shieldStats.trackersBlocked}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-slate-400">Cryptominers</span>
                  <span className="font-mono text-lime-400 font-bold">{shieldStats.cryptominersBlocked}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Total Intercepted</span>
                  <span className="font-mono text-slate-100 font-bold">{shieldStats.totalBlocked}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAISidebar(!showAISidebar)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition ${
            showAISidebar
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-[0_0_12px_rgba(138,43,226,0.3)]'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
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
        ) : activePage === 'newtab' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050508] relative overflow-y-auto">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="z-10 max-w-2xl w-full flex flex-col items-center text-center space-y-6">
              <div>
                <h1 className="text-6xl font-extralight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </h1>
                <p className="text-xs font-mono tracking-widest text-cyan-400/80 uppercase mt-2">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <h2 className="text-xl font-medium tracking-wide text-slate-300">
                What are you exploring today?
              </h2>

              <form onSubmit={handleNavigate} className="w-full relative">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Search the web or enter URL..."
                  className="w-full h-12 pl-12 pr-4 bg-[#0d0f17]/80 text-sm text-slate-100 placeholder-slate-500 rounded-xl border border-white/10 focus:border-cyan-500/60 focus:shadow-[0_0_20px_rgba(0,240,255,0.25)] focus:outline-none backdrop-blur-md transition"
                />
                <span className="absolute left-4 top-3.5 text-base text-slate-400">🔍</span>
              </form>

              <div className="w-full grid grid-cols-3 gap-4 p-4 rounded-xl bg-[#0d0f17]/60 border border-white/5 backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-cyan-400">{shieldStats.totalBlocked}</span>
                  <span className="text-[11px] text-slate-400">Trackers & Ads Blocked</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-violet-400">100%</span>
                  <span className="text-[11px] text-slate-400">Local Privacy</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold font-mono text-lime-400">Active</span>
                  <span className="text-[11px] text-slate-400">Lunar Shield</span>
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
                    className="flex flex-col items-center gap-2 p-3 w-20 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition">{site.icon}</span>
                    <span className="text-xs text-slate-300">{site.name}</span>
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
          <div className="flex-1 bg-[#050508] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
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
                <p className="text-xs text-slate-500">No browsing history yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => window.lunarAPI?.navigateTab(activeTabId, h.url)}
                      className="p-3 rounded-lg bg-[#0d0f17] border border-white/5 hover:border-cyan-500/30 flex items-center justify-between cursor-pointer transition"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{h.title || h.url}</h4>
                        <p className="text-[11px] text-cyan-400">{h.url}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(h.visitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activePage === 'bookmarks' ? (
          <div className="flex-1 bg-[#050508] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-4">
                <span>🔖</span> Bookmarks Manager
              </h1>
              <div className="grid grid-cols-2 gap-3">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => window.lunarAPI?.navigateTab(activeTabId, bm.url)}
                    className="p-4 rounded-xl bg-[#0d0f17] border border-white/10 hover:border-cyan-500/30 flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{bm.title}</h4>
                      <p className="text-[11px] text-slate-400">{bm.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activePage === 'downloads' ? (
          <div className="flex-1 bg-[#050508] p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-xl font-bold flex items-center gap-2 border-b border-white/10 pb-4">
                <span>📥</span> Download Manager
              </h1>
              {downloads.length === 0 ? (
                <p className="text-xs text-slate-500">No recent downloads.</p>
              ) : (
                <div className="space-y-3">
                  {downloads.map((dl) => (
                    <div key={dl.id} className="p-4 rounded-xl bg-[#0d0f17] border border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                        <span>{dl.filename}</span>
                        <span className="text-cyan-400 uppercase font-mono text-[10px]">{dl.status}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all"
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
