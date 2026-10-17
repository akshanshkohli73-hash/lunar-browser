import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBrowser } from "../state/BrowserContext";
import { isInternalUrl, isWebUrl } from "../../shared/navigation";
import { useNativeViewport } from "./useNativeViewport";
import { Icon } from "./ui/Icon";
import { BookmarkEditor } from "./BookmarkEditor";
import { Modal } from "./ui/Modal";
import SettingsView from "./SettingsView";
import ExtensionsView from "./ExtensionsView";
import ThemeStudioView from "./ThemeStudioView";
import LibraryView from "./LibraryView";
import AISidebar from "./AISidebar";
import ShieldPanel from "./ShieldPanel";
import CommandPalette from "./CommandPalette";
import OnboardingModal from "./OnboardingModal";
import ReaderModeView from "./ReaderModeView";

export default function App({
  isVisible = true,
  isOccluded = false,
}: {
  isVisible?: boolean;
  isOccluded?: boolean;
}) {
  const {
    api,
    ready,
    tabs: state,
    settings,
    bookmarks,
    shield,
    errors,
    report,
    dismissError,
    updateSettings,
  } = useBrowser();
  const tabs = state.tabs,
    activeId = state.activeTabId,
    active = tabs.find((tab) => tab.id === activeId);
  const [url, setUrl] = useState(""),
    [aiOpen, setAiOpen] = useState(false),
    [commands, setCommands] = useState(false),
    [shieldOpen, setShieldOpen] = useState(false),
    [tabMenu, setTabMenu] = useState<string | null>(null);
  const [editingBookmark, setEditingBookmark] = useState(false),
    [reader, setReader] = useState<string | null>(null),
    [readerLoading, setReaderLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const address = useRef<HTMLInputElement>(null),
    pageRef = useRef<HTMLDivElement>(null),
    focused = useRef(false),
    dragId = useRef<string | null>(null);
  const internalPage =
    active && isInternalUrl(active.url) ? active.url.slice(8) : "browser";
  const loadedRuleCount =
    shield?.lists
      .filter((list) =>
        settings.shield.filterLists.includes(
          list.id as "lunar-core" | "stevenblack",
        ),
      )
      .reduce((sum, list) => sum + list.ruleCount, 0) ?? 0;
  const onboarding = !!api && ready && settings.isFirstRun;
  const showNative =
    isVisible &&
    !isOccluded &&
    !commands &&
    !shieldOpen &&
    !tabMenu &&
    !editingBookmark &&
    !onboarding &&
    reader === null &&
    !readerLoading &&
    !active?.error &&
    internalPage === "browser";
  useNativeViewport(pageRef, activeId, showNative, api, report);
  useEffect(() => {
    if (!focused.current)
      setUrl(active?.url === "lunar://newtab" ? "" : (active?.url ?? ""));
  }, [activeId, active?.url]);
  useEffect(() => {
    setReader(null);
    setShieldOpen(false);
    setTabMenu(null);
    setEditingBookmark(false);
  }, [activeId, active?.url]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () =>
      api?.onShortcut((shortcut) => {
        if (shortcut === "spotlight") {
          setCommands(false);
          setShieldOpen(false);
          setTabMenu(null);
          setEditingBookmark(false);
          window.dispatchEvent(new Event("lunar:spotlight"));
          return;
        }
        window.dispatchEvent(new Event("lunar:activate-browser"));
        if (shortcut === "address") {
          address.current?.focus();
          address.current?.select();
        }
        if (shortcut === "commands") setCommands((current) => !current);
        if (shortcut === "bookmark") setEditingBookmark(true);
        if (shortcut === "ai") setAiOpen((current) => !current);
      }),
    [api],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShieldOpen(false);
        setTabMenu(null);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const navigate = (input: string) => {
    if (!api || !activeId) return;
    void api
      .navigateTab(activeId, input)
      .then(() => {
        focused.current = false;
        address.current?.blur();
      })
      .catch(report);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(url);
  };
  const currentBookmark = bookmarks.find((item) => item.url === active?.url);
  const readerTab = useRef(activeId);
  readerTab.current = activeId;
  const openReader = async () => {
    if (!api || !activeId) return;
    setReaderLoading(true);
    try {
      const text = await api.getPageText(activeId);
      if (readerTab.current === activeId) setReader(text);
    } catch (error) {
      report(error);
    } finally {
      setReaderLoading(false);
    }
  };
  return (
    <main className="browser-app" aria-label="Lunar browser workspace">
      <div className="browser-tabstrip">
        <div className="browser-tabs" role="tablist" aria-label="Browser tabs">
          {tabs.map((tab) => (
            <div
              className={`browser-tab ${tab.id === activeId ? "is-active" : ""}`}
              key={tab.id}
              draggable
              onDragEnd={() => {
                dragId.current = null;
              }}
              onDragStart={() => {
                dragId.current = tab.id;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragId.current;
                dragId.current = null;
                if (!api || !from || from === tab.id) return;
                const ids = tabs
                  .map((item) => item.id)
                  .filter((id) => id !== from);
                ids.splice(ids.indexOf(tab.id), 0, from);
                void api.reorderTabs(ids).catch(report);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setTabMenu(tab.id);
              }}
            >
              <button
                role="tab"
                aria-selected={tab.id === activeId}
                aria-controls="page-viewport"
                title={tab.url}
                onClick={() => void api?.switchTab(tab.id).catch(report)}
              >
                {tab.isLoading ? (
                  <span className="loading-spinner" />
                ) : tab.isPinned ? (
                  <Icon name="pin" size={13} />
                ) : (
                  <Icon name="globe" size={13} />
                )}
                <span>{tab.title}</span>
                {tab.isMuted || tab.audible ? (
                  <Icon name="volume" size={12} />
                ) : null}
              </button>
              <button
                className="tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={() => void api?.closeTab(tab.id).catch(report)}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="New tab"
          title="New tab (Ctrl+T)"
          disabled={!api || !ready}
          onClick={() => void api?.createTab().catch(report)}
        >
          <Icon name="plus" />
        </button>
      </div>
      <nav className="browser-toolbar" aria-label="Browser navigation">
        <button
          className="icon-button"
          aria-label="Back"
          disabled={!active?.canGoBack}
          onClick={() => activeId && void api?.goBack(activeId).catch(report)}
        >
          <Icon name="back" />
        </button>
        <button
          className="icon-button"
          aria-label="Forward"
          disabled={!active?.canGoForward}
          onClick={() =>
            activeId && void api?.goForward(activeId).catch(report)
          }
        >
          <Icon name="forward" />
        </button>
        <button
          className="icon-button"
          aria-label={active?.isLoading ? "Stop loading" : "Reload"}
          disabled={!activeId}
          onClick={() =>
            activeId &&
            void (
              active?.isLoading
                ? api?.stopTab(activeId)
                : api?.reloadTab(activeId)
            )?.catch(report)
          }
        >
          <Icon name={active?.isLoading ? "stop" : "reload"} />
        </button>
        <form className="address-bar" onSubmit={submit}>
          <Icon
            name={active?.url.startsWith("https:") ? "lock" : "globe"}
            size={14}
          />
          <input
            ref={address}
            aria-label="Address and search"
            value={url}
            placeholder="Search or enter an address"
            spellCheck={false}
            autoComplete="off"
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              focused.current = false;
            }}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setUrl(
                  active?.url === "lunar://newtab" ? "" : (active?.url ?? ""),
                );
                address.current?.blur();
              }
            }}
            disabled={!api || !ready}
          />
          <button
            type="button"
            aria-label={
              currentBookmark ? "Edit saved bookmark" : "Bookmark this page"
            }
            disabled={!active}
            className={currentBookmark ? "is-saved" : ""}
            onClick={() => setEditingBookmark(true)}
          >
            <Icon name="star" size={16} />
          </button>
        </form>
        <button
          className="icon-button"
          aria-label="Lunar Shield"
          aria-expanded={shieldOpen}
          onClick={() => setShieldOpen((current) => !current)}
          disabled={!api}
        >
          <Icon name="shield" />
          <span className="shield-counter">
            {!settings.shield.enabled
              ? "Off"
              : !loadedRuleCount
                ? "No rules"
                : (shield?.stats.totalBlocked ?? 0)}
          </span>
        </button>
        <button
          className="icon-button reader-button"
          aria-label="Reader mode"
          disabled={!active || !isWebUrl(active.url) || readerLoading}
          onClick={() => void openReader()}
        >
          <Icon name="book" />
        </button>
        <button
          className="icon-button"
          aria-label="Toggle AI sidebar"
          aria-expanded={aiOpen}
          onClick={() => setAiOpen((current) => !current)}
        >
          <Icon name="sparkles" />
        </button>
        <button
          className="icon-button"
          aria-label="Browser commands"
          onClick={() => setCommands(true)}
        >
          <Icon name="settings" />
        </button>
      </nav>
      {settings.showBookmarksBar && bookmarks.length > 0 && (
        <div className="bookmark-bar" aria-label="Bookmarks bar">
          {bookmarks.map((bookmark) => (
            <button
              key={bookmark.id}
              title={`${bookmark.folder ? bookmark.folder + " · " : ""}${bookmark.url}`}
              onClick={() => navigate(bookmark.url)}
            >
              <Icon name="star" size={12} />
              <span>{bookmark.title}</span>
            </button>
          ))}
        </div>
      )}
      {!api && (
        <div className="preview-banner">
          Desktop shell preview · Chromium tabs and profile data require the
          Electron application. This is not a web browser engine.
        </div>
      )}
      {errors.length > 0 && (
        <div className="error-banner" role="alert">
          <Icon name="alert" size={15} />
          <span>{errors[0]}</span>
          <button aria-label="Dismiss error" onClick={dismissError}>
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
      <div className="browser-content">
        <div ref={pageRef} id="page-viewport" className="page-viewport">
          {!ready ? (
            <div className="empty-state">Opening your space…</div>
          ) : readerLoading ? (
            <div className="empty-state">Reading page text locally…</div>
          ) : reader !== null ? (
            <ReaderModeView
              title={active?.title ?? "Reader"}
              url={active?.url ?? ""}
              content={reader}
              onClose={() => setReader(null)}
            />
          ) : active?.error ? (
            <div className="navigation-error">
              <Icon name="globe" size={36} />
              <h1>This page couldn’t open</h1>
              <p>{active.error}</p>
              <small>{active.url}</small>
              <button
                className="primary-button"
                onClick={() =>
                  activeId && void api?.reloadTab(activeId).catch(report)
                }
              >
                Try again
              </button>
            </div>
          ) : internalPage === "settings" ? (
            <SettingsView />
          ) : internalPage === "themestudio" ? (
            <ThemeStudioView />
          ) : internalPage === "extensions" ? (
            <ExtensionsView />
          ) : ["history", "bookmarks", "downloads"].includes(internalPage) ? (
            <LibraryView
              page={internalPage as "history" | "bookmarks" | "downloads"}
              navigate={navigate}
            />
          ) : internalPage === "newtab" || !active ? (
            <section className="new-tab internal-page">
              <div className="new-tab-monogram">
                <Icon name="moon" size={30} />
              </div>
              <span className="eyebrow">A little space to explore</span>
              <time className="new-tab-clock">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <p className="new-tab-date">
                {now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>Make room for curiosity.</h1>
              <form className="new-tab-search" onSubmit={submit}>
                <Icon name="search" />
                <input
                  aria-label="Search the web"
                  placeholder="Where would you like to go?"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={!api}
                />
                <button
                  className="icon-button"
                  aria-label="Search"
                  disabled={!api}
                >
                  <Icon name="forward" />
                </button>
              </form>
              <div className="new-tab-sites">
                {[
                  { title: "GitHub", url: "https://github.com", icon: "globe" },
                  {
                    title: "Wikipedia",
                    url: "https://wikipedia.org",
                    icon: "book",
                  },
                  {
                    title: "Bookmarks",
                    url: "lunar://bookmarks",
                    icon: "star",
                  },
                  { title: "History", url: "lunar://history", icon: "history" },
                ].map((site) => (
                  <button
                    key={site.title}
                    onClick={() => navigate(site.url)}
                    disabled={!api}
                  >
                    <Icon
                      name={site.icon as "globe" | "book" | "star" | "history"}
                      size={22}
                    />
                    <span>{site.title}</span>
                  </button>
                ))}
              </div>
              <p className="new-tab-status">
                <Icon name="shield" size={14} />
                {!api
                  ? "Your Coquette desktop, made for the web."
                  : settings.shield.enabled
                    ? loadedRuleCount
                      ? `Lunar Shield · ${shield?.stats.totalBlocked ?? 0} requests blocked this session`
                      : "Lunar Shield · no filter rules available"
                    : "Lunar Shield is paused"}
              </p>
            </section>
          ) : (
            !showNative && (
              <div className="empty-state native-covered">
                <Icon name="globe" size={30} />
                <p>The webpage is hidden while desktop controls are open.</p>
                <small>
                  Close the utility or activate Lunar Browser in the dock to
                  return.
                </small>
              </div>
            )
          )}
        </div>
        {aiOpen && (
          <AISidebar
            onClose={() => setAiOpen(false)}
            activeTabId={activeId ?? undefined}
            url={active?.url ?? ""}
          />
        )}
      </div>
      {shieldOpen && (
        <Modal title="Lunar Shield" onClose={() => setShieldOpen(false)}>
          <ShieldPanel url={active?.url ?? ""} />
        </Modal>
      )}
      {tabMenu && (
        <Modal title="Tab actions" onClose={() => setTabMenu(null)}>
          <div className="tab-actions">
            {[
              {
                label: "Duplicate tab",
                action: () => api?.duplicateTab(tabMenu),
              },
              {
                label: "Pin / unpin tab",
                action: () => api?.togglePinTab(tabMenu),
              },
              {
                label: "Mute / unmute tab",
                action: () => api?.toggleMuteTab(tabMenu),
              },
              { label: "Close tab", action: () => api?.closeTab(tabMenu) },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() =>
                  void action
                    .action()
                    ?.then(() => setTabMenu(null))
                    .catch(report)
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {editingBookmark && active && (
        <BookmarkEditor
          bookmark={currentBookmark}
          title={active.title}
          url={active.url}
          onClose={() => setEditingBookmark(false)}
        />
      )}
      <CommandPalette
        isOpen={commands}
        onClose={() => setCommands(false)}
        onNavigatePage={navigate}
        onNewTab={() => void api?.createTab().catch(report)}
        onCloseTab={() =>
          activeId && void api?.closeTab(activeId).catch(report)
        }
      />
      <OnboardingModal
        isOpen={onboarding}
        onComplete={async (searchEngine) => {
          await updateSettings({ isFirstRun: false, searchEngine });
        }}
      />
    </main>
  );
}
