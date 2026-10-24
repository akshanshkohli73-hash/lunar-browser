import type { LunarAPI } from "../../../shared/api";
import { Icon } from "../ui/Icon";
export function DesktopMenuBar({
  desktopVisible,
  onToggleDesktop,
  onBrowser,
  onUtility,
  now,
}: {
  desktopVisible: boolean;
  onToggleDesktop: () => void;
  onBrowser: () => void;
  onUtility: (kind: string) => void;
  now: Date;
}) {
  const control = (name: "minimize" | "maximize" | "close") => {
    const api: LunarAPI | undefined = window.lunarAPI;
    if (api)
      void api[name]().catch(() =>
        window.dispatchEvent(
          new CustomEvent("lunar:app-error", {
            detail: "The window operation could not be completed.",
          }),
        ),
      );
  };
  return (
    <header className="desktop-menu" aria-label="Lunar desktop menu">
      <button onClick={onBrowser} className="desktop-brand">
        <Icon name="moon" size={15} /> Lunar Browser
      </button>
      <button onClick={onToggleDesktop} aria-pressed={desktopVisible}>
        <Icon name="desktop" size={14} />
        {desktopVisible ? "Return to browser" : "Show desktop"}
      </button>
      <button onClick={() => onUtility("finder")}>Finder</button>
      <button onClick={() => onUtility("themestudio")}>Theme Studio</button>
      <span className="desktop-menu-space" />
      <time>
        {now.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}{" "}
        · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
      <button
        disabled={!window.lunarAPI}
        aria-label="Minimize application"
        onClick={() => control("minimize")}
      >
        <Icon name="minimize" size={14} />
      </button>
      <button
        disabled={!window.lunarAPI}
        aria-label="Maximize or restore application"
        onClick={() => control("maximize")}
      >
        <Icon name="maximize" size={12} />
      </button>
      <button
        disabled={!window.lunarAPI}
        aria-label="Close application"
        onClick={() => control("close")}
      >
        <Icon name="x" size={14} />
      </button>
    </header>
  );
}
