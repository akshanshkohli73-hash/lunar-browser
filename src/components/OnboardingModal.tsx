import { useState } from "react";
import type { SearchEngine } from "../../shared/navigation";
import { Modal } from "./ui/Modal";
import { Icon } from "./ui/Icon";
export default function OnboardingModal({
  isOpen,
  onComplete,
}: {
  isOpen: boolean;
  onComplete: (engine: SearchEngine) => Promise<void>;
}) {
  const [engine, setEngine] = useState<SearchEngine>("google"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!isOpen) return null;
  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await onComplete(engine);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save preferences.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Welcome to Lunar"
      onClose={() => {
        if (!busy) void finish();
      }}
    >
      <div className="onboarding-content">
        <Icon name="moon" size={42} />
        <h1>Your little corner of the web.</h1>
        <p>
          A Coquette desktop around a real Chromium browser. Choose your search
          engine to get started.
        </p>
        <label>
          Search engine
          <select
            value={engine}
            onChange={(event) => setEngine(event.target.value as SearchEngine)}
          >
            <option value="google">Google</option>
            <option value="bing">Bing</option>
            <option value="duckduckgo">DuckDuckGo</option>
          </select>
        </label>
        <p className="muted-text">
          Lunar Shield’s core network rules are enabled. History is local;
          session restoration and AI are opt-in. Review these choices in
          Preferences at any time.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void finish()}
        >
          {busy ? "Saving…" : "Start exploring"}
        </button>
      </div>
    </Modal>
  );
}
