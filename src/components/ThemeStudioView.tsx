import { useEffect, useRef, useState } from "react";
import { BUILTIN_THEMES } from "../styles/themes";
import { themeSchema, type ThemeTokens } from "../../shared/schemas";
import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
export default function ThemeStudioView() {
  const { api, ready, settings, updateSettings } = useBrowser();
  const current =
    settings.customTheme ??
    BUILTIN_THEMES[settings.themeId] ??
    BUILTIN_THEMES["lunar-coquette"];
  const [draft, setDraft] = useState<ThemeTokens>(current),
    [tab, setTab] = useState<"presets" | "customize">("presets"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(current);
  }, [current]);
  const save = async (theme: ThemeTokens, preset = false) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const safe = themeSchema.parse(theme);
      await updateSettings({
        themeId: safe.id,
        customTheme: preset ? undefined : safe,
      });
      setMessage("Appearance saved to this profile.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save appearance.",
      );
    } finally {
      setBusy(false);
    }
  };
  const colorKeys = [
    "primary",
    "secondary",
    "bg",
    "surface",
    "text",
    "textMuted",
  ] as const;
  return (
    <section className="internal-page theme-studio">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Make yourself at home</span>
          <h1>Theme Studio</h1>
          <p>
            One palette for your desktop, browser chrome, and utilities.
            Websites keep their own colors.
          </p>
        </div>
        <Icon name="palette" size={32} />
      </header>
      <div className="section-tabs">
        <button
          aria-pressed={tab === "presets"}
          onClick={() => setTab("presets")}
        >
          Curated palettes
        </button>
        <button
          aria-pressed={tab === "customize"}
          onClick={() => setTab("customize")}
        >
          Your own touch
        </button>
      </div>
      {!api && (
        <p className="muted-text">
          This preview displays the desktop. Saving customization requires the
          Electron application.
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {message && (
        <p role="status" aria-label="Theme save status" className="status-text">
          {message}
        </p>
      )}
      {tab === "presets" ? (
        <div className="theme-presets">
          {Object.values(BUILTIN_THEMES).map((preset) => (
            <button
              className={`theme-preset ${settings.themeId === preset.id && !settings.customTheme ? "is-selected" : ""}`}
              key={preset.id}
              disabled={!api || !ready || busy}
              aria-pressed={
                settings.themeId === preset.id && !settings.customTheme
              }
              onClick={() => void save(preset, true)}
            >
              <div
                className="theme-preview"
                style={{
                  background: preset.colors.bg,
                  borderColor: preset.colors.border,
                }}
              >
                <div style={{ background: preset.colors.bgSecondary }}>
                  <i style={{ background: preset.colors.secondary }} />
                  <span style={{ background: preset.colors.surface }} />
                </div>
                <Icon
                  name="moon"
                  style={{ color: preset.colors.primary }}
                  size={26}
                />
                <div
                  className="theme-preview-dock"
                  style={{ background: preset.colors.surface }}
                >
                  <i style={{ background: preset.colors.primary }} />
                  <i style={{ background: preset.colors.secondary }} />
                  <i style={{ background: preset.colors.accent }} />
                </div>
              </div>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="theme-controls">
          <h2>Colors</h2>
          <div className="theme-color-controls">
            {colorKeys.map((key) => (
              <label key={key}>
                <span>
                  {
                    {
                      primary: "Accent",
                      secondary: "Desktop blush",
                      bg: "Background",
                      surface: "Surface",
                      text: "Text",
                      textMuted: "Secondary text",
                    }[key]
                  }
                </span>
                <input
                  aria-label={`${key} color`}
                  type="color"
                  value={
                    draft.colors[key].startsWith("#")
                      ? draft.colors[key]
                      : "#777777"
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      colors: { ...current.colors, [key]: event.target.value },
                    }))
                  }
                />
                <code>{draft.colors[key]}</code>
              </label>
            ))}
          </div>
          <h2>Finishing touches</h2>
          <label className="setting-row">
            Corner radius{" "}
            <input
              type="range"
              aria-label="Corner radius"
              min={0}
              max={24}
              value={draft.appearance.cornerRadius}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    cornerRadius: Number(event.target.value),
                  },
                }))
              }
            />
            <output>{draft.appearance.cornerRadius}px</output>
          </label>
          <label className="setting-row">
            Glass blur{" "}
            <input
              type="range"
              aria-label="Glass blur"
              min={0}
              max={32}
              value={draft.appearance.blur}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  appearance: {
                    ...current.appearance,
                    blur: Number(event.target.value),
                  },
                }))
              }
            />
            <output>{draft.appearance.blur}px</output>
          </label>
          <label className="setting-row">
            Browser text scale{" "}
            <input
              type="range"
              aria-label="Text scale"
              min={0.8}
              max={1.2}
              step={0.05}
              value={draft.typography.uiScale}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  typography: {
                    ...current.typography,
                    uiScale: Number(event.target.value),
                  },
                }))
              }
            />
            <output>{Math.round(draft.typography.uiScale * 100)}%</output>
          </label>
          <label className="setting-row">
            Toolbar spacing
            <select
              value={draft.layout.density}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  layout: {
                    ...current.layout,
                    density: event.target
                      .value as ThemeTokens["layout"]["density"],
                  },
                }))
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
          <label className="setting-row">
            Tab shape
            <select
              value={draft.layout.tabStyle}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  layout: {
                    ...current.layout,
                    tabStyle: event.target
                      .value as ThemeTokens["layout"]["tabStyle"],
                  },
                }))
              }
            >
              <option value="minimal">Minimal</option>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
            </select>
          </label>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={busy || !api || !ready}
              onClick={() =>
                void save({
                  ...draft,
                  id: "custom-coquette",
                  name: "My Lunar",
                  description: "Your custom desktop palette.",
                })
              }
            >
              {busy ? "Saving…" : "Apply customization"}
            </button>
            <button disabled={busy} onClick={() => setDraft(current)}>
              Reset draft
            </button>
          </div>
        </div>
      )}
      <footer className="theme-import-export">
        <button onClick={() => file.current?.click()}>Import palette</button>
        <input
          hidden
          ref={file}
          type="file"
          accept="application/json,.json"
          aria-label="Import palette file"
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            setError("");
            setMessage("");
            try {
              if (selected.size > 64 * 1024)
                throw new Error("Theme files must be smaller than 64 KB.");
              const safe = themeSchema.parse(JSON.parse(await selected.text()));
              setDraft(safe);
              setTab("customize");
              setMessage(
                "Palette imported into the draft. Apply customization to save it.",
              );
            } catch {
              setError(
                "This file is not a valid Lunar palette. Colors and numeric ranges must use the supported format.",
              );
            }
            event.target.value = "";
          }}
        />
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(current, null, 2)], {
                type: "application/json",
              }),
              url = URL.createObjectURL(blob),
              link = document.createElement("a");
            link.href = url;
            link.download = "lunar-theme.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export current palette
        </button>
      </footer>
    </section>
  );
}
