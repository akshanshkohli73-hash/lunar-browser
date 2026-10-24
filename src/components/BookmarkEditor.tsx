import { useState } from "react";
import type { Bookmark } from "../../electron/types";
import { useBrowser } from "../state/BrowserContext";
import { Modal } from "./ui/Modal";
export function BookmarkEditor({
  bookmark,
  title: initialTitle,
  url: initialUrl,
  onClose,
}: {
  bookmark?: Bookmark;
  title: string;
  url: string;
  onClose: () => void;
}) {
  const { api, bookmarks, report } = useBrowser();
  const [title, setTitle] = useState(bookmark?.title ?? initialTitle),
    [url, setUrl] = useState(bookmark?.url ?? initialUrl),
    [folder, setFolder] = useState(bookmark?.folder ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={bookmark ? "Edit bookmark" : "Save bookmark"}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!api || busy) return;
          setBusy(true);
          setError("");
          try {
            const input = { title, url, folder };
            if (bookmark) await api.updateBookmark(bookmark.id, input);
            else await api.addBookmark(input);
            onClose();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not save bookmark.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Title
          <input
            required
            maxLength={300}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Destination
          <input
            required
            maxLength={8192}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label>
          Folder
          <input
            maxLength={60}
            list="bookmark-folders"
            placeholder="Unfiled"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          />
        </label>
        <datalist id="bookmark-folders">
          {[
            ...new Set(bookmarks.map((item) => item.folder).filter(Boolean)),
          ].map((folder) => (
            <option key={folder} value={folder} />
          ))}
        </datalist>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <footer>
          {bookmark && (
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => {
                if (api)
                  void api
                    .deleteBookmark(bookmark.id)
                    .then(onClose)
                    .catch(report);
              }}
            >
              Remove bookmark
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={!api || busy}>
            {busy ? "Saving…" : "Save bookmark"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
