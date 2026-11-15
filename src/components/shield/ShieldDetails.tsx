import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SitePrivacy } from "../../../electron/types";
import {
  PERMISSION_LABELS,
  permissionKeySchema,
  resourceTypeSchema,
  type ProtectionCounters,
  type ProtectionDiagnostic,
  type PermissionMode,
} from "../../../shared/shield";
import { useBrowser } from "../../state/BrowserContext";
import type { ShieldView } from "./useShield";
export type Period = "today" | "week" | "month" | "all";
export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <label className="shield-period">
      Period{" "}
      <select
        aria-label="Statistics period"
        value={value}
        onChange={(event) => onChange(event.target.value as Period)}
      >
        <option value="today">Today · UTC</option>
        <option value="week">Last 7 days</option>
        <option value="month">Last 30 days</option>
        <option value="all">All time</option>
      </select>
    </label>
  );
}
export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="shield-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function NetworkMetrics({ counts }: { counts: ProtectionCounters }) {
  return (
    <dl className="shield-metrics">
      <Metric
        label="Evaluated requests"
        value={counts.evaluated.toLocaleString()}
      />
      <Metric
        label="Confirmed blocked"
        value={counts.blocked.toLocaleString()}
      />
      <Metric
        label="Allowed by Shield"
        value={counts.allowed.toLocaleString()}
      />
      <Metric
        label="Third-party blocks"
        value={counts.thirdPartyBlocked.toLocaleString()}
      />
    </dl>
  );
}
export function Feedback({ view }: { view: ShieldView }) {
  return (
    <>
      {view.loading && <p role="status">Reading local protection state…</p>}
      {view.busy && <p role="status">Applying your change…</p>}
      {view.error && (
        <p className="shield-error" role="alert">
          {view.error}
        </p>
      )}
      {view.message && (
        <p className="shield-notice" role="status">
          {view.message}
        </p>
      )}
      {view.protection?.persistenceError && (
        <p role="alert" className="shield-error">
          {view.protection.persistenceError}
        </p>
      )}
      {view.protection?.statistics.persistenceError && (
        <p role="alert" className="shield-error">
          {view.protection.statistics.persistenceError} Unsaved counters may not
          survive a restart.
        </p>
      )}
    </>
  );
}
export function Toggle({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="shield-switch">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
export function SitePolicyControls({
  view,
  compact = false,
}: {
  view: ShieldView;
  compact?: boolean;
}) {
  const { settings, updateSettings } = useBrowser();
  const site = view.site,
    origin = site?.origin || "";
  const legacy =
    !!origin && settings.shield.allowlist.includes(new URL(origin).hostname);
  if (!site || !origin)
    return (
      <p className="shield-empty">
        Open a website, or select an exact origin, to manage its policy.
        Internal Lunar pages do not contain website requests.
      </p>
    );
  const save = (
    patch: Parameters<NonNullable<typeof view.api>["setShieldSite"]>[1],
  ) => void view.run(() => view.api!.setShieldSite(origin, patch));
  return (
    <div className="shield-site-controls">
      <p className="shield-origin">
        <span className="eyebrow">Exact website origin</span>
        <strong>{origin}</strong>
      </p>
      <Toggle
        label="Protect this website"
        hint="Only this scheme, hostname and port. Other sites and subdomains keep their own policy."
        value={site.enabled}
        disabled={
          !view.api ||
          view.busy ||
          view.loading ||
          !settings.shield.enabled ||
          legacy
        }
        onChange={(enabled) => save({ enabled })}
      />
      {!settings.shield.enabled && (
        <p className="shield-notice">
          Global protection is off. Enable it in Overview or Advanced before
          resuming a site.
        </p>
      )}
      {legacy && (
        <div className="shield-notice">
          <p>
            A legacy exact-host exception pauses protection here. Removing it
            affects both HTTP and HTTPS on this hostname, not its subdomains.
          </p>
          <button
            onClick={() =>
              void view.run(() =>
                updateSettings({
                  shield: {
                    ...settings.shield,
                    allowlist: settings.shield.allowlist.filter(
                      (host) => host !== new URL(origin).hostname,
                    ),
                  },
                }),
              )
            }
          >
            Remove legacy host exception
          </button>
        </div>
      )}
      {!compact && (
        <>
          <Toggle
            label="Ad-list matching on this site"
            hint="Overrides the global ad category, while the master switch remains authoritative."
            value={site.override?.ads ?? settings.shield.ads}
            onChange={(ads) => save({ ads })}
          />
          <Toggle
            label="Tracker-list matching on this site"
            value={site.override?.trackers ?? settings.shield.trackers}
            onChange={(trackers) => save({ trackers })}
          />
          <Toggle
            label="Third-party cookie headers on this site"
            hint="When enabled, removes third-party Cookie/Set-Cookie headers. YouTube player/authentication endpoints have a compatibility exception; this is not storage partitioning."
            value={
              site.override?.blockThirdPartyCookies ??
              settings.shield.blockThirdPartyCookies
            }
            onChange={(blockThirdPartyCookies) =>
              save({ blockThirdPartyCookies })
            }
          />
          <label className="shield-switch">
            <span>Site matching mode</span>
            <select
              aria-label="Site matching mode"
              value={site.override?.mode ?? settings.shield.mode}
              onChange={(event) =>
                save({
                  mode: event.target.value === "strict" ? "strict" : "balanced",
                })
              }
            >
              <option value="balanced">Balanced · third-party</option>
              <option value="strict">Strict · first + third party</option>
            </select>
          </label>
        </>
      )}
      <button onClick={() => save(null)} disabled={!site.override || view.busy}>
        Reset this site’s overrides
      </button>
      {!!site.override?.allowedRequests?.length && (
        <details>
          <summary>
            {site.override.allowedRequests.length} targeted request allowances
          </summary>
          <ul className="shield-allowances">
            {site.override.allowedRequests.map((allow) => (
              <li key={`${allow.hostname}|${allow.resourceType}`}>
                <code>
                  {allow.hostname} · {allow.resourceType}
                </code>
                <button
                  aria-label={`Remove allowance for ${allow.hostname} ${allow.resourceType}`}
                  onClick={() =>
                    save({
                      allowedRequests: site.override!.allowedRequests!.filter(
                        (item) =>
                          item.hostname !== allow.hostname ||
                          item.resourceType !== allow.resourceType,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
export function RequestActivity({
  items,
  view,
  limit = 20,
  allow = true,
}: {
  items: ProtectionDiagnostic[];
  view: ShieldView;
  limit?: number;
  allow?: boolean;
}) {
  if (!items.length)
    return (
      <p className="shield-empty">
        No confirmed network blocks recorded in this in-memory activity window.
        This is not proof that a site contains no advertising or tracking.
      </p>
    );
  return (
    <ul className="shield-activity">
      {items.slice(0, limit).map((item) => (
        <li key={item.id}>
          <details>
            <summary>
              <strong>{item.hostname}</strong>
              <span>
                {item.category === "ads"
                  ? "Advertising-related"
                  : item.category === "malware"
                    ? "Threat-list match"
                    : item.category}{" "}
                · {item.resourceType}
              </span>
            </summary>
            <p>
              Initiating top-level site: <code>{item.site}</code>
              <br />
              {item.thirdParty ? "Third-party" : "Same registrable site"}{" "}
              relative to that site · {new Date(item.time).toLocaleTimeString()}
            </p>
            <p>
              Source: <strong>{item.source}</strong>
            </p>
            <code className="shield-rule">{item.rule}</code>
            {item.youtube && (
              <p>
                Network cancellation only — not an independently verified
                removed YouTube advertisement.
              </p>
            )}
            {allow &&
              view.site?.origin === item.site &&
              resourceTypeSchema.safeParse(item.resourceType).success && (
                <button
                  disabled={view.busy}
                  onClick={() =>
                    void view.run(() => {
                      const existing =
                        view.site?.override?.allowedRequests || [];
                      const entry = {
                        hostname: item.hostname,
                        resourceType: resourceTypeSchema.parse(
                          item.resourceType,
                        ),
                      };
                      return view.api!.setShieldSite(item.site, {
                        allowedRequests: [
                          ...existing.filter(
                            (allow) =>
                              allow.hostname !== entry.hostname ||
                              allow.resourceType !== entry.resourceType,
                          ),
                          entry,
                        ],
                      });
                    }, "Exact request host/resource allowed only on this website. Reload to retry.")
                  }
                >
                  Allow this host/resource here
                </button>
              )}
          </details>
        </li>
      ))}
    </ul>
  );
}
export function PermissionControls({ view }: { view: ShieldView }) {
  const origin = view.site?.origin || "";
  const [status, setStatus] = useState<SitePrivacy | null>(null),
    [error, setError] = useState("");
  const policies =
    view.protection?.config.permissions.filter(
      (entry) => entry.origin === origin,
    ) || [];
  const signature = JSON.stringify(policies);
  const lifecycle = useRef({ live: true, origin, issued: 0, accepted: 0 });
  lifecycle.current.origin = origin;
  useEffect(() => {
    lifecycle.current.live = true;
    return () => {
      lifecycle.current.live = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (!view.api || !origin) return;
    const issued = ++lifecycle.current.issued;
    const current = () =>
      lifecycle.current.live &&
      lifecycle.current.origin === origin &&
      issued > lifecycle.current.accepted;
    try {
      const next = await view.api.getSitePrivacy(origin);
      if (current()) {
        lifecycle.current.accepted = issued;
        setStatus(next);
        setError("");
      }
    } catch (error) {
      if (current())
        setError(
          error instanceof Error
            ? error.message
            : "Permission state unavailable.",
        );
    }
  }, [view.api, origin]);
  useEffect(() => {
    setStatus(null);
    setError("");
    void load();
  }, [load, signature]);
  if (!origin)
    return (
      <p className="shield-empty">
        Select a website origin above to manage supported permissions.
      </p>
    );
  const canPrompt =
    origin.startsWith("https:") ||
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  return (
    <div>
      <p className="shield-origin">
        <strong>{origin}</strong>
      </p>
      {error && <p role="alert">{error}</p>}
      <p>
        Ask is the default. Persistent Allow requires an origin-labelled native
        confirmation. Sensitive access is denied for cross-origin frames,
        background/hidden pages and insecure public origins. The operating
        system may require additional consent.
      </p>
      {permissionKeySchema.options.map((permission) => (
        <label className="shield-switch" key={permission}>
          <span>
            <strong>{PERMISSION_LABELS[permission]}</strong>
            <small>
              {!canPrompt
                ? "Denied on insecure origins"
                : status?.grants.includes(permission)
                  ? "Currently allowed for this origin"
                  : status?.denials.includes(permission)
                    ? "Currently blocked for this origin"
                    : "No active grant; native prompt required"}
            </small>
          </span>
          <select
            aria-label={`${PERMISSION_LABELS[permission]} permission`}
            disabled={!canPrompt}
            value={
              policies.find((entry) => entry.permission === permission)?.mode ||
              "ask"
            }
            onChange={(event) =>
              void view
                .run(() =>
                  view.api!.setSitePermission(
                    origin,
                    permission,
                    event.target.value as PermissionMode,
                  ),
                )
                .then(() => load())
            }
          >
            <option value="ask">Ask</option>
            <option value="allow">Allow…</option>
            <option value="block">Block</option>
          </select>
        </label>
      ))}
      <div className="button-row">
        <button
          onClick={() =>
            void view
              .run(
                () => view.api!.resetSitePermissions(origin),
                "This origin's permissions restored to Ask. Reload or close pages to stop already-active capture.",
              )
              .then(() => load())
          }
        >
          Restore this origin to Ask
        </button>
        <button
          onClick={() =>
            void view
              .run(
                () => view.api!.resetPermissions(),
                "All permission policies and session grants restored to Ask. Existing capture may require a page reload.",
              )
              .then(() => load())
          }
        >
          Reset all website permissions
        </button>
      </div>
      <p className="shield-fineprint">
        Permission changes do not terminate a stream or script already running.
        Reload or close the affected tab. Screen capture, USB, Bluetooth, serial
        and unknown permissions remain unsupported and denied.
      </p>
    </div>
  );
}
