import { useCallback, useEffect, useState, type ComponentType } from "react";
import { CoquetteFrame } from "./CoquetteDesktopPortfolio";
import { DesktopMenuBar, type MenuName } from "./DesktopMenuBar";
import { CONTROL_PANELS } from "../state/control-center";
import { useBrowser } from "../state/BrowserContext";
import { useMinuteClock } from "./useMinuteClock";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { WALLPAPERS } from "./dashboard/Wallpaper";

export default function LunarDesktop({
  browserComponent: Browser,
}: {
  browserComponent: ComponentType<{
    isVisible?: boolean;
    isOccluded?: boolean;
  }>;
}) {
  const { theme, ready, api, openPage, tabs, previewPage, report } =
    useBrowser();
  const [desktop, setDesktop] = useState(false),
    [menu, setMenu] = useState<MenuName | null>(null),
    [launcher, setLauncher] = useState(false),
    [query, setQuery] = useState("");
  const now = useMinuteClock(true);
  const activate = useCallback(() => {
    setDesktop(false);
    setMenu(null);
    setLauncher(false);
  }, []);
  useEffect(() => {
    const launch = () => {
      setMenu(null);
      setLauncher((current) => !current);
    };
    window.addEventListener("lunar:activate-browser", activate);
    window.addEventListener("lunar:spotlight", launch);
    return () => {
      window.removeEventListener("lunar:activate-browser", activate);
      window.removeEventListener("lunar:spotlight", launch);
    };
  }, [activate]);
  const page = api
    ? tabs.tabs.find((tab) => tab.id === tabs.activeTabId)?.url.slice(8)
    : previewPage;
  const choose = (item: (typeof CONTROL_PANELS)[number]) => {
    void openPage(item.page).catch(report);
  };
  const visible = CONTROL_PANELS.filter((item) =>
    `${item.label} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <CoquetteFrame
      accent={theme.colors.secondary}
      deep={theme.colors.primary}
      desktopVisible={desktop}
    >
      <DesktopMenuBar
        open={menu}
        onOpen={setMenu}
        desktopVisible={desktop}
        onToggleDesktop={() => {
          setMenu(null);
          setDesktop((value) => !value);
        }}
        onLauncher={() => {
          setMenu(null);
          setQuery("");
          setLauncher(true);
        }}
        now={now}
      />
      <div className="cdp-browser-workspace" hidden={desktop}>
        <Browser isVisible={!desktop} isOccluded={!!menu || launcher} />
      </div>
      {desktop && (
        <section
          className="lunar-desktop-sheet"
          aria-label="Lunar desktop controls"
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu("View");
          }}
        >
          <img
            className="lunar-desktop-art"
            src={WALLPAPERS.meadow.url}
            alt=""
          />
          <header>
            <span className="eyebrow">A little space to explore</span>
            <h1>Your browser. Your orbit.</h1>
            <p>Everything Lunar, in one workspace.</p>
          </header>
          <div className="lunar-desktop-shortcuts">
            {CONTROL_PANELS.map((item) => (
              <button
                key={item.id}
                disabled={!ready}
                aria-label={`Open ${item.label}`}
                title={item.description}
                onClick={() => choose(item)}
              >
                <span>
                  <Icon name={item.icon} size={29} />
                </span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <nav className="cdp-dock lunar-dock" aria-label="Dock">
        {CONTROL_PANELS.map((item) => (
          <button
            key={item.id}
            className={`cdp-dock-btn lunar-dock-button${!desktop && page === item.page ? " is-active" : ""}`}
            aria-label={item.label}
            aria-pressed={!desktop && page === item.page}
            title={item.description}
            disabled={!ready}
            onClick={() => choose(item)}
          >
            <span className="cdp-tip">{item.label}</span>
            <span className="lunar-dock-art">
              <Icon name={item.icon} size={24} />
            </span>
            {!desktop && page === item.page && <i className="cdp-run" />}
          </button>
        ))}
      </nav>
      {launcher && (
        <Modal title="Lunar controls" onClose={() => setLauncher(false)}>
          <input
            aria-label="Find a Lunar control"
            placeholder="Where would you like to go?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && visible[0]) choose(visible[0]);
            }}
          />
          <div className="lunar-launcher">
            {visible.map((item) => (
              <button
                key={item.id}
                disabled={!ready}
                onClick={() => choose(item)}
              >
                <Icon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>
          {!visible.length && <p>No matching controls.</p>}
        </Modal>
      )}
    </CoquetteFrame>
  );
}
