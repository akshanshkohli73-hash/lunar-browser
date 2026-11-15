import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
import { useShield } from "./shield/useShield";
import {
  Feedback,
  Metric,
  RequestActivity,
  SitePolicyControls,
  Toggle,
} from "./shield/ShieldDetails";
import { youtubeHost } from "../../shared/shield";

/** Compact toolbar surface. The full editor lives at the existing lunar://shield route. */
export default function ShieldPanel({
  url,
  onDashboard,
}: {
  url: string;
  onDashboard?: () => void;
}) {
  const { settings, updateSettings, openPage, report } = useBrowser();
  const view = useShield(url),
    counts = view.site?.counters;
  const open = () => {
    onDashboard?.();
    void openPage("shield").catch(report);
  };
  return (
    <div className="shield-compact" aria-busy={view.loading || view.busy}>
      <div className="shield-compact-heading">
        <span className="shield-emblem">
          <Icon name="shield" size={26} />
        </span>
        <div>
          <span className="eyebrow">Lunar Shield 2.0</span>
          <h3>
            {view.site
              ? new URL(view.site.origin).hostname
              : "Your privacy, locally managed"}
          </h3>
          <p>
            {!settings.shield.enabled
              ? "Global protection paused"
              : view.site?.enabled
                ? "Network protection is on"
                : view.site
                  ? "Protection paused on this origin"
                  : "Open a website for exact-site controls"}
          </p>
        </div>
      </div>
      <Feedback view={view} />
      <fieldset
        className="shield-fieldset"
        disabled={!view.api || view.loading || view.busy}
      >
        {view.site ? (
          <>
            <SitePolicyControls view={view} compact />
            {counts && (
              <>
                <dl className="shield-metrics shield-metrics-compact">
                  <Metric label="Ads" value={counts.ads.toLocaleString()} />
                  <Metric
                    label="Trackers"
                    value={counts.trackers.toLocaleString()}
                  />
                  <Metric
                    label="Other"
                    value={(
                      counts.other +
                      counts.custom +
                      counts.malware
                    ).toLocaleString()}
                  />
                </dl>
                <p className="shield-fineprint">
                  Confirmed network blocks · this origin, current app session.
                  Popups ({counts.popups}) and removed cookie headers (
                  {counts.cookies}) are counted separately.
                </p>
              </>
            )}
          </>
        ) : (
          <Toggle
            label="Global protection"
            value={settings.shield.enabled}
            onChange={(enabled) =>
              void view.run(() =>
                updateSettings({ shield: { ...settings.shield, enabled } }),
              )
            }
          />
        )}
        {youtubeHost(url) && view.protection && (
          <div className="shield-youtube-note">
            <Toggle
              label="YouTube privacy profile"
              value={view.protection.youtube.enabled}
              onChange={(enabled) =>
                void view.run(() =>
                  view.api!.youtubeProtection({ type: "set", enabled }),
                )
              }
            />
            <p>
              Conservative third-party network matching. No verified
              video-ad-removal claim.
            </p>
          </div>
        )}
        {view.site && (
          <details className="shield-compact-activity">
            <summary>
              Recent confirmed blocks ({view.site.recent.length})
            </summary>
            <RequestActivity view={view} items={view.site.recent} limit={4} />
          </details>
        )}
      </fieldset>
      {!view.api && (
        <p className="shield-empty">
          Live protection requires the installed desktop application. This
          renderer preview does not intercept website requests.
        </p>
      )}
      <button className="shield-primary-button" onClick={open}>
        <Icon name="shield" size={16} />
        Open privacy dashboard
        <Icon name="forward" size={16} />
      </button>
      <p className="shield-fineprint">
        Network filtering, not anonymity or complete anti-fingerprinting. Data
        stays on this device; list updates contact their publishers.
      </p>
    </div>
  );
}
