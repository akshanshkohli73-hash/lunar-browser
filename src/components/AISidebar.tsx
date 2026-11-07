import { useEffect, useRef, useState } from "react";
import { useBrowser } from "../state/BrowserContext";
import { isWebUrl } from "../../shared/navigation";
import { Icon } from "./ui/Icon";
export default function AISidebar({
  onClose,
  activeTabId,
  url,
}: {
  onClose: () => void;
  activeTabId?: string;
  url: string;
}) {
  const { api, settings } = useBrowser();
  const [messages, setMessages] = useState<
      { id: number; role: "user" | "assistant"; content: string }[]
    >([]),
    [prompt, setPrompt] = useState(""),
    [sharing, setSharing] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setSharing(false);
  }, [activeTabId, url]);
  const sequence = useRef(0),
    inFlight = useRef(false);
  const send = async (text: string) => {
    if (!api || !text.trim() || inFlight.current) return;
    inFlight.current = true;
    const share = sharing;
    setSharing(false);
    setLoading(true);
    setError("");
    setMessages((current) => [
      ...current,
      { id: ++sequence.current, role: "user", content: text },
    ]);
    setPrompt("");
    try {
      const response = await api.askAI({
        prompt: text,
        tabId: activeTabId,
        sharePageContext: share,
      });
      setMessages((current) => [
        ...current,
        { id: ++sequence.current, role: "assistant", content: response },
      ]);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "The AI request failed.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* Not a webpage. */
  }
  return (
    <aside className="ai-sidebar" aria-label="Optional AI assistant">
      <header>
        <Icon name="sparkles" />
        <strong>Lunar companion</strong>
        <button
          className="icon-button"
          aria-label="Close AI sidebar"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </header>
      <p className="muted-text">
        {settings.aiEnabled
          ? `${settings.aiProvider === "gemini" ? "Gemini" : "OpenRouter"} · configured in Preferences`
          : "AI is off. Enable and configure a provider in Preferences. Browsing is unaffected."}
      </p>
      <label className="context-consent">
        <input
          type="checkbox"
          checked={sharing}
          disabled={!isWebUrl(url) || loading}
          onChange={(event) => setSharing(event.target.checked)}
        />
        <span>
          Share readable text from{" "}
          <strong>{host || "the active webpage"}</strong> with{" "}
          {settings.aiProvider === "gemini" ? "Google Gemini" : "OpenRouter"}{" "}
          for this message. No screenshots.
        </span>
      </label>
      <div className="ai-quick-actions">
        {[
          ["Summarize", "Summarize this webpage."],
          ["Explain", "Explain the key ideas in this webpage."],
          ["Notes", "Create concise notes from this webpage."],
        ].map(([label, text]) => (
          <button
            key={label}
            disabled={!sharing || loading || !settings.aiEnabled || !api}
            onClick={() => void send(text)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ai-messages" aria-live="polite">
        {!messages.length && (
          <div className="ai-empty">
            <Icon name="sparkles" size={28} />
            <p>A question, a fresh perspective, or help with a page.</p>
            <small>
              Your page stays private unless you choose to share it. Providers
              may charge for requests.
            </small>
          </div>
        )}
        {messages.map((message) => (
          <div className={`ai-message ${message.role}`} key={message.id}>
            <small>{message.role === "user" ? "You" : "Lunar"}</small>
            <p>{message.content}</p>
          </div>
        ))}
        {loading && <p role="status">Waiting for the provider…</p>}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(prompt);
        }}
      >
        <label className="sr-only" htmlFor="ai-prompt">
          Ask Lunar AI
        </label>
        <textarea
          id="ai-prompt"
          placeholder="Ask a question…"
          value={prompt}
          maxLength={8000}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={loading || !settings.aiEnabled}
          rows={2}
        />
        <button
          className="primary-button"
          disabled={loading || !prompt.trim() || !settings.aiEnabled || !api}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
