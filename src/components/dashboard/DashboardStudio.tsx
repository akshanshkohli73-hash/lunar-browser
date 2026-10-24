import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_DASHBOARD,
  WIDGET_DEFINITIONS,
  arrangeWidgets,
  createWidget,
  dashboardSchema,
  type DashboardSettings,
  type DashboardWidget,
  type WidgetKind,
} from "../../../shared/dashboard";
import { useBrowser } from "../../state/BrowserContext";
import { Icon } from "../ui/Icon";
import { WALLPAPERS, Wallpaper } from "./Wallpaper";

function WidgetSettings({
  widget,
  change,
}: {
  widget: DashboardWidget;
  change: (next: DashboardWidget) => void;
}) {
  switch (widget.kind) {
    case "clock":
      return (
        <>
          <label className="setting-toggle">
            24-hour clock
            <input
              type="checkbox"
              checked={widget.config.hour24}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, hour24: e.target.checked },
                })
              }
            />
          </label>
          <label className="setting-toggle">
            Show date
            <input
              type="checkbox"
              checked={widget.config.showDate}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, showDate: e.target.checked },
                })
              }
            />
          </label>
        </>
      );
    case "search":
      return (
        <label>
          Search hint
          <input
            aria-label="Search hint"
            maxLength={80}
            value={widget.config.placeholder}
            onChange={(e) =>
              change({ ...widget, config: { placeholder: e.target.value } })
            }
          />
        </label>
      );
    case "bookmarks":
      return (
        <>
          <label>
            Bookmark folder (empty = all)
            <input
              aria-label="Bookmark folder"
              maxLength={60}
              value={widget.config.folder}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, folder: e.target.value },
                })
              }
            />
          </label>
          <label>
            Number of bookmarks
            <input
              aria-label="Number of bookmarks"
              type="number"
              min={1}
              max={12}
              value={widget.config.limit}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, limit: Number(e.target.value) },
                })
              }
            />
          </label>
        </>
      );
    case "weather":
      return (
        <>
          <label>
            Location label
            <input
              maxLength={60}
              value={widget.config.location}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, location: e.target.value },
                })
              }
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={widget.config.latitude}
              onChange={(e) =>
                change({
                  ...widget,
                  config: {
                    ...widget.config,
                    latitude: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={widget.config.longitude}
              onChange={(e) =>
                change({
                  ...widget,
                  config: {
                    ...widget.config,
                    longitude: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Temperature units
            <select
              value={widget.config.units}
              onChange={(e) =>
                change({
                  ...widget,
                  config: {
                    ...widget.config,
                    units:
                      e.target.value === "fahrenheit"
                        ? "fahrenheit"
                        : "celsius",
                  },
                })
              }
            >
              <option value="celsius">Celsius</option>
              <option value="fahrenheit">Fahrenheit</option>
            </select>
          </label>
          <label className="setting-toggle">
            Allow sending these coordinates to Open-Meteo when I press Update
            <input
              type="checkbox"
              checked={widget.config.consent}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, consent: e.target.checked },
                })
              }
            />
          </label>
          <p className="muted-text">
            No location is inferred. No requests run automatically. Public API
            terms apply; provider availability is not guaranteed.
          </p>
        </>
      );
    case "calendar":
      return (
        <label className="setting-toggle">
          Week starts on Monday
          <input
            type="checkbox"
            checked={widget.config.mondayFirst}
            onChange={(e) =>
              change({ ...widget, config: { mondayFirst: e.target.checked } })
            }
          />
        </label>
      );
    case "notes":
      return (
        <label>
          Note heading
          <input
            maxLength={60}
            value={widget.config.title}
            onChange={(e) =>
              change({ ...widget, config: { title: e.target.value } })
            }
          />
        </label>
      );
    case "recent":
      return (
        <>
          <label className="setting-toggle">
            Show my saved history in this widget
            <input
              type="checkbox"
              checked={widget.config.enabled}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, enabled: e.target.checked },
                })
              }
            />
          </label>
          <label>
            Number of visits
            <input
              type="number"
              min={1}
              max={12}
              value={widget.config.limit}
              onChange={(e) =>
                change({
                  ...widget,
                  config: { ...widget.config, limit: Number(e.target.value) },
                })
              }
            />
          </label>
          <p className="muted-text">
            This does not enable history recording. You can clear saved visits
            in History.
          </p>
        </>
      );
    case "shortcuts":
      return (
        <>
          <p className="muted-text">HTTP, HTTPS and known Lunar pages only.</p>
          {widget.config.links.map((link, i) => (
            <fieldset className="shortcut-editor" key={i}>
              <legend>Tile {i + 1}</legend>
              <label>
                Title
                <input
                  aria-label={`Tile ${i + 1} title`}
                  value={link.title}
                  maxLength={60}
                  onChange={(e) =>
                    change({
                      ...widget,
                      config: {
                        links: widget.config.links.map((other, n) =>
                          n === i ? { ...other, title: e.target.value } : other,
                        ),
                      },
                    })
                  }
                />
              </label>
              <label>
                Destination
                <input
                  aria-label={`Tile ${i + 1} destination`}
                  value={link.url}
                  maxLength={8192}
                  onChange={(e) =>
                    change({
                      ...widget,
                      config: {
                        links: widget.config.links.map((other, n) =>
                          n === i ? { ...other, url: e.target.value } : other,
                        ),
                      },
                    })
                  }
                />
              </label>
              <button
                onClick={() =>
                  change({
                    ...widget,
                    config: {
                      links: widget.config.links.filter((_, n) => n !== i),
                    },
                  })
                }
              >
                Remove tile {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            disabled={widget.config.links.length >= 12}
            onClick={() =>
              change({
                ...widget,
                config: {
                  links: [
                    ...widget.config.links,
                    { title: "New destination", url: "https://example.com" },
                  ],
                },
              })
            }
          >
            Add shortcut tile
          </button>
        </>
      );
    case "focus":
      return (
        <label>
          Reset duration (minutes)
          <small>
            The new duration is used by Reset timer; an existing countdown is
            kept.
          </small>
          <input
            type="number"
            min={1}
            max={120}
            value={widget.config.minutes}
            onChange={(e) =>
              change({ ...widget, config: { minutes: Number(e.target.value) } })
            }
          />
        </label>
      );
  }
}
export default function DashboardStudio({
  onPreview,
  onDone,
  mode = "all",
}: {
  mode?: "all" | "widgets";
  onPreview?: (draft: DashboardSettings | null) => void;
  onDone?: () => void;
}) {
  const {
    dashboard,
    ready,
    api,
    updateDashboard,
    previewDashboard,
    reducedMotion,
  } = useBrowser();
  const owner = useId();
  const [draft, setDraft] = useState(dashboard),
    [selected, setSelected] = useState(dashboard.widgets[0]?.id ?? ""),
    [kind, setKind] = useState<WidgetKind>("weather"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const dirty = useRef(false),
    previewRef = useRef(onPreview);
  previewRef.current = onPreview;
  useEffect(() => {
    if (ready && !dirty.current) setDraft(dashboard);
  }, [ready, dashboard]);
  useEffect(() => {
    previewRef.current?.(draft);
    if (ready) previewDashboard(owner, draft);
    return () => previewDashboard(owner, null);
  }, [draft, owner, previewDashboard, ready]);
  useEffect(() => () => previewRef.current?.(null), []);
  const change = (next: DashboardSettings) => {
    dirty.current = true;
    setDraft(next);
    setError("");
    setMessage("Preview · not saved yet");
  };
  const changeWidget = (next: DashboardWidget) =>
    change({ ...draft, widgets: arrangeWidgets(draft.widgets, next) });
  const current = draft.widgets.find((w) => w.id === selected);
  const move = (dx: number, dy: number) => {
    if (current)
      changeWidget({ ...current, x: current.x + dx, y: current.y + dy });
  };
  const cancel = () => {
    dirty.current = false;
    setDraft(dashboard);
    onPreview?.(null);
    previewDashboard(owner, null);
    setError("");
    setMessage("Preview cancelled. Saved dashboard kept.");
    onDone?.();
  };
  const apply = async () => {
    setBusy(true);
    setError("");
    try {
      const safe = dashboardSchema.safeParse(draft);
      if (!safe.success)
        throw new Error(
          safe.error.issues[0]?.message ?? "Check your dashboard settings.",
        );
      // Notes and calendar events may change independently; a layout save must not overwrite them.
      await updateDashboard({
        wallpaper: safe.data.wallpaper,
        widgets: safe.data.widgets,
        alignment: safe.data.alignment,
        widgetOpacity: safe.data.widgetOpacity,
        text: safe.data.text,
        dock: safe.data.dock,
      });
      dirty.current = false;
      setMessage("Dashboard saved to this profile.");
      onPreview?.(null);
      previewDashboard(owner, null);
      onDone?.();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save dashboard.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dashboard-studio">
      {mode !== "widgets" && (
        <div className="dashboard-preview" aria-label="Wallpaper preview">
          <Wallpaper
            value={draft.wallpaper}
            active
            preview
            reduceMotion={reducedMotion}
          />
          <span>Wallpaper preview · nothing is uploaded</span>
        </div>
      )}
      <p className="muted-text">
        Changes remain a preview until Apply. Local images: up to 20 MB;
        MP4/WebM: up to 150 MB. Unsupported codecs report a playback error.
      </p>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <fieldset hidden={mode === "widgets"} disabled={busy || !ready}>
        <legend>Canvas & wallpaper</legend>
        <div className="wallpaper-presets">
          {Object.entries(WALLPAPERS).map(([key, item]) => (
            <button
              key={key}
              aria-pressed={
                draft.wallpaper.kind === "builtin" &&
                draft.wallpaper.builtin === key
              }
              onClick={() =>
                change({
                  ...draft,
                  wallpaper: {
                    ...draft.wallpaper,
                    kind: "builtin",
                    builtin: key as DashboardSettings["wallpaper"]["builtin"],
                    mediaId: null,
                  },
                })
              }
            >
              <img src={item.url} alt="" />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="button-row">
          <button
            disabled={!api}
            onClick={async () => {
              if (!api) return;
              setBusy(true);
              setError("");
              try {
                const asset = await api.chooseWallpaper();
                if (asset)
                  change({
                    ...draft,
                    wallpaper: {
                      ...draft.wallpaper,
                      kind: asset.kind,
                      mediaId: asset.id,
                    },
                  });
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Could not import wallpaper.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="image" size={16} />
            Choose local image or video
          </button>
          <button
            onClick={() =>
              change({
                ...draft,
                wallpaper: structuredClone(DEFAULT_DASHBOARD.wallpaper),
              })
            }
          >
            Reset wallpaper
          </button>
        </div>
        <div className="dashboard-control-grid">
          <label>
            Background sizing
            <select
              value={draft.wallpaper.fit}
              onChange={(e) =>
                change({
                  ...draft,
                  wallpaper: {
                    ...draft.wallpaper,
                    fit: e.target.value === "contain" ? "contain" : "cover",
                  },
                })
              }
            >
              <option value="cover">Fill the canvas</option>
              <option value="contain">Fit the whole image</option>
            </select>
          </label>
          <label>
            Background position
            <select
              value={draft.wallpaper.position}
              onChange={(e) =>
                change({
                  ...draft,
                  wallpaper: {
                    ...draft.wallpaper,
                    position: e.target.value as "top" | "center" | "bottom",
                  },
                })
              }
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          <label>
            Overlay opacity
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={draft.wallpaper.overlay}
              onChange={(e) =>
                change({
                  ...draft,
                  wallpaper: {
                    ...draft.wallpaper,
                    overlay: Number(e.target.value),
                  },
                })
              }
            />
            <output>{Math.round(draft.wallpaper.overlay * 100)}%</output>
          </label>
          <label>
            Background blur
            <input
              type="range"
              min={0}
              max={20}
              value={draft.wallpaper.blur}
              onChange={(e) =>
                change({
                  ...draft,
                  wallpaper: {
                    ...draft.wallpaper,
                    blur: Number(e.target.value),
                  },
                })
              }
            />
            <output>{draft.wallpaper.blur}px</output>
          </label>
          <label>
            Widget opacity
            <input
              type="range"
              min={0.6}
              max={1}
              step={0.05}
              value={draft.widgetOpacity}
              onChange={(e) =>
                change({ ...draft, widgetOpacity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Dashboard text
            <select
              value={draft.text}
              onChange={(e) =>
                change({
                  ...draft,
                  text: e.target.value as DashboardSettings["text"],
                })
              }
            >
              <option value="theme">
                Automatic for built-ins; theme for local media
              </option>
              <option value="light">Light text</option>
              <option value="dark">Dark text</option>
            </select>
          </label>
          <label>
            Content width
            <select
              value={draft.alignment}
              onChange={(e) =>
                change({
                  ...draft,
                  alignment: e.target.value === "wide" ? "wide" : "center",
                })
              }
            >
              <option value="center">Comfortably centered</option>
              <option value="wide">Use available width</option>
            </select>
          </label>
        </div>
        <label className="setting-toggle">
          Subtle background drift (respects reduced motion)
          <input
            type="checkbox"
            checked={draft.wallpaper.effects}
            onChange={(e) =>
              change({
                ...draft,
                wallpaper: { ...draft.wallpaper, effects: e.target.checked },
              })
            }
          />
        </label>
        {draft.wallpaper.kind === "video" && (
          <>
            <label className="setting-toggle">
              Loop video
              <input
                type="checkbox"
                checked={draft.wallpaper.loop}
                onChange={(e) =>
                  change({
                    ...draft,
                    wallpaper: { ...draft.wallpaper, loop: e.target.checked },
                  })
                }
              />
            </label>
            <label className="setting-toggle">
              Show manual sound controls
              <input
                type="checkbox"
                checked={draft.wallpaper.audioControls}
                onChange={(e) =>
                  change({
                    ...draft,
                    wallpaper: {
                      ...draft.wallpaper,
                      audioControls: e.target.checked,
                    },
                  })
                }
              />
            </label>
            <p className="muted-text">
              Video always starts/resumes muted. Hidden/inactive dashboards
              pause playback.
            </p>
          </>
        )}
      </fieldset>
      <fieldset disabled={busy || !ready}>
        <legend>Widgets · 12-column collision-safe layout</legend>
        <div className="widget-editor-list">
          {draft.widgets.map((widget) => (
            <button
              aria-pressed={selected === widget.id}
              key={widget.id}
              onClick={() => setSelected(widget.id)}
            >
              {WIDGET_DEFINITIONS[widget.kind].title}
              {!widget.visible && " · hidden"}
            </button>
          ))}
        </div>
        <div className="button-row">
          <select
            aria-label="Widget to add"
            value={kind}
            onChange={(e) => setKind(e.target.value as WidgetKind)}
          >
            {Object.entries(WIDGET_DEFINITIONS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.title}
              </option>
            ))}
          </select>
          <button
            disabled={draft.widgets.length >= 20}
            onClick={() => {
              const widget = createWidget(
                kind,
                `widget_${crypto.randomUUID()}`,
              );
              change({
                ...draft,
                widgets: arrangeWidgets([...draft.widgets, widget]),
              });
              setSelected(widget.id);
            }}
          >
            Add widget
          </button>
          <button
            onClick={() => {
              change({
                ...draft,
                widgets: structuredClone(DEFAULT_DASHBOARD.widgets),
              });
              setSelected(DEFAULT_DASHBOARD.widgets[0].id);
            }}
          >
            Reset widget layout
          </button>
        </div>
        {current && (
          <div className="widget-settings">
            <h3>{WIDGET_DEFINITIONS[current.kind].title}</h3>
            <p>{WIDGET_DEFINITIONS[current.kind].description}</p>
            <label className="setting-toggle">
              Visible
              <input
                type="checkbox"
                checked={current.visible}
                onChange={(e) =>
                  changeWidget({ ...current, visible: e.target.checked })
                }
              />
            </label>
            <div className="button-row">
              <button
                aria-label="Move widget left"
                disabled={current.x === 0}
                onClick={() => move(-1, 0)}
              >
                <Icon name="back" size={14} />
              </button>
              <button
                aria-label="Move widget right"
                disabled={current.x + current.w === 12}
                onClick={() => move(1, 0)}
              >
                <Icon name="forward" size={14} />
              </button>
              <button
                aria-label="Move widget up"
                disabled={current.y === 0}
                onClick={() => move(0, -1)}
              >
                <Icon name="up" size={14} />
              </button>
              <button
                aria-label="Move widget down"
                disabled={current.y + current.h === 200}
                onClick={() => move(0, 1)}
              >
                <Icon name="down" size={14} />
              </button>
              {WIDGET_DEFINITIONS[current.kind].sizes.length > 1 && (
                <button
                  onClick={() => {
                    const sizes = WIDGET_DEFINITIONS[current.kind].sizes;
                    const index = sizes.findIndex(
                      ([w, h]) => w === current.w && h === current.h,
                    );
                    const size = sizes[(index + 1) % sizes.length];
                    changeWidget({ ...current, w: size[0], h: size[1] });
                  }}
                >
                  Resize widget
                </button>
              )}
              <button
                onClick={() => {
                  change({
                    ...draft,
                    widgets: draft.widgets.filter((w) => w.id !== current.id),
                  });
                  setSelected(
                    draft.widgets.find((w) => w.id !== current.id)?.id ?? "",
                  );
                }}
              >
                Remove widget
              </button>
            </div>
            <p className="muted-text">
              Column {current.x + 1}, row {current.y + 1} · {current.w} ×{" "}
              {current.h}. Other widgets move aside when needed.
            </p>
            <WidgetSettings widget={current} change={changeWidget} />
          </div>
        )}
      </fieldset>
      <fieldset hidden={mode === "widgets"} disabled={busy || !ready}>
        <legend>Desktop dock</legend>
        <label>
          Dock size
          <select
            value={draft.dock.size}
            onChange={(e) =>
              change({
                ...draft,
                dock: {
                  ...draft.dock,
                  size:
                    e.target.value === "compact" ? "compact" : "comfortable",
                },
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label>
          Dock opacity
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={draft.dock.opacity}
            onChange={(e) =>
              change({
                ...draft,
                dock: { ...draft.dock, opacity: Number(e.target.value) },
              })
            }
          />
        </label>
        <label className="setting-toggle">
          Dock magnification
          <input
            type="checkbox"
            checked={draft.dock.magnify}
            onChange={(e) =>
              change({
                ...draft,
                dock: { ...draft.dock, magnify: e.target.checked },
              })
            }
          />
        </label>
      </fieldset>
      <div className="button-row dashboard-apply">
        <button
          className="primary-button"
          disabled={!api || !ready || busy}
          onClick={() => void apply()}
        >
          {busy ? "Saving…" : "Apply dashboard"}
        </button>
        <button disabled={busy} onClick={cancel}>
          Cancel dashboard changes
        </button>
        <button
          disabled={!api || busy || !ready}
          onClick={async () => {
            if (dirty.current) {
              setError(
                "Apply or cancel your preview before removing unused wallpapers.",
              );
              return;
            }
            try {
              const count = await api?.pruneWallpapers();
              setMessage(
                `${count} unused wallpaper files removed. The active wallpaper was kept.`,
              );
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Could not remove wallpapers.",
              );
            }
          }}
        >
          Remove unused wallpapers
        </button>
      </div>
    </div>
  );
}
