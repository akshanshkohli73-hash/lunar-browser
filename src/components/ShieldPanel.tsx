import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
export default function ShieldPanel({ url }: { url: string }) {
  const { shield, settings, updateSettings, report } = useBrowser();
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    /* Internal page. */
  }
  const allowed = settings.shield.allowlist.includes(hostname);
  const count =
    shield?.lists
      .filter((list) =>
        settings.shield.filterLists.includes(
          list.id as "lunar-core" | "stevenblack",
        ),
      )
      .reduce((sum, list) => sum + list.ruleCount, 0) ?? 0;
  return (
    <div className="shield-panel">
      <header>
        <Icon name="shield" />
        <div>
          <h2>Lunar Shield</h2>
          <p>
            {!settings.shield.enabled
              ? "Filtering is off"
              : count > 0
                ? `${count.toLocaleString()} network rules available`
                : "No rules available"}
          </p>
        </div>
      </header>
      <label className="setting-toggle">
        <span>Block matching ads & trackers</span>
        <input
          type="checkbox"
          checked={settings.shield.enabled}
          onChange={(event) =>
            void updateSettings({
              shield: { ...settings.shield, enabled: event.target.checked },
            }).catch(report)
          }
        />
      </label>
      <dl>
        <div>
          <dt>Requests blocked this session</dt>
          <dd>{shield?.stats.totalBlocked ?? 0}</dd>
        </div>
        <div>
          <dt>Ads</dt>
          <dd>{shield?.stats.adsBlocked ?? 0}</dd>
        </div>
        <div>
          <dt>Trackers</dt>
          <dd>{shield?.stats.trackersBlocked ?? 0}</dd>
        </div>
        <div>
          <dt>Script popups denied</dt>
          <dd>{shield?.stats.popupsBlocked ?? 0}</dd>
        </div>
      </dl>
      {hostname && (
        <button
          onClick={() =>
            void updateSettings({
              shield: {
                ...settings.shield,
                allowlist: allowed
                  ? settings.shield.allowlist.filter(
                      (host) => host !== hostname,
                    )
                  : [...settings.shield.allowlist, hostname],
              },
            }).catch(report)
          }
        >
          {allowed ? "Resume filtering on" : "Pause filtering on"} {hostname}
        </button>
      )}
      <p className="muted-text">
        Network filtering only. It does not block every ad or guarantee video ad
        removal. Reload a page after changing its policy.
      </p>
    </div>
  );
}
