import { useEffect, useMemo, useState } from "react";
import type {
  Bookmark,
  DownloadItemInfo,
  HistoryItem,
} from "../../electron/types";
import { isWebUrl } from "../../shared/navigation";
import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
import { BookmarkEditor } from "./BookmarkEditor";
import {
  useHistoryRevision,
  announceHistoryCleared,
} from "./useHistoryRevision";
import { Modal } from "./ui/Modal";
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function LibraryView({
  page,
  navigate,
}: {
  page: "history" | "bookmarks" | "downloads";
  navigate: (url: string) => void;
}) {
  const { api, bookmarks, report } = useBrowser();
  const historyRevision = useHistoryRevision();
  const [history, setHistory] = useState<HistoryItem[]>([]),
    [downloads, setDownloads] = useState<DownloadItemInfo[]>([]);
  const [query, setQuery] = useState(""),
    [folder, setFolder] = useState("all"),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Bookmark | null>(null),
    [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    let live = true;
    if (page === "history")
      void api
        ?.getHistory()
        .then((items) => {
          if (live) setHistory(items);
        })
        .catch(report);
    if (page === "downloads")
      void api
        ?.getDownloads()
        .then((items) => {
          if (live) setDownloads(items);
        })
        .catch(report);
    const unsubscribe = api?.onDownloadsUpdated(setDownloads);
    setQuery("");
    setSelected(new Set());
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [api, page, report, historyRevision]);
  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        `${item.title} ${item.url}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [history, query],
  );
  const filteredBookmarks = bookmarks.filter(
    (item) =>
      `${item.title} ${item.url}`.toLowerCase().includes(query.toLowerCase()) &&
      (folder === "all" || item.folder === folder),
  );
  const deleteHistory = async (ids: string[]) => {
    if (!api) return;
    try {
      await api.deleteHistoryItems(ids);
      setHistory((current) => current.filter((item) => !ids.includes(item.id)));
      setSelected(new Set());
    } catch (error) {
      report(error);
    }
  };
  return (
    <section className="library-page internal-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Your space</span>
          <h1>
            {page === "bookmarks"
              ? "Saved for later"
              : page === "history"
                ? "Where you’ve been"
                : "Downloads"}
          </h1>
        </div>
        {page === "history" && (
          <div className="button-row">
            <button
              disabled={!selected.size}
              onClick={() => void deleteHistory([...selected])}
            >
              Remove selected ({selected.size})
            </button>
            <button
              disabled={!history.length}
              onClick={() => setConfirmClear(true)}
            >
              Clear history
            </button>
          </div>
        )}
        {page === "downloads" && (
          <button
            onClick={() =>
              void api
                ?.clearDownloads()
                .then(() => api.getDownloads())
                .then(setDownloads)
                .catch(report)
            }
          >
            Clear finished records
          </button>
        )}
      </header>
      {page === "bookmarks" && (
        <div className="library-scope">
          <span>Bookmarks</span>
          <button disabled title="Not implemented yet">
            Reading list — not yet available
          </button>
          <button disabled title="Offline page saving is not implemented yet">
            Saved pages — not yet available
          </button>
        </div>
      )}
      {page !== "downloads" && (
        <div className="library-tools">
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label={`Search ${page}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${page}`}
            />
          </label>
          {page === "bookmarks" && (
            <select
              aria-label="Bookmark folder"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              <option value="all">All folders</option>
              {[...new Set(bookmarks.map((item) => item.folder))].map(
                (name) => (
                  <option value={name} key={name}>
                    {name || "Unfiled"}
                  </option>
                ),
              )}
            </select>
          )}
        </div>
      )}
      {page === "bookmarks" && (
        <div className="library-list">
          {!filteredBookmarks.length && (
            <p className="empty-state">
              No saved pages here yet. Use the star in the address bar to save a
              page.
            </p>
          )}
          {filteredBookmarks.map((item) => (
            <article className="library-row" key={item.id}>
              <Icon name="star" />
              <button
                className="library-destination"
                onClick={() => navigate(item.url)}
              >
                <strong>{item.title}</strong>
                <small>{item.url}</small>
              </button>
              <span className="row-detail">{item.folder || "Unfiled"}</span>
              <button
                aria-label={`Edit ${item.title}`}
                onClick={() => setEditing(item)}
              >
                <Icon name="edit" />
              </button>
              <button
                aria-label={`Remove ${item.title}`}
                onClick={() => void api?.deleteBookmark(item.id).catch(report)}
              >
                <Icon name="trash" />
              </button>
            </article>
          ))}
        </div>
      )}
      {page === "history" && (
        <div className="library-list">
          {!filteredHistory.length && (
            <p className="empty-state">
              No matching history. Only eligible web navigations are recorded
              when history is enabled.
            </p>
          )}
          {filteredHistory.map((item) => (
            <article className="library-row" key={item.id}>
              <input
                type="checkbox"
                aria-label={`Select ${item.title}`}
                checked={selected.has(item.id)}
                onChange={(event) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    return next;
                  })
                }
              />
              <button
                className="library-destination"
                onClick={() => navigate(item.url)}
              >
                <strong>{item.title || item.url}</strong>
                <small>{item.url}</small>
              </button>
              <time className="row-detail">
                {new Date(item.visitTime).toLocaleString()}
              </time>
              <button
                aria-label={`Remove visit to ${item.title}`}
                onClick={() => void deleteHistory([item.id])}
              >
                <Icon name="trash" />
              </button>
            </article>
          ))}
        </div>
      )}
      {page === "downloads" && (
        <div className="library-list">
          {!downloads.length && (
            <p className="empty-state">
              No downloads yet. Websites use Chromium’s Save As dialog; Lunar
              never opens downloaded files automatically.
            </p>
          )}
          {downloads.map((item) => (
            <article className="download-row" key={item.id}>
              <div className="library-row">
                <Icon name="download" />
                <div className="library-destination">
                  <strong>{item.filename}</strong>
                  <small>
                    {item.status} · {formatBytes(item.receivedBytes)}
                    {item.totalBytes
                      ? ` / ${formatBytes(item.totalBytes)}`
                      : ""}
                    {item.speed > 0 ? ` · ${formatBytes(item.speed)}/s` : ""}
                  </small>
                </div>
                <div className="button-row">
                  {item.status === "progressing" && (
                    <button
                      onClick={() =>
                        void api?.pauseDownload(item.id).catch(report)
                      }
                    >
                      Pause
                    </button>
                  )}
                  {item.canResume && (
                    <button
                      onClick={() =>
                        void api?.resumeDownload(item.id).catch(report)
                      }
                    >
                      Resume
                    </button>
                  )}
                  {item.canCancel && (
                    <button
                      onClick={() =>
                        void api?.cancelDownload(item.id).catch(report)
                      }
                    >
                      Cancel
                    </button>
                  )}
                  {item.status === "interrupted" &&
                    !item.canCancel &&
                    isWebUrl(item.url) && (
                      <button onClick={() => navigate(item.url)}>
                        Retry download
                      </button>
                    )}
                  {item.status === "completed" && (
                    <button
                      onClick={() =>
                        void api?.revealDownload(item.id).catch(report)
                      }
                    >
                      Show in folder
                    </button>
                  )}
                </div>
              </div>
              {["progressing", "paused"].includes(item.status) &&
                (item.totalBytes > 0 ? (
                  <progress
                    aria-label={`${item.filename} download progress`}
                    max={item.totalBytes}
                    value={item.receivedBytes}
                  />
                ) : (
                  <progress aria-label={`${item.filename} download progress`} />
                ))}
              {item.error && <p className="error-text">{item.error}</p>}
            </article>
          ))}
        </div>
      )}
      {editing && (
        <BookmarkEditor
          bookmark={editing}
          title={editing.title}
          url={editing.url}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmClear && (
        <Modal
          title="Clear browsing history?"
          onClose={() => setConfirmClear(false)}
        >
          <p>
            This removes all recorded visits in this profile. Bookmarks and site
            data are kept.
          </p>
          <footer>
            <button onClick={() => setConfirmClear(false)}>Cancel</button>
            <button
              className="danger-button"
              onClick={() =>
                void api
                  ?.clearHistory()
                  .then(() => {
                    announceHistoryCleared();
                    setHistory([]);
                    setSelected(new Set());
                    setConfirmClear(false);
                  })
                  .catch(report)
              }
            >
              Clear all visits
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
