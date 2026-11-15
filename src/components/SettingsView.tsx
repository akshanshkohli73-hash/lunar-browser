import { GlassBacking as LiquidHeadingBacking } from "./ui/GlassControls";
import { GlassFieldset } from "./ui/GlassControls";
import { useEffect, useState } from "react";
import { useBrowser } from "../state/BrowserContext";
import type { BrowserSettings, AIStatus } from "../../electron/types";
import { Icon, type IconName } from "./ui/Icon";
import { KEYBOARD_SHORTCUTS } from "../state/control-center";
import ThemeStudioView from "./AsyncThemeStudio";
import ExtensionsView from "./ExtensionsView";
const sections: { id: string; title: string; icon: IconName }[] = [
  { id: "general", title: "Browsing", icon: "globe" },
  { id: "appearance", title: "Appearance", icon: "palette" },
  { id: "privacy", title: "Privacy & permissions", icon: "lock" },
  { id: "shield", title: "Lunar Shield", icon: "shield" },
  { id: "ai", title: "Optional AI", icon: "sparkles" },
  { id: "extensions", title: "Extensions", icon: "puzzle" },
  { id: "shortcuts", title: "Keyboard & about", icon: "settings" },
];
function Toggle({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
export default function SettingsView() {
  const { api, ready, settings, updateSettings, openPage } = useBrowser();
  const [section, setSection] = useState("general"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null),
    [key, setKey] = useState(""),
    [model, setModel] = useState(settings.aiModel);
  useEffect(() => {
    setModel(settings.aiModel);
  }, [settings.aiModel]);
  useEffect(() => {
    void api
      ?.getAIStatus()
      .then(setAIStatus)
      .catch(() => setAIStatus(null));
  }, [api, settings.aiProvider, settings.aiEnabled]);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "The operation failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const update = (patch: Partial<BrowserSettings>) =>
    void run(() => updateSettings(patch), "Preferences saved.");
  return (
    <div className="settings-layout">
      <nav className="settings-navigation" aria-label="Preferences sections">
        <h2>Preferences</h2>
        {sections.map((item) => (
          <button
            key={item.id}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => {
              setSection(item.id);
              setMessage("");
              setError("");
            }}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.title}</span>
          </button>
        ))}
      </nav>
      <section className="settings-content internal-page">
        <header
          className="page-heading liquid-page-heading"
          data-glass-owner="true"
          data-liquid-morph="panel-settings"
        >
          <LiquidHeadingBacking level="light" />
          <div>
            <span className="eyebrow">Lunar, your way</span>
            <h1>{sections.find((item) => item.id === section)?.title}</h1>
          </div>
        </header>
        {!api && (
          <p className="muted-text">
            Preferences are managed by the installed Electron application.
            Desktop preview controls do not write a profile.
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="status-text" role="status">
            {message}
          </p>
        )}
        <GlassFieldset key={section} disabled={busy || !api || !ready}>
          {section === "general" && (
            <>
              <h2>Everyday browsing</h2>
              <label className="setting-row">
                <span>
                  <strong>Search engine</strong>
                  <small>Used for address-bar queries, not valid URLs.</small>
                </span>
                <select
                  value={settings.searchEngine}
                  onChange={(event) =>
                    update({
                      searchEngine: event.target
                        .value as BrowserSettings["searchEngine"],
                    })
                  }
                >
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                </select>
              </label>
              <Toggle
                label="Bookmarks bar"
                hint="Keep your saved pages within reach."
                value={settings.showBookmarksBar}
                onChange={(value) => update({ showBookmarksBar: value })}
              />
              <Toggle
                label="Restore tabs on launch"
                hint="Opt-in. Saves page URLs, order, pinned state and the active tab; not form contents."
                value={settings.restoreSession}
                onChange={(value) => update({ restoreSession: value })}
              />
              <Toggle
                label="Reduced motion"
                hint="Reduce desktop and browser animations. Your system preference is also respected."
                value={settings.reducedMotion}
                onChange={(value) => update({ reducedMotion: value })}
              />
              <p className="muted-text">
                Downloads always ask where to save. Lunar does not execute
                downloaded files.
              </p>
            </>
          )}
          {section === "privacy" && (
            <>
              <h2>Local profile</h2>
              <Toggle
                label="Remember browsing history"
                hint="Records eligible HTTP(S) visits. Common authentication callback URLs and internal pages are excluded."
                value={settings.recordHistory}
                onChange={(value) => update({ recordHistory: value })}
              />
              <p className="muted-text">
                Turning history off does not erase previous visits. Remove
                visits in the History manager. Bookmarks, history and settings
                are stored as validated JSON in the OS application-data folder.
                Website storage is isolated from Lunar’s own interface.
              </p>
              <h2>One place for privacy controls</h2>
              <p>
                Lunar Shield now manages exact-origin policies, supported
                Ask/Allow/Block permissions and deliberate cookie/cache/storage
                clearing. Sensitive persistent Allow choices require native
                confirmation. Cross-origin frames and unsupported device
                permissions remain denied.
              </p>
              <button onClick={() => void run(() => openPage("shield"), "")}>
                Open privacy dashboard
              </button>
            </>
          )}
          {section === "shield" && (
            <>
              <h2>Lunar Shield 2.0</h2>
              <p>
                Live network statistics, filter-list updates, custom rules,
                exact-origin exceptions and the dedicated YouTube privacy
                profile now share one dashboard. These are functional desktop
                controls, not a second settings copy.
              </p>
              <button onClick={() => void run(() => openPage("shield"), "")}>
                Open Lunar Shield dashboard
              </button>
              <p className="muted-text">
                Network protection cannot guarantee anonymity or remove every
                advertisement. Actual request cancellations are separate from
                popups and cookie-header removals.
              </p>
            </>
          )}
          {section === "ai" && (
            <>
              <h2>Entirely optional</h2>
              <Toggle
                label="Enable AI assistant"
                hint="Browsing works without an AI provider. No page content is shared by default."
                value={settings.aiEnabled}
                onChange={(value) => update({ aiEnabled: value })}
              />
              <label className="setting-row">
                Provider
                <select
                  value={settings.aiProvider}
                  onChange={(event) => {
                    setKey("");
                    update({
                      aiProvider: event.target
                        .value as BrowserSettings["aiProvider"],
                      aiModel: "",
                    });
                  }}
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>
              <form
                className="editor-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  update({ aiModel: model });
                }}
              >
                <label>
                  Model identifier
                  <input
                    required
                    value={model}
                    maxLength={100}
                    placeholder="Use a current model ID from your provider"
                    onChange={(event) => setModel(event.target.value)}
                  />
                </label>
                <button>Save model</button>
              </form>
              <form
                className="editor-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    try {
                      setAIStatus(await api!.saveAIKey(key));
                    } finally {
                      setKey("");
                    }
                  }, "API key encrypted and saved. It is never returned to the interface.");
                }}
              >
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    maxLength={512}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={
                      aiStatus?.configured
                        ? "An encrypted key is configured"
                        : "Enter an API key"
                    }
                  />
                </label>
                <div className="button-row">
                  <button disabled={!key || !aiStatus?.secureStorage}>
                    Save encrypted key
                  </button>
                  <button
                    type="button"
                    disabled={!aiStatus?.configured}
                    onClick={() =>
                      void run(
                        async () => setAIStatus(await api!.deleteAIKey()),
                        "Encrypted key removed.",
                      )
                    }
                  >
                    Remove key
                  </button>
                  <button
                    type="button"
                    disabled={
                      !aiStatus?.configured ||
                      !settings.aiModel ||
                      !settings.aiEnabled
                    }
                    onClick={() =>
                      void run(async () => {
                        await api!.testAI();
                      }, "The provider returned a live text response. No page context was sent.")
                    }
                  >
                    Test connection
                  </button>
                </div>
              </form>
              {aiStatus && !aiStatus.secureStorage && (
                <p className="error-text">
                  OS-encrypted secret storage is unavailable. Configure the
                  system keychain; Lunar will not store plaintext keys.
                </p>
              )}
              <p className="muted-text">
                Requests originate in the main process with a 30-second timeout.
                A connection test may use provider credits. Page text is sent
                only when you explicitly check sharing for the active page in
                the sidebar; screenshots are not sent. Models and provider
                availability change—configure an identifier from your own
                account.
              </p>
            </>
          )}
        </GlassFieldset>
        {section === "appearance" && <ThemeStudioView />}
        {section === "extensions" && <ExtensionsView />}
        {section === "shortcuts" && (
          <>
            <dl className="shortcut-list">
              {KEYBOARD_SHORTCUTS.map(([keys, action]) => (
                <div key={keys}>
                  <dt>{action}</dt>
                  <dd>
                    <kbd>{keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <h2>Lunar Browser</h2>
            <p>
              Chromium rendering uses Electron WebContentsView, not iframes.
              Extension APIs are partial. Windows installers must be built and
              runtime-verified on Windows before release.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
