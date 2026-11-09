import { useEffect, useState } from "react";
import { useBrowser } from "../state/BrowserContext";
import { Icon } from "./ui/Icon";
import type { SitePrivacy, ShieldState } from "../../electron/types";
import { isWebUrl } from "../../shared/navigation";
export default function ShieldPanel({ url }: { url: string }) {
  const {
    api,
    shield: globalShield,
    settings,
    updateSettings,
    report,
  } = useBrowser();
  const [siteState, setSiteState] = useState<ShieldState | null>(null);
  const shield = siteState ?? globalShield;
  useEffect(() => {
    let live = true;
    setSiteState(null);
    if (api && isWebUrl(url))
      void api
        .getShieldState(url)
        .then((state) => {
          if (live) setSiteState(state);
        })
        .catch(report);
    return () => {
      live = false;
    };
  }, [api, url, globalShield, report]);
  const [privacy, setPrivacy] = useState<SitePrivacy | null>(null),
    [busy, setBusy] = useState(false);
  const hostname = isWebUrl(url) ? new URL(url).hostname : "";
  const canPrompt =
    url.startsWith("https:") ||
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const exclusions = settings.shield.allowlist.filter(
    (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
  );
  const allowed = exclusions.length > 0;
  useEffect(() => {
    let live = true;
    setPrivacy(null);
    if (api && hostname)
      void api
        .getSitePrivacy(url)
        .then((state) => {
          if (live) setPrivacy(state);
        })
        .catch(report);
    return () => {
      live = false;
    };
  }, [api, url, hostname, report]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      if (api && hostname) setPrivacy(await api.getSitePrivacy(url));
    } catch (failure) {
      report(failure);
    } finally {
      setBusy(false);
    }
  };
  const site = shield?.site?.hostname === hostname ? shield.site : null;
  const count =
    shield?.lists
      .filter((list) =>
        settings.shield.filterLists.some((id) => id === list.id),
      )
      .reduce((sum, list) => sum + list.ruleCount, 0) ?? 0;
  return (
    <div className="shield-panel">
      <header>
        <Icon name="shield" />
        <div>
          <h2>{hostname || "Lunar Shield"}</h2>
          <p>
            {!settings.shield.enabled
              ? "Filtering is off"
              : allowed
                ? "Protection paused for this site"
                : `${count.toLocaleString()} network rules available · ${settings.shield.mode}`}
          </p>
        </div>
      </header>
      <label className="setting-toggle">
        <span>Block matching ads & trackers</span>
        <input
          type="checkbox"
          checked={settings.shield.enabled}
          onChange={(e) =>
            void updateSettings({
              shield: { ...settings.shield, enabled: e.target.checked },
            }).catch(report)
          }
        />
      </label>
      <dl>
        <div>
          <dt>Blocked on this hostname this session</dt>
          <dd>{site?.blocked ?? 0}</dd>
        </div>
        <div>
          <dt>Requests / popups blocked across all tabs</dt>
          <dd>{shield?.stats.totalBlocked ?? 0}</dd>
        </div>
        <div>
          <dt>Third-party cookie headers removed here</dt>
          <dd>{site?.cookies ?? 0}</dd>
        </div>
        <div>
          <dt>HTTPS upgrades requested here</dt>
          <dd>{site?.upgrades ?? 0}</dd>
        </div>
        <div>
          <dt>Script popups denied across all tabs</dt>
          <dd>{shield?.stats.popupsBlocked ?? 0}</dd>
        </div>
      </dl>
      {hostname && (
        <>
          <button
            disabled={busy}
            onClick={() =>
              void updateSettings({
                shield: {
                  ...settings.shield,
                  allowlist: allowed
                    ? settings.shield.allowlist.filter(
                        (entry) => !exclusions.includes(entry),
                      )
                    : [...settings.shield.allowlist, hostname],
                },
              }).catch(report)
            }
          >
            {allowed ? "Resume protection on" : "Pause protection on"}{" "}
            {hostname}
          </button>
          {allowed && (
            <small>
              Resuming removes matching parent-host allowlist entries too:{" "}
              {exclusions.join(", ")}.
            </small>
          )}
          <h3>Site data & permissions</h3>
          <p>
            {privacy
              ? `${privacy.cookies} cookies visible to this URL. Cookie values never leave the main process.`
              : "Reading this site's local state…"}
          </p>
          <div className="button-row">
            <button
              disabled={!api || busy}
              onClick={() => void run(() => api!.clearOriginData(url))}
            >
              Clear this site’s data…
            </button>
            <button
              disabled={!api || busy}
              onClick={() => void run(() => api!.resetSitePermissions(url))}
            >
              Reset this site’s permissions
            </button>
          </div>
          <p className="muted-text">
            Clearing removes this origin's storage/cache and Chromium's shared
            registrable-domain cookies. Related subdomains can also be signed
            out. Permission resets never grant access; reload to stop
            already-running scripts or capture.
          </p>
          {[
            ["media:video", "Camera"],
            ["media:audio", "Microphone"],
            ["geolocation", "Precise location"],
            ["geolocation-approximate", "Approximate location"],
            ["notifications", "Notifications"],
            ["clipboard-read", "Clipboard read"],
          ].map(([permission, title]) => (
            <label className="setting-toggle" key={permission}>
              <span>
                {title}
                <small>
                  {!canPrompt
                    ? "Denied on insecure origins"
                    : privacy?.grants.includes(permission)
                      ? "Allowed for this session"
                      : privacy?.denials.includes(permission)
                        ? "Denied for this session"
                        : "Ask through native prompt"}
                </small>
              </span>
              <button
                disabled={!api || busy || !canPrompt}
                onClick={() =>
                  void run(() =>
                    api!.denySitePermission(
                      url,
                      permission as Parameters<
                        NonNullable<typeof api>["denySitePermission"]
                      >[1],
                      !privacy?.denials.includes(permission),
                    ),
                  )
                }
              >
                {privacy?.denials.includes(permission) ? "Ask again" : "Deny"}
              </button>
            </label>
          ))}
        </>
      )}
      <h3>Recent network decisions for this hostname</h3>
      {site?.recent.length ? (
        <ul className="shield-diagnostics">
          {site.recent.map((item, i) => (
            <li key={i}>
              <strong>{item.hostname}</strong>
              <small>
                {item.resourceType} · {item.category} · {item.source}
              </small>
              <code>{item.rule}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">
          No blocked network requests recorded here. This is not a guarantee
          that the page has no trackers.
        </p>
      )}
      <p className="muted-text">
        Network filtering only, not Brave parity, anonymity or
        anti-fingerprinting. Third-party Cookie/Set-Cookie header filtering is
        not full storage partitioning. No cosmetic/scriptlet injection. Reload
        after policy changes; resetting a grant does not stop an already active
        capture.
      </p>
    </div>
  );
}
