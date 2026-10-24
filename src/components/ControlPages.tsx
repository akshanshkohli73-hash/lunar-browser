import { lazy, Suspense, useEffect, useState } from "react";
import type { AppInfo } from "../../shared/api";

import { useBrowser } from "../state/BrowserContext";
import { KEYBOARD_SHORTCUTS } from "../state/control-center";
import NotesView from "./NotesView";
import ShieldPanel from "./ShieldPanel";
import { Icon } from "./ui/Icon";
const DashboardStudio = lazy(() => import("./dashboard/DashboardStudio"));
export function WidgetsPage() {
  const [oldNotes, setOldNotes] = useState(false);
  return (
    <section className="internal-page control-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Lunar controls</span>
          <h1>Widgets</h1>
          <p>
            Add, configure, move, resize or hide widgets. Apply saves your
            layout; Home shows it on the dashboard.
          </p>
        </div>
        <Icon name="widgets" size={28} />
      </header>
      <button
        onClick={() => setOldNotes((value) => !value)}
        aria-expanded={oldNotes}
      >
        {oldNotes ? "Hide previous Quick Notes" : "Previous Quick Notes"}
      </button>
      {oldNotes && <NotesView />}
      <Suspense fallback={<p role="status">Opening widget library…</p>}>
        <DashboardStudio mode="widgets" />
      </Suspense>
    </section>
  );
}
export function ShieldPage() {
  const { siteForControls: site } = useBrowser();
  return (
    <section className="internal-page control-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Privacy, without promises we cannot keep
          </span>
          <h1>Lunar Shield</h1>
          <p>
            Network protection and real site controls.
            {site
              ? ` Site controls below apply to ${new URL(site).hostname}.`
              : " Open a website for per-site controls."}
          </p>
        </div>
        <Icon name="shield" size={28} />
      </header>
      <ShieldPanel url={site} />
    </section>
  );
}
export function InformationPage({
  page,
}: {
  page: "help" | "diagnostics" | "about";
}) {
  const { api, settings, report } = useBrowser();
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    let live = true;
    if (api)
      void api
        .getAppInfo()
        .then((value) => {
          if (live) setInfo(value);
        })
        .catch(report);
    return () => {
      live = false;
    };
  }, [api, report]);
  return (
    <section className="internal-page control-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Lunar Browser</span>
          <h1>
            {page === "help"
              ? "Keyboard shortcuts"
              : page === "diagnostics"
                ? "Diagnostics"
                : "About Lunar"}
          </h1>
        </div>
        <Icon name={page === "help" ? "book" : "info"} size={28} />
      </header>
      {page === "help" ? (
        <>
          <p>
            Shortcuts work in browser chrome and focused website tabs. F10
            focuses the menu bar; arrow keys navigate menus and Escape closes
            them. Website zoom does not resize browser chrome.
          </p>
          <dl className="shortcut-reference">
            {KEYBOARD_SHORTCUTS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <h2>
            {page === "about"
              ? "A little space to explore."
              : "Application & rendering"}
          </h2>
          <p>
            One Coquette-inspired workspace, real Chromium website tabs, and
            local customization. Websites do not receive the application’s
            privileged bridge.
          </p>
          {info ? (
            <dl className="diagnostic-list">
              {Object.entries(info).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted-text">
              {api
                ? "Reading application information…"
                : "Native versions require the installed desktop application. This is the renderer preview."}
            </p>
          )}
          {page === "diagnostics" && (
            <>
              <h2>Current configuration</h2>
              <p>
                History recording: {settings.recordHistory ? "on" : "off"} ·
                Session restoration: {settings.restoreSession ? "on" : "off"} ·
                Shield:{" "}
                {settings.shield.enabled ? settings.shield.mode : "paused"}.
              </p>
              <p>
                Video playback errors include the media error category.
                Supported containers are MP4 and WebM; codec availability
                depends on Chromium and the operating system. Choose H.264 MP4
                or VP8/VP9 WebM for broad compatibility.
              </p>
              <p>
                Diagnostics do not expose cookie values, provider keys,
                filesystem paths or page contents.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
