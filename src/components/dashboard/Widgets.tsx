import { useEffect, useState } from "react";
import type {
  DashboardWidget,
  WeatherReading,
  WidgetKind,
} from "../../../shared/dashboard";
import type { HistoryItem } from "../../../shared/schemas";
import { useHistoryRevision } from "../useHistoryRevision";
import { useBrowser } from "../../state/BrowserContext";
import { useMinuteClock } from "../useMinuteClock";
import { Icon } from "../ui/Icon";
type WidgetProps = {
  widget: DashboardWidget;
  active: boolean;
  navigate: (url: string) => void;
};
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function ClockWidget({ widget, active }: WidgetProps) {
  const now = useMinuteClock(active);
  if (widget.kind !== "clock") return null;
  return (
    <div className="widget-clock">
      <span className="eyebrow">A little space for you</span>
      <time>
        {now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: !widget.config.hour24,
        })}
      </time>
      {widget.config.showDate && (
        <p>
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      )}
    </div>
  );
}
function SearchWidget({ widget, navigate }: WidgetProps) {
  const [query, setQuery] = useState("");
  const { api } = useBrowser();
  if (widget.kind !== "search") return null;
  return (
    <div className="widget-search">
      <h1>Make room for curiosity.</h1>
      <form
        className="new-tab-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) navigate(query);
        }}
      >
        <Icon name="search" />
        <input
          aria-label="Search the web"
          placeholder={widget.config.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!api}
        />
        <button
          className="icon-button"
          aria-label="Search"
          disabled={!api || !query.trim()}
        >
          <Icon name="forward" />
        </button>
      </form>
    </div>
  );
}
function BookmarksWidget({ widget, navigate }: WidgetProps) {
  const { bookmarks, api } = useBrowser();
  if (widget.kind !== "bookmarks") return null;
  const visible = bookmarks
    .filter((b) => !widget.config.folder || b.folder === widget.config.folder)
    .slice(0, widget.config.limit);
  return (
    <>
      <h2>
        <Icon name="star" size={16} />
        Your little library
      </h2>
      <div className="widget-link-list">
        {visible.map((bookmark) => (
          <button
            disabled={!api}
            key={bookmark.id}
            onClick={() => navigate(bookmark.url)}
            title={bookmark.url}
          >
            <Icon name="book" size={15} />
            <span>{bookmark.title}</span>
          </button>
        ))}
      </div>
      {!visible.length && (
        <p className="muted-text">
          Save pages with the star in the address bar. They’ll appear here.
        </p>
      )}
      <button
        className="text-button"
        disabled={!api}
        onClick={() => navigate("lunar://bookmarks")}
      >
        Open bookmarks <Icon name="forward" size={13} />
      </button>
    </>
  );
}
function NotesWidget({ widget }: WidgetProps) {
  const { dashboard, updateDashboard, api, ready } = useBrowser();
  const [note, setNote] = useState(dashboard.note),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setNote(dashboard.note);
  }, [dashboard.note]);
  return (
    <>
      <h2>
        <Icon name="edit" size={16} />
        {widget.kind === "notes" ? widget.config.title : "A little note"}
      </h2>
      <textarea
        className="widget-note"
        aria-label="Dashboard note"
        maxLength={20000}
        value={note}
        placeholder="Something worth keeping…"
        onChange={(event) => {
          setNote(event.target.value);
          setStatus("Unsaved changes");
        }}
      />
      <div className="widget-footer">
        <small role="status">
          {status || "Shared dashboard note · stored only in this profile"}
        </small>
        <button
          disabled={!api || !ready || busy || note === dashboard.note}
          onClick={async () => {
            setBusy(true);
            try {
              await updateDashboard({ note });
              setStatus("Saved locally");
            } catch (error) {
              setStatus(
                error instanceof Error
                  ? error.message
                  : "Could not save. Copy your note to keep it.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Save note
        </button>
      </div>
    </>
  );
}
function CalendarWidget({ widget }: WidgetProps) {
  const { dashboard, api, ready, updateDashboard, report } = useBrowser();
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [selected, setSelected] = useState(() => localDate(new Date())),
    [title, setTitle] = useState("");
  if (widget.kind !== "calendar") return null;
  const monday = widget.config.mondayFirst,
    first = (month.getDay() + (monday ? 6 : 0)) % 7,
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const labels = monday
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];
  const events = dashboard.events.filter((item) => item.date === selected);
  return (
    <>
      <div className="widget-footer">
        <h2>
          <Icon name="calendar" size={16} />
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div>
          <button
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <Icon name="back" size={13} />
          </button>
          <button
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <Icon name="forward" size={13} />
          </button>
        </div>
      </div>
      <div className="calendar-days">
        {labels.map((day, i) => (
          <small key={i}>{day}</small>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`empty${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1,
            date = localDate(
              new Date(month.getFullYear(), month.getMonth(), day),
            );
          return (
            <button
              key={date}
              aria-label={date}
              aria-pressed={selected === date}
              className={
                dashboard.events.some((item) => item.date === date)
                  ? "has-event"
                  : ""
              }
              onClick={() => setSelected(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <small>{selected} · Local events only</small>
      <ul className="widget-events">
        {events.map((event) => (
          <li key={event.id}>
            <span>{event.title}</span>
            <button
              aria-label={`Delete event ${event.title}`}
              disabled={!api || !ready}
              onClick={() =>
                void updateDashboard({
                  events: dashboard.events.filter(
                    (item) => item.id !== event.id,
                  ),
                }).catch(report)
              }
            >
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="widget-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim())
            void updateDashboard({
              events: [
                ...dashboard.events,
                {
                  id: `event_${crypto.randomUUID()}`,
                  date: selected,
                  title: title.trim(),
                },
              ],
            })
              .then(() => setTitle(""))
              .catch(report);
        }}
      >
        <input
          aria-label="Local event title"
          maxLength={120}
          value={title}
          placeholder="Add an event"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          disabled={
            !api || !ready || !title.trim() || dashboard.events.length >= 200
          }
          aria-label="Save local event"
        >
          <Icon name="plus" size={16} />
        </button>
      </form>
    </>
  );
}
function WeatherWidget({ widget }: WidgetProps) {
  const { api } = useBrowser();
  const [reading, setReading] = useState<WeatherReading | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setReading(null);
    setError("");
  }, [widget.config]);
  if (widget.kind !== "weather") return null;
  const config = widget.config;
  return (
    <>
      <h2>
        <Icon name="sun" size={17} />
        {config.location || "Weather"}
      </h2>
      {reading ? (
        <>
          <strong className="widget-temperature">
            {Math.round(reading.temperature)}°
            {reading.units === "celsius" ? "C" : "F"}
          </strong>
          <p>
            {reading.code === 0
              ? "Clear sky"
              : reading.code <= 3
                ? "Partly cloudy"
                : reading.code < 50
                  ? "Fog / reduced visibility"
                  : reading.code < 80
                    ? "Precipitation"
                    : "Showers / storms"}
          </p>
          <small>Provider observation: {reading.observedAt}</small>
        </>
      ) : (
        <p className="muted-text">
          Configure a location and allow Open-Meteo in this widget’s settings.
          Location is sent only when you press Update.
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button
        disabled={!api || busy || !config.consent}
        onClick={async () => {
          if (!api || !config.consent) return;
          setBusy(true);
          setError("");
          try {
            setReading(
              await api.getWeather({
                latitude: config.latitude,
                longitude: config.longitude,
                units: config.units,
                consent: true,
              }),
            );
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Weather unavailable",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Requesting…" : "Update weather"}
      </button>
      <small className="widget-attribution">
        Weather: Open-Meteo · CC BY 4.0 · public API for eligible non-commercial
        use. No automatic geolocation.
      </small>
    </>
  );
}
function RecentWidget({ widget, active, navigate }: WidgetProps) {
  const { api, settings } = useBrowser();
  const historyRevision = useHistoryRevision();
  const [items, setItems] = useState<HistoryItem[]>([]),
    [error, setError] = useState("");
  const enabled =
    widget.kind === "recent" && widget.config.enabled && settings.recordHistory;
  const load = () => {
    if (api && enabled)
      void api
        .getHistory()
        .then(setItems)
        .catch(() => setError("Could not load local history."));
  };
  useEffect(() => {
    let live = true;
    if (api && enabled && active)
      void api
        .getHistory()
        .then((data) => {
          if (live) setItems(data);
        })
        .catch(() => {
          if (live) setError("Could not load local history.");
        });
    else setItems([]);
    return () => {
      live = false;
    };
  }, [api, enabled, active, historyRevision]);
  if (widget.kind !== "recent") return null;
  const unique = items
    .filter(
      (item, i) => items.findIndex((other) => other.url === item.url) === i,
    )
    .slice(0, widget.config.limit);
  return (
    <>
      <h2>
        <Icon name="history" size={16} />
        Recently visited
      </h2>
      {!enabled ? (
        <p className="muted-text">
          Private by default. Allow this widget to show history in Customize,
          and enable history recording in Preferences.
        </p>
      ) : (
        <>
          <div className="widget-link-list">
            {unique.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.url)}
                title={item.url}
              >
                <Icon name="globe" size={14} />
                <span>{item.title || new URL(item.url).hostname}</span>
              </button>
            ))}
          </div>
          {!unique.length && <p className="muted-text">No saved visits yet.</p>}
          <button className="text-button" onClick={load}>
            Refresh local history
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function ShortcutsWidget({ widget, navigate }: WidgetProps) {
  const { api } = useBrowser();
  if (widget.kind !== "shortcuts") return null;
  return (
    <>
      <h2>
        <Icon name="globe" size={16} />
        Your destinations
      </h2>
      <div className="shortcut-links">
        {widget.config.links.map((link, i) => (
          <button
            disabled={!api}
            key={i}
            title={link.url}
            onClick={() => navigate(link.url)}
          >
            <Icon name="globe" size={22} />
            <span>{link.title}</span>
          </button>
        ))}
      </div>
      {!widget.config.links.length && (
        <p className="muted-text">
          Add your own links in this widget’s settings.
        </p>
      )}
    </>
  );
}
const timers = new Map<
  string,
  { remaining: number; deadline: number | null }
>();
function FocusWidget({ widget, active }: WidgetProps) {
  const minutes = widget.kind === "focus" ? widget.config.minutes : 25;
  const [state, setState] = useState(
    () => timers.get(widget.id) ?? { remaining: minutes * 60, deadline: null },
  );
  useEffect(() => {
    timers.set(widget.id, state);
  }, [widget.id, state]);
  useEffect(() => {
    if (!state.deadline || !active) return;
    const tick = () =>
      setState((current) => {
        const remaining = Math.max(
          0,
          Math.ceil(((current.deadline ?? Date.now()) - Date.now()) / 1000),
        );
        return { remaining, deadline: remaining ? current.deadline : null };
      });
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.deadline, active]);
  return (
    <>
      <h2>
        <Icon name="clock" size={16} />
        One thing at a time
      </h2>
      <time className="widget-countdown">
        {Math.floor(state.remaining / 60)}:
        {String(state.remaining % 60).padStart(2, "0")}
      </time>
      <div className="button-row">
        <button
          onClick={() =>
            setState((current) => ({
              ...current,
              deadline: current.deadline
                ? null
                : Date.now() + Math.max(1, current.remaining) * 1000,
            }))
          }
        >
          {state.deadline ? "Pause timer" : "Start timer"}
        </button>
        <button
          onClick={() => setState({ remaining: minutes * 60, deadline: null })}
        >
          Reset timer
        </button>
      </div>
      <small>Local app-session timer. No alarm or provider.</small>
    </>
  );
}
export const WIDGET_COMPONENTS: Record<
  WidgetKind,
  (props: WidgetProps) => React.JSX.Element | null
> = {
  clock: ClockWidget,
  search: SearchWidget,
  bookmarks: BookmarksWidget,
  weather: WeatherWidget,
  calendar: CalendarWidget,
  notes: NotesWidget,
  recent: RecentWidget,
  shortcuts: ShortcutsWidget,
  focus: FocusWidget,
};
