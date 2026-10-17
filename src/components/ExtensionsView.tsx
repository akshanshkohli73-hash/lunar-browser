import { useEffect, useState } from "react";
import type { ExtensionInfo } from "../../electron/types";
import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
export default function ExtensionsView() {
  const { api } = useBrowser();
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void api
      ?.getExtensions()
      .then((items) => {
        if (live) setExtensions(items);
      })
      .catch(() => setError("Could not read installed extensions."));
    return () => {
      live = false;
    };
  }, [api]);
  const run = async (operation: () => Promise<unknown>) => {
    if (!api) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Extension operation failed.",
      );
    } finally {
      try {
        setExtensions(await api.getExtensions());
      } catch {
        setError(
          "Could not refresh the native extension registry. Reopen this manager.",
        );
      }
      setBusy(false);
    }
  };
  return (
    <section className="internal-page extensions-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">A little extra</span>
          <h1>Extensions</h1>
        </div>
        <button
          disabled={!api || busy}
          onClick={() => void run(() => api!.loadUnpackedExtension())}
        >
          Load unpacked folder…
        </button>
      </header>
      <p>
        Electron implements a subset of Chrome extension APIs. Unpacked
        extensions only; no Chrome Web Store installer, browser-action toolbar,
        or promise of complete Manifest V2/V3 compatibility. Review the native
        permission confirmation before loading code you trust.
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!extensions.length && (
        <div className="empty-state">
          <Icon name="puzzle" size={32} />
          <h2>No extensions loaded</h2>
          <p>
            Loaded extensions are isolated to webpage sessions. They never
            receive Lunar’s preload bridge.
          </p>
        </div>
      )}
      <div className="extension-list">
        {extensions.map((extension) => (
          <article key={extension.id}>
            <header>
              <Icon name="puzzle" />
              <div>
                <h2>{extension.name}</h2>
                <small>{extension.version} · Partial API compatibility</small>
              </div>
            </header>
            <p>{extension.description}</p>
            <details>
              <summary>Requested access</summary>
              <ul>
                {extension.permissions.map((permission) => (
                  <li key={permission}>{permission}</li>
                ))}
              </ul>
              <code>{extension.path}</code>
            </details>
            {extension.error && (
              <p role="alert" className="error-text">
                {extension.error}
              </p>
            )}
            <footer>
              <label>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={extension.enabled}
                  onChange={(event) =>
                    void run(() =>
                      api!.toggleExtension(extension.id, event.target.checked),
                    )
                  }
                />
                {extension.enabled ? "Loaded in Chromium" : "Not loaded"}
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => api!.removeExtension(extension.id))
                }
              >
                Remove
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
