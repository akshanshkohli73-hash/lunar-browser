import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FilterListStatus } from "../../../electron/types";
import {
  originSchema,
  privacyClearSchema,
  type CustomRule,
  type PrivacyOverview,
  type PrivacyClearRequest,
} from "../../../shared/shield";
import { isWebUrl } from "../../../shared/navigation";
import { useBrowser } from "../../state/BrowserContext";
import { Icon, type IconName } from "../ui/Icon";
import { GlassPanel } from "../ui/GlassControls";
import { announceHistoryCleared } from "../useHistoryRevision";
import { useShield, type ShieldView } from "./useShield";
import {
  Feedback,
  Metric,
  NetworkMetrics,
  PeriodPicker,
  PermissionControls,
  RequestActivity,
  SitePolicyControls,
  Toggle,
  type Period,
} from "./ShieldDetails";
const SECTIONS: Array<{ id: string; title: string; icon: IconName }> = [
  { id: "overview", title: "Overview", icon: "shield" },
  { id: "statistics", title: "Statistics", icon: "history" },
  { id: "lists", title: "Filter lists", icon: "book" },
  { id: "rules", title: "Custom rules", icon: "edit" },
  { id: "permissions", title: "Permissions", icon: "lock" },
  { id: "storage", title: "Storage & data", icon: "folder" },
  { id: "youtube", title: "YouTube privacy", icon: "volume" },
  { id: "advanced", title: "Advanced", icon: "settings" },
];
function FilterSources({ view }: { view: ShieldView }) {
  const { settings, updateSettings } = useBrowser();
  const [name, setName] = useState(""),
    [url, setURL] = useState("");
  const update = async (id?: string) => {
    const state = await view.api!.refreshShield(id);
    const failure = state.lists.find(
      (list) =>
        (id ? list.id === id : settings.shield.filterLists.includes(list.id)) &&
        list.error,
    )?.error;
    if (failure) throw new Error(failure);
  };
  const change = (list: FilterListStatus, enabled: boolean) =>
    void view.run(
      () =>
        updateSettings({
          shield: {
            ...settings.shield,
            filterLists: enabled
              ? [...new Set([...settings.shield.filterLists, list.id])]
              : settings.shield.filterLists.filter((id) => id !== list.id),
          },
        }),
      "Source selection saved. Enabled stale sources update in the background; last-good rules remain active.",
    );
  return (
    <>
      <div className="shield-section-title">
        <div>
          <h2>Filter lists</h2>
          <p>
            Maintained data sources, compiled by the existing Ghostery network
            engine.
          </p>
        </div>
        <button
          onClick={() =>
            void view.run(
              () => update(),
              "Selected sources checked. See each source's status and timestamps.",
            )
          }
        >
          Update selected
        </button>
      </div>
      <p className="shield-fineprint">
        Enabled sources are checked at most daily on startup, not fully
        downloaded on every launch. Conditional requests reuse unchanged data
        when the publisher supports ETags. Errors never replace last-good rules.
        Source hosts see the list request and your IP address, not your browsing
        URLs.
      </p>
      <div className="shield-list-stack">
        {view.state?.lists.map((list) => (
          <article className="shield-source-card" key={list.id}>
            <Toggle
              label={list.name}
              hint={list.description}
              value={settings.shield.filterLists.includes(list.id)}
              onChange={(enabled) => change(list, enabled)}
            />
            <div className="shield-source-facts">
              <span>{list.ruleCount.toLocaleString()} compiled rules</span>
              <span>
                {list.id === "lunar-core"
                  ? "Bundled"
                  : list.category === "malware"
                    ? "Threat intelligence"
                    : list.category || "Network"}
              </span>
              {list.updating && <strong role="status">Updating…</strong>}
            </div>
            <p className="shield-fineprint">
              Last successful data:{" "}
              {list.updatedAt
                ? new Date(list.updatedAt).toLocaleString()
                : "Not downloaded"}
              {list.checkedAt
                ? ` · Last checked: ${new Date(list.checkedAt).toLocaleString()}`
                : ""}
            </p>
            {list.source && <p className="shield-source-url">{list.source}</p>}
            <p className="shield-fineprint">{list.license}</p>
            {!!list.rejected && (
              <p className="shield-notice">
                {list.rejected.toLocaleString()} unsupported/invalid rules
                excluded (including cosmetics, regex and response modifiers).{" "}
                {list.ignored?.toLocaleString() || 0} comments/headers ignored.
              </p>
            )}
            {list.error && (
              <p className="shield-notice">
                {list.error}
                {list.ruleCount > 0
                  ? " Last-good compiled rules remain available."
                  : ""}
              </p>
            )}
            {list.id !== "lunar-core" && (
              <div className="button-row">
                <button
                  disabled={list.updating}
                  onClick={() =>
                    void view.run(
                      () => update(list.id),
                      "Source checked; the displayed rule count and timestamp reflect its actual result.",
                    )
                  }
                >
                  Update {list.custom ? "subscription" : "source"}
                </button>
                <button
                  disabled={list.updating}
                  onClick={() =>
                    void view.run(
                      () => view.api!.resetShieldList(list.id),
                      "This source's compiled cache was reset. Its rules are unavailable until the next successful update.",
                    )
                  }
                >
                  Reset cache
                </button>
                {list.custom && (
                  <button
                    onClick={() =>
                      void view.run(
                        () => view.api!.removeShieldSubscription(list.id),
                        "Custom subscription and its cache removed. Other sources were kept.",
                      )
                    }
                  >
                    Remove subscription
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <form
        className="shield-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void view
            .run(
              () => view.api!.addShieldSubscription({ name, url }),
              "Trusted subscription added, still disabled. Enable it above to opt in to downloads.",
            )
            .then((ok) => {
              if (ok) {
                setName("");
                setURL("");
              }
            });
        }}
      >
        <h3>Add a trusted subscription</h3>
        <label>
          Subscription name
          <input
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Raw HTTPS filter URL
          <input
            required
            type="url"
            maxLength={2048}
            value={url}
            onChange={(event) => setURL(event.target.value)}
            placeholder="https://api.github.com/repos/owner/repository/contents/filters.txt"
          />
        </label>
        <p className="shield-fineprint">
          Supported hosts: GitHub repository contents API,
          raw.githubusercontent.com, easylist.to,
          easylist-downloads.adblockplus.org, hagezi.github.io and
          blocklistproject.github.io. Public HTTPS data only; no redirects,
          credentials, custom ports, private network hosts or executable
          directives. ABP network format, 8 MiB combined/200,000 supported rules
          per source, up to six custom subscriptions. Check upstream trust and
          licensing yourself.
        </p>
        <button type="submit">Add subscription</button>
      </form>
    </>
  );
}
function CustomRules({ view }: { view: ShieldView }) {
  const [editing, setEditing] = useState<string | null>(null),
    [text, setText] = useState(""),
    [note, setNote] = useState(""),
    [enabled, setEnabled] = useState(true);
  const [importText, setImportText] = useState(""),
    [fileError, setFileError] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const rules = view.protection!.config.rules,
    filtered = rules.filter((rule) =>
      `${rule.text} ${rule.note}`.toLowerCase().includes(query.toLowerCase()),
    );
  const lastPage = Math.max(0, Math.ceil(filtered.length / 50) - 1),
    current = Math.min(page, lastPage);
  const reset = () => {
    setEditing(null);
    setText("");
    setNote("");
    setEnabled(true);
  };
  const edit = (rule: CustomRule) => {
    setEditing(rule.id);
    setText(rule.text);
    setNote(rule.note);
    setEnabled(rule.enabled);
  };
  return (
    <>
      <h2>Custom network rules</h2>
      <p>
        Your rules are separate from official sources. Exact-site request
        allowances take precedence, then custom exceptions/blocks, then enabled
        list exceptions and category blocks. Explicit custom blocks can override
        automatic YouTube compatibility safeguards.
      </p>
      <form
        className="shield-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void view
            .run(
              () => view.api!.saveShieldRule(editing, { text, enabled, note }),
              "Custom rule saved and compiled. Existing page content is not retroactively removed.",
            )
            .then((ok) => {
              if (ok) reset();
            });
        }}
      >
        <label>
          Network rule
          <input
            required
            maxLength={1024}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="||tracker.example^$script,third-party"
            spellCheck={false}
          />
        </label>
        <label>
          Rule note
          <input
            maxLength={160}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <Toggle label="Rule enabled" value={enabled} onChange={setEnabled} />
        <p className="shield-fineprint">
          ABP hostname/URL patterns, resource types, domain constraints,
          first-/third-party options and @@ network exceptions. One rule, at
          most 1,024 UTF-8 bytes. No full regular expressions, cosmetics,
          scriptlets, redirects, HTML/CSP or response rewriting.
        </p>
        <div className="button-row">
          <button type="submit">
            {editing ? "Save rule changes" : "Add rule"}
          </button>
          {editing && (
            <button type="button" onClick={reset}>
              Cancel editing
            </button>
          )}
        </div>
      </form>
      <div className="shield-section-title">
        <h3>{rules.length.toLocaleString()} saved rules</h3>
        <label className="shield-search">
          Find rules
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {!filtered.length ? (
        <p className="shield-empty">
          {rules.length
            ? "No rules match this search."
            : "No custom rules yet. Unmatched legitimate traffic remains allowed."}
        </p>
      ) : (
        <ul className="shield-rule-list">
          {filtered.slice(current * 50, (current + 1) * 50).map((rule) => (
            <li key={rule.id}>
              <Toggle
                label={rule.enabled ? "Enabled rule" : "Disabled rule"}
                value={rule.enabled}
                onChange={(enabled) =>
                  void view.run(() =>
                    view.api!.saveShieldRule(rule.id, {
                      text: rule.text,
                      note: rule.note,
                      enabled,
                    }),
                  )
                }
              />
              <code className="shield-rule">{rule.text}</code>
              {rule.note && <p>{rule.note}</p>}
              <div className="button-row">
                <button onClick={() => edit(rule)}>Edit rule</button>
                <button
                  onClick={() =>
                    void view
                      .run(
                        () => view.api!.deleteShieldRule(rule.id),
                        "Custom rule deleted. Official sources were not changed.",
                      )
                      .then((ok) => {
                        if (ok && editing === rule.id) reset();
                      })
                  }
                >
                  Delete rule
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lastPage > 0 && (
        <div className="button-row">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous rules
          </button>
          <span>
            Page {current + 1} of {lastPage + 1}
          </span>
          <button
            disabled={current === lastPage}
            onClick={() => setPage(current + 1)}
          >
            Next rules
          </button>
        </div>
      )}
      <form
        className="shield-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void view
            .run(
              () => view.api!.importShieldRules(importText),
              "Validated rules imported atomically. Existing duplicate rules were kept unchanged.",
            )
            .then((ok) => {
              if (ok) setImportText("");
            });
        }}
      >
        <h3>Import / export</h3>
        <label>
          Import network text or a Lunar custom-rule backup
          <textarea
            rows={5}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label>
          Read a local rules file
          <input
            type="file"
            accept=".txt,.json,text/plain,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileError("");
              if (!file) return;
              if (file.size > 8 * 1024 * 1024) {
                setFileError("Rule imports are limited to 8 MiB.");
                return;
              }
              void file
                .text()
                .then(setImportText)
                .catch(() =>
                  setFileError("The selected rules file could not be read."),
                );
            }}
          />
        </label>
        {fileError && (
          <p role="alert" className="shield-error">
            {fileError}
          </p>
        )}
        <p className="shield-fineprint">
          Imports are all-or-nothing, up to 2,000 total saved rules. Text
          imports accept one rule per line; ! comments and headers are ignored.
          JSON backups retain enabled states and notes. Export contains only
          your custom rules, never subscriptions or browsing activity.
        </p>
        <div className="button-row">
          <button type="submit" disabled={!importText.trim()}>
            Validate & import rules
          </button>
          <button
            type="button"
            onClick={() =>
              void view.run(
                () => view.api!.exportShieldRules(),
                "Custom-rule backup exported, including disabled rules and notes.",
              )
            }
          >
            Export custom rules…
          </button>
        </div>
      </form>
    </>
  );
}
const bytes = (value: number) =>
  value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${(value / (1024 * 1024)).toFixed(1)} MiB`;
function StorageControls({ view }: { view: ShieldView }) {
  const [overview, setOverview] = useState<PrivacyOverview | null>(null),
    [reading, setReading] = useState(true),
    [error, setError] = useState("");
  const [scope, setScope] = useState("all"),
    [range, setRange] = useState<PrivacyClearRequest["range"]>("all"),
    [types, setTypes] = useState<PrivacyClearRequest["types"]>(["cache"]);
  const lifecycle = useRef({ live: true, issued: 0, accepted: 0 });
  useEffect(() => {
    lifecycle.current.live = true;
    return () => {
      lifecycle.current.live = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (!view.api) return;
    const issued = ++lifecycle.current.issued;
    const current = () =>
      lifecycle.current.live && issued > lifecycle.current.accepted;
    setReading(true);
    try {
      const next = await view.api.getPrivacyOverview();
      if (current()) {
        lifecycle.current.accepted = issued;
        setOverview(next);
        setError("");
      }
    } catch (error) {
      if (current())
        setError(
          error instanceof Error
            ? error.message
            : "Site data could not be read.",
        );
    } finally {
      if (lifecycle.current.live && issued === lifecycle.current.issued)
        setReading(false);
    }
  }, [view.api]);
  useEffect(() => {
    void load();
  }, [load]);
  const request = {
    ...(scope === "site" && view.site ? { origin: view.site.origin } : {}),
    range,
    types,
  };
  const missingSite = scope === "site" && !view.site;
  const valid = privacyClearSchema.safeParse(request);
  return (
    <>
      <div className="shield-section-title">
        <div>
          <h2>Storage & browsing data</h2>
          <p>
            Real cookie counts and Chromium's web-session cache size. No
            invented per-site storage estimates.
          </p>
        </div>
        <button disabled={reading} onClick={() => void load()}>
          Refresh data overview
        </button>
      </div>
      {reading && <p role="status">Reading native cookie/cache state…</p>}
      {error && (
        <p role="alert" className="shield-error">
          {error}
        </p>
      )}
      {overview && (
        <>
          <dl className="shield-metrics">
            <Metric
              label="Website cookies"
              value={overview.cookies.toLocaleString()}
              hint="Values stay in the main process"
            />
            <Metric
              label="Web-session HTTP cache"
              value={bytes(overview.cacheBytes)}
              hint="Not a per-origin storage estimate"
            />
          </dl>
          <details>
            <summary>Cookie hosts ({overview.cookieDomains.length})</summary>
            {overview.cookieDomains.length ? (
              <ul className="shield-cookie-list">
                {overview.cookieDomains.map((site) => (
                  <li key={site.hostname}>
                    <code>{site.hostname}</code>
                    <span>{site.cookies.toLocaleString()} cookies</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No cookies currently reported by this web session.</p>
            )}
          </details>
        </>
      )}
      <p className="shield-fineprint">
        Electron does not expose a complete storage-origin inventory or
        supported per-origin byte totals. The website selector uses observed
        origins, configured policies and cookie hosts, not an exhaustive storage
        scan. Third-party cookie-header removal is not JavaScript cookie
        isolation or storage partitioning.
      </p>
      <form
        className="shield-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid.success || missingSite) return;
          void view.run(async () => {
            try {
              await view.api!.clearSelectedData(valid.data);
              if (valid.data.types.includes("history"))
                announceHistoryCleared();
            } finally {
              await load();
            }
          }, "Selected data cleared by Chromium. Running pages may recreate storage; related-domain cookie removal can sign out other subdomains.");
        }}
      >
        <h3>Clear selected data</h3>
        <label>
          Data scope
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">All website tabs in this profile</option>
            <option value="site" disabled={!view.site}>
              Selected origin
              {view.site ? ` · ${view.site.origin}` : " · choose one above"}
            </option>
          </select>
        </label>
        <label>
          Data time range
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as PrivacyClearRequest["range"])
            }
          >
            <option value="all">All time</option>
            <option value="hour">Last hour · history only</option>
            <option value="day">Last 24 hours · history only</option>
            <option value="week">Last 7 days · history only</option>
          </select>
        </label>
        {(
          [
            ["history", "Browsing history"],
            ["cookies", "Cookies"],
            ["cache", "HTTP cache"],
            [
              "storage",
              "Site storage (local storage, IndexedDB, workers, file systems)",
            ],
          ] as const
        ).map(([key, label]) => (
          <label className="shield-data-choice" key={key}>
            <input
              type="checkbox"
              checked={types.includes(key)}
              onChange={(event) =>
                setTypes((previous) =>
                  event.target.checked
                    ? [...previous, key]
                    : previous.filter((type) => type !== key),
                )
              }
            />
            {label}
          </label>
        ))}
        {(!valid.success || missingSite) && (
          <p role="status" className="shield-notice">
            {missingSite
              ? "Select an exact website origin before site-scoped deletion."
              : !valid.success
                ? valid.error.issues[0].message
                : ""}
          </p>
        )}
        <p className="shield-notice">
          Clearing cookies or storage can sign you out and remove offline data.
          Cookies are registrable-domain scoped: related subdomains and ports
          can also be affected. Time-scoped cookie/cache/storage deletion is not
          supported by this Electron API, so Lunar does not pretend to offer it.
        </p>
        <button type="submit" disabled={!valid.success || missingSite}>
          Review & clear selected data…
        </button>
      </form>
    </>
  );
}
function YoutubeControls({
  view,
  period,
}: {
  view: ShieldView;
  period: Period;
}) {
  const youtube = view.protection!.youtube,
    counts = view.protection!.statistics.periods[period].youtube;
  return (
    <>
      <div className="shield-section-title">
        <div>
          <span className="eyebrow">A dedicated, conservative profile</span>
          <h2>YouTube Privacy & Content Protection</h2>
        </div>
        <Icon name="volume" size={26} />
      </div>
      <Toggle
        label="YouTube privacy profile"
        hint="Automatic third-party advertising/tracker network matching on genuine YouTube pages and embeds. This does not change protection on other sites."
        value={youtube.enabled}
        onChange={(enabled) =>
          void view.run(() =>
            view.api!.youtubeProtection({ type: "set", enabled }),
          )
        }
      />
      <p>
        Player/navigation endpoints, media delivery, captions and account
        endpoints have automatic compatibility safeguards. Global protection is
        still the master switch; explicit user rules, site allowances, threat
        protection and your cookie preference retain their own precedence.
      </p>
      <NetworkMetrics counts={counts} />
      <dl className="shield-metrics">
        <Metric
          label="Advertising-related network blocks"
          value={counts.ads.toLocaleString()}
        />
        <Metric
          label="Tracker-list network blocks"
          value={counts.trackers.toLocaleString()}
        />
        <Metric
          label="Other network blocks"
          value={(
            counts.other +
            counts.custom +
            counts.malware
          ).toLocaleString()}
        />
      </dl>
      <p className="shield-notice">
        These are confirmed request cancellations, not independently verified
        removed YouTube advertisements. First-party/server-inserted ads may
        pass. No universal video-ad removal, invisible anti-adblock bypass,
        player rewriting or scriptlet injection is promised.
      </p>
      <h3>Applicable source status</h3>
      <ul className="shield-plain-list">
        {view
          .state!.lists.filter((list) =>
            view.state!.settings.filterLists.includes(list.id),
          )
          .map((list) => (
            <li key={list.id}>
              {list.name} · {list.ruleCount.toLocaleString()} available rules
              {list.error ? ` · ${list.error}` : ""}
            </li>
          ))}
      </ul>
      <h3>Recent YouTube / embed activity</h3>
      <p className="shield-fineprint">
        This session's confirmed blocks, attributed to their owning top-level
        site. Embedded players are recognized from native frame/initiator
        identities, not from URL substrings on unrelated hosts.
      </p>
      <RequestActivity
        items={youtube.recent}
        view={view}
        allow={false}
        limit={30}
      />
      <h3>Observed compatibility signals</h3>
      {youtube.compatibility.length ? (
        <ul className="shield-plain-list">
          {youtube.compatibility.map((issue, index) => (
            <li key={`${issue.time}-${index}`}>
              <code>{issue.hostname}</code> · {issue.resourceType} ·{" "}
              {issue.error} · {new Date(issue.time).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="shield-empty">
          No player/authentication network errors observed in this session. This
          is not a successful playback, account or ad-removal test.
        </p>
      )}
      <p className="shield-fineprint">
        Only actual native request errors are shown, not inferred player
        failures or attribution to Shield. Live
        homepage/search/watch/Shorts/live-stream/caption/fullscreen/audio/account
        compatibility is not certified by these counters. Local network/media
        fixtures are not a real YouTube session.
      </p>
      <div className="button-row">
        <button
          onClick={() =>
            void view.run(
              () => view.api!.youtubeProtection({ type: "reset" }),
              "YouTube profile restored and YouTube-origin site overrides removed. Global settings, custom rules and aggregate history were kept.",
            )
          }
        >
          Reset YouTube profile
        </button>
        <button
          onClick={() =>
            void view.run(
              () => view.api!.youtubeProtection({ type: "resetPermissions" }),
              "YouTube-origin permission policies restored to Ask. Other websites and Google-account origins were not changed.",
            )
          }
        >
          Restore YouTube permissions to Ask
        </button>
        <button
          onClick={() =>
            void view.run(
              () => view.api!.youtubeProtection({ type: "clearData" }),
              "YouTube cookie domains and known-origin storage were cleared. Other Google-account storage was not selected.",
            )
          }
        >
          Clear YouTube site data…
        </button>
      </div>
    </>
  );
}
function AdvancedControls({ view }: { view: ShieldView }) {
  const { settings, updateSettings } = useBrowser();
  const [allowlist, setAllowlist] = useState(
    settings.shield.allowlist.join("\n"),
  );
  const signature = settings.shield.allowlist.join("\n");
  useEffect(() => {
    setAllowlist(signature);
  }, [signature]);
  const set = (patch: Partial<typeof settings.shield>) =>
    void view.run(() =>
      updateSettings({ shield: { ...settings.shield, ...patch } }),
    );
  const threat =
    settings.shield.malware &&
    settings.shield.filterLists.includes("threat-intelligence") &&
    !!view.state?.lists.find((list) => list.id === "threat-intelligence")
      ?.ruleCount;
  return (
    <>
      <h2>Advanced protection controls</h2>
      <Toggle
        label="Global protection"
        hint="Master switch, including per-site matching, cookie-header policy and eligible HTTPS upgrades."
        value={settings.shield.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {(
        [
          ["ads", "Advertising rules"],
          ["trackers", "Tracker rules"],
          ["telemetry", "Telemetry rules"],
          ["social", "Social-widget rules"],
          ["cryptomining", "Known cryptomining-domain rules"],
          ["popups", "Script-created new-window blocking"],
        ] as const
      ).map(([key, title]) => (
        <Toggle
          key={key}
          label={title}
          value={settings.shield[key]}
          onChange={(value) => set({ [key]: value })}
        />
      ))}
      <Toggle
        label="Known malicious-domain protection"
        hint="Distinct threat-intelligence list. An advertisement is not labelled malware. List errors and false positives remain possible."
        value={settings.shield.malware}
        onChange={(malware) => set({ malware })}
      />
      <p className={threat ? "shield-fineprint" : "shield-notice"}>
        {threat
          ? "The selected HaGeZi threat feed has compiled rules. Matching known-threat domains can also block a top-level navigation."
          : "No active threat feed: enable this category, then select and update HaGeZi in Filter lists. Ordinary ad/tracker lists are not used as a malware classifier."}
      </p>
      <label className="shield-switch">
        <span>
          Global matching mode
          <small>
            Strict includes matching first-party subresources and can affect
            site functionality. Ordinary ad/tracker lists never blanket-block
            main documents; explicit custom rules and known-threat rules can.
          </small>
        </span>
        <select
          aria-label="Global matching mode"
          value={settings.shield.mode}
          onChange={(event) =>
            set({
              mode: event.target.value === "strict" ? "strict" : "balanced",
            })
          }
        >
          <option value="balanced">Balanced · third-party</option>
          <option value="strict">Strict · first + third party</option>
        </select>
      </label>
      <Toggle
        label="Restrict third-party network cookies"
        hint="Removes actual Cookie/Set-Cookie headers. YouTube player/auth endpoints are exempt for compatibility; not complete storage partitioning."
        value={settings.shield.blockThirdPartyCookies}
        onChange={(blockThirdPartyCookies) => set({ blockThirdPartyCookies })}
      />
      <Toggle
        label="Upgrade eligible HTTP navigation to HTTPS"
        hint="Opt-in. Skips IP/local/test/custom-port destinations and does not silently fall back to HTTP. No TLS interception."
        value={settings.shield.httpsUpgrades}
        onChange={(httpsUpgrades) => set({ httpsUpgrades })}
      />
      <form
        className="shield-editor"
        onSubmit={(event) => {
          event.preventDefault();
          set({
            allowlist: [
              ...new Set(
                allowlist
                  .split(/\r?\n/u)
                  .map((host) => host.trim().toLowerCase())
                  .filter(Boolean),
              ),
            ],
          });
        }}
      >
        <h3>Legacy exact-host exceptions</h3>
        <label>
          One hostname per line
          <textarea
            aria-label="Legacy exact-host exceptions"
            rows={3}
            value={allowlist}
            onChange={(event) => setAllowlist(event.target.value)}
          />
        </label>
        <p className="shield-fineprint">
          These migrated global host exceptions cover both schemes/ports on the
          exact hostname, never its subdomains. Prefer exact-origin website
          controls in Overview for new exceptions.
        </p>
        <button type="submit">Save exact-host exceptions</button>
      </form>
      <h3>Saved website overrides</h3>
      {view.protection!.config.sites.length ? (
        <ul className="shield-allowances">
          {view.protection!.config.sites.map((site) => (
            <li key={site.origin}>
              <code>{site.origin}</code>
              <span>
                {site.allowedRequests?.length || 0} targeted allowances
              </span>
              <button
                onClick={() =>
                  void view.run(() =>
                    view.api!.setShieldSite(site.origin, null),
                  )
                }
              >
                Reset origin
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="shield-empty">No website-specific overrides saved.</p>
      )}
      <h3>Bounded local processing</h3>
      <p>
        {view.protection!.cache.entries.toLocaleString()} /{" "}
        {view.protection!.cache.capacity.toLocaleString()} in-memory
        matcher-cache entries · {view.protection!.cache.hits.toLocaleString()}{" "}
        hits / {view.protection!.cache.misses.toLocaleString()} misses. Rule,
        list and policy changes invalidate prior decisions. No telemetry is
        sent.
      </p>
      <div className="button-row">
        <button
          onClick={() =>
            void view.run(
              () => view.api!.clearShieldHistory(),
              "Protection statistics and recovery copies cleared. Browser history, site data and rules were kept.",
            )
          }
        >
          Clear protection history…
        </button>
        <button
          onClick={() =>
            void view.run(
              () => view.api!.resetShieldConfig(),
              "Shield defaults restored. Your unrelated browser/profile data and aggregate protection history were kept.",
            )
          }
        >
          Reset Shield preferences…
        </button>
      </div>
      <p className="shield-fineprint">
        Protection cannot guarantee anonymity, eliminate fingerprinting, certify
        all sites as safe or remove every ad. Network filtering only; no
        cosmetic/scriptlet/HTML injection. Browsing origins and blocked domains
        are retained in bounded session diagnostics; durable statistics use
        timestamps, aggregate counters and salted domain identifiers. Clearing
        protection history deletes its primary, backup and matching recovery
        copies.
      </p>
    </>
  );
}
export default function ShieldDashboard() {
  const { api, siteForControls, settings, updateSettings } = useBrowser();
  const initialOrigin = isWebUrl(siteForControls)
    ? new URL(siteForControls).origin
    : "";
  const [origin, setOrigin] = useState(initialOrigin),
    [draftOrigin, setDraftOrigin] = useState(initialOrigin),
    [originError, setOriginError] = useState("");
  useEffect(() => {
    if (initialOrigin) {
      setOrigin((current) => current || initialOrigin);
      setDraftOrigin((current) => current || initialOrigin);
    }
  }, [initialOrigin]);
  const [section, setSection] = useState("overview"),
    [period, setPeriod] = useState<Period>("today");
  const view = useShield(origin),
    statistics = view.protection?.statistics,
    selected = statistics?.periods[period];
  const controls = ["overview", "permissions", "storage"].includes(section);
  return (
    <section
      className="internal-page control-page shield-dashboard"
      aria-label="Lunar Shield dashboard"
    >
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Lunar Shield 2.0 · local-first privacy
          </span>
          <h1>Lunar Shield</h1>
          <p>Understand what was blocked. Decide what stays allowed.</p>
        </div>
        <span className="shield-emblem">
          <Icon name="shield" size={28} />
        </span>
      </header>
      <GlassPanel className="shield-hero">
        <div>
          <span className="eyebrow">A quieter orbit</span>
          <h2>
            A little less tracking.
            <br />A little more control.
          </h2>
          <p>Real network decisions. Your own rules. Nothing to invent.</p>
        </div>
        <div className="shield-hero-status">
          <span
            className="shield-status-pill"
            data-state={settings.shield.enabled ? "on" : "off"}
          >
            {settings.shield.enabled
              ? "Protection enabled"
              : "Protection paused"}
          </span>
          <small>
            {api
              ? "Managed on this device"
              : "Renderer preview · no native filtering"}
          </small>
        </div>
      </GlassPanel>
      <div className="shield-workspace">
        <nav className="shield-navigation" aria-label="Shield sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <Icon name={item.icon} size={17} />
              {item.title}
            </button>
          ))}
        </nav>
        <div className="shield-content">
          <Feedback view={view} />
          {!api && (
            <p className="shield-notice">
              Live request filtering, counters, saved policies and native data
              operations require the installed desktop application. This preview
              does not fabricate activity.
            </p>
          )}
          {api && !view.loading && !view.protection && (
            <p className="shield-notice">
              Detailed protection state is not available from the current native
              bridge. Reopen this page in the current desktop build.
            </p>
          )}
          {["overview", "statistics", "youtube"].includes(section) &&
            view.protection && (
              <PeriodPicker value={period} onChange={setPeriod} />
            )}
          <fieldset
            className="shield-fieldset"
            disabled={!api || view.loading || view.busy || !view.protection}
          >
            {controls && (
              <form
                className="shield-origin-picker"
                onSubmit={(event) => {
                  event.preventDefault();
                  const input = draftOrigin.trim().replace(/\/$/u, "");
                  const parsed = originSchema.safeParse(input);
                  if (!parsed.success) {
                    setOriginError(parsed.error.issues[0].message);
                    return;
                  }
                  setOriginError("");
                  setOrigin(parsed.data);
                }}
              >
                <label>
                  Website origin
                  <input
                    type="url"
                    aria-label="Website origin"
                    value={draftOrigin}
                    list="shield-known-origins"
                    placeholder="https://example.org"
                    onChange={(event) => setDraftOrigin(event.target.value)}
                  />
                </label>
                <datalist id="shield-known-origins">
                  {[
                    ...new Set([
                      initialOrigin,
                      ...(view.protection?.config.sites.map(
                        (site) => site.origin,
                      ) || []),
                      ...(view.protection?.config.permissions.map(
                        (entry) => entry.origin,
                      ) || []),
                    ]),
                  ]
                    .filter(Boolean)
                    .map((origin) => (
                      <option key={origin} value={origin} />
                    ))}
                </datalist>
                <button type="submit">Select website</button>
                {originError && (
                  <p role="alert" className="shield-error">
                    {originError}
                  </p>
                )}
              </form>
            )}
            {view.protection && selected && (
              <>
                {section === "overview" && (
                  <>
                    <div className="shield-section-title">
                      <h2>Your protection at a glance</h2>
                      <span className="shield-fineprint">
                        {
                          view.state!.lists.filter(
                            (list) =>
                              settings.shield.filterLists.includes(list.id) &&
                              list.ruleCount > 0,
                          ).length
                        }{" "}
                        selected loaded sources
                      </span>
                    </div>
                    <Toggle
                      label="Global protection"
                      hint="The master switch; per-origin exceptions do not change other websites."
                      value={settings.shield.enabled}
                      onChange={(enabled) =>
                        void view.run(() =>
                          updateSettings({
                            shield: { ...settings.shield, enabled },
                          }),
                        )
                      }
                    />
                    <NetworkMetrics counts={selected.totals} />
                    <dl className="shield-metrics">
                      <Metric
                        label="Blocked domains"
                        value={`${selected.uniqueBlockedDomains.toLocaleString()}${selected.distinctCountsLimited ? "+" : ""}`}
                      />
                      <Metric
                        label="Sites with a confirmed block"
                        value={`${selected.protectedSites.toLocaleString()}${selected.distinctCountsLimited ? "+" : ""}`}
                      />
                    </dl>
                    <p className="shield-fineprint">
                      UTC-day aggregates since{" "}
                      {new Date(statistics!.since).toLocaleString()}.{" "}
                      {selected.unresolved.toLocaleString()} evaluated requests
                      lack a recorded terminal outcome
                      (in-flight/evicted/interrupted), so they are not guessed
                      as allowed or blocked. Allowed means permitted by Shield,
                      not a guaranteed successful download.
                    </p>
                    <h3>Website controls</h3>
                    <SitePolicyControls view={view} />
                    <h3>Recent confirmed blocks for the selected origin</h3>
                    <RequestActivity
                      items={view.site?.recent || []}
                      view={view}
                    />
                  </>
                )}
                {section === "statistics" && (
                  <>
                    <h2>Privacy statistics</h2>
                    <NetworkMetrics counts={selected.totals} />
                    <dl className="shield-metrics">
                      {(
                        [
                          ["ads", "Advertising-related"],
                          ["trackers", "Tracker-list matches"],
                          ["malware", "Threat-list matches"],
                          ["custom", "Custom-rule matches"],
                          ["other", "Other network blocks"],
                        ] as const
                      ).map(([key, title]) => (
                        <Metric
                          key={key}
                          label={title}
                          value={selected.totals[key].toLocaleString()}
                        />
                      ))}
                    </dl>
                    <p className="shield-fineprint">
                      {selected.totals.failed.toLocaleString()} allowed requests
                      ended with a native network error. Separately:{" "}
                      {selected.totals.popups.toLocaleString()} popup denials,{" "}
                      {selected.totals.cookies.toLocaleString()} cookie-header
                      removals and {selected.totals.upgrades.toLocaleString()}{" "}
                      HTTPS upgrades requested. None inflate network-block
                      totals. Distinct identifiers are bounded; a + means a
                      lower bound, not an invented exact count.
                    </p>
                    <div className="shield-table-scroll">
                      <table className="shield-statistics-table">
                        <caption>
                          Recorded UTC-day aggregates · up to 31 retained days
                        </caption>
                        <thead>
                          <tr>
                            <th>UTC date</th>
                            <th>Evaluated</th>
                            <th>Blocked</th>
                            <th>Allowed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statistics!.days.map((day) => (
                            <tr key={day.day}>
                              <th>{day.day}</th>
                              <td>{day.evaluated.toLocaleString()}</td>
                              <td>
                                <span
                                  className="shield-count-bar"
                                  style={
                                    {
                                      "--shield-fraction": `${day.evaluated ? Math.min(100, (100 * day.blocked) / day.evaluated) : 0}%`,
                                    } as CSSProperties
                                  }
                                >
                                  {day.blocked.toLocaleString()}
                                </span>
                              </td>
                              <td>{day.allowed.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!statistics!.days.length && (
                        <p className="shield-empty">
                          No timestamped request activity recorded yet. No
                          historical periods are backfilled.
                        </p>
                      )}
                    </div>
                    <p className="shield-fineprint">
                      All-time aggregates survive restarts; recent day buckets
                      expire. Completed/error events resolve one request ID once
                      per session, including redirect chains. Bounded in-memory
                      activity is not a complete browsing log. No
                      bandwidth-saving or anonymity estimate is manufactured.
                    </p>
                    <button
                      onClick={() =>
                        void view.run(
                          () => view.api!.clearShieldHistory(),
                          "Protection statistics and matching recovery copies cleared.",
                        )
                      }
                    >
                      Clear protection history…
                    </button>
                  </>
                )}
                {section === "lists" && <FilterSources view={view} />}
                {section === "rules" && <CustomRules view={view} />}
                {section === "permissions" && (
                  <>
                    <h2>Website permissions</h2>
                    <PermissionControls view={view} />
                  </>
                )}
                {section === "storage" && <StorageControls view={view} />}
                {section === "youtube" && (
                  <YoutubeControls view={view} period={period} />
                )}
                {section === "advanced" && <AdvancedControls view={view} />}
              </>
            )}
          </fieldset>
        </div>
      </div>
    </section>
  );
}
