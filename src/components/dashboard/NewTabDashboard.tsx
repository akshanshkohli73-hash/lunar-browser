import { lazy, Suspense, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  arrangeWidgets,
  WIDGET_DEFINITIONS,
  type DashboardSettings,
  type DashboardWidget,
} from "../../../shared/dashboard";
import { useBrowser } from "../../state/BrowserContext";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
const DashboardStudio = lazy(() => import("./DashboardStudio"));
import { useReducedMotionPreference } from "../useReducedMotionPreference";
import { Wallpaper } from "./Wallpaper";
import { WIDGET_COMPONENTS } from "./Widgets";
export default function NewTabDashboard({
  active,
  navigate,
}: {
  active: boolean;
  navigate: (url: string) => void;
}) {
  const {
    dashboard,
    presentationDashboard,
    reducedMotion,
    updateDashboard,
    ready,
    api,
    shield,
    settings,
    report,
  } = useBrowser();
  const [preview, setPreview] = useState<DashboardSettings | null>(null),
    [customizing, setCustomizing] = useState(false),
    [arranging, setArranging] = useState(false),
    [saving, setSaving] = useState(false);
  const reduced = useReducedMotionPreference(),
    current = preview ?? presentationDashboard;
  const changeCell = (next: DashboardWidget) =>
    setPreview({ ...current, widgets: arrangeWidgets(current.widgets, next) });
  const close = () => {
    setPreview(null);
    setCustomizing(false);
  };
  return (
    <section
      className="new-tab-dashboard"
      aria-label="New tab dashboard"
      data-alignment={current.alignment}
      data-dashboard-text={current.text}
      data-wallpaper-preset={
        current.wallpaper.kind === "builtin"
          ? current.wallpaper.builtin
          : "local"
      }
      style={{ "--widget-opacity": current.widgetOpacity } as CSSProperties}
    >
      <Wallpaper
        value={current.wallpaper}
        active={active && !customizing}
        reduceMotion={reducedMotion || !!reduced}
      />
      <div className="dashboard-body">
        <header className="dashboard-heading">
          <div>
            <Icon name="moon" size={18} />
            <span>Your space, at your pace.</span>
          </div>
          <div>
            <button
              disabled={!ready || arranging}
              onClick={() => setCustomizing(true)}
            >
              <Icon name="palette" size={15} />
              Customize dashboard
            </button>
            <button
              aria-pressed={arranging}
              disabled={!ready || customizing || saving || !api}
              onClick={() => {
                setArranging((value) => !value);
                setPreview(arranging ? null : structuredClone(dashboard));
              }}
            >
              <Icon name="move" size={15} />
              {arranging ? "Cancel arrangement" : "Arrange widgets"}
            </button>
          </div>
        </header>
        {arranging && (
          <div className="arrangement-bar" role="status">
            <span>
              Drag a widget’s handle, or use its arrow buttons. Collisions move
              other widgets aside; narrow windows stack the same saved layout.
            </span>
            <button
              className="primary-button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await updateDashboard({ widgets: current.widgets });
                  setPreview(null);
                  setArranging(false);
                } catch (failure) {
                  report(failure);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save layout"}
            </button>
          </div>
        )}
        <div
          className={`dashboard-grid ${arranging ? "is-arranging" : ""}`}
          ref={(node) => {
            if (node) node.inert = customizing;
          }}
          onDragOver={(event) => {
            if (arranging) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!arranging) return;
            event.preventDefault();
            const id = event.dataTransfer.getData("application/x-lunar-widget"),
              widget = current.widgets.find((cell) => cell.id === id);
            if (!widget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const targetId = (event.target as HTMLElement).closest<HTMLElement>(
              "[data-widget-id]",
            )?.dataset.widgetId;
            const target = current.widgets.find((cell) => cell.id === targetId);
            if (rect.width <= 760 && target) {
              changeCell({ ...widget, x: target.x, y: target.y });
              return;
            }
            changeCell({
              ...widget,
              x: Math.max(
                0,
                Math.min(
                  12 - widget.w,
                  Math.floor((event.clientX - rect.left) / (rect.width / 12)),
                ),
              ),
              y: Math.max(
                0,
                Math.min(
                  200 - widget.h,
                  Math.floor((event.clientY - rect.top) / 66),
                ),
              ),
            });
          }}
        >
          {current.widgets
            .filter((widget) => widget.visible)
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((widget) => {
              const Component = WIDGET_COMPONENTS[widget.kind];
              return (
                <motion.article
                  key={widget.id}
                  data-widget-id={widget.id}
                  layout={!reducedMotion && !reduced}
                  transition={{
                    duration: reducedMotion || reduced ? 0 : 0.18,
                  }}
                  className={`dashboard-widget widget-${widget.kind}`}
                  aria-label={`${WIDGET_DEFINITIONS[widget.kind].title} widget`}
                  style={
                    {
                      "--cell-x": widget.x + 1,
                      "--cell-y": widget.y + 1,
                      "--cell-w": widget.w,
                      "--cell-h": widget.h,
                    } as CSSProperties
                  }
                >
                  {arranging && (
                    <div
                      className="widget-arrange-handle"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "application/x-lunar-widget",
                          widget.id,
                        )
                      }
                    >
                      <span>
                        <Icon name="move" size={14} />
                        {WIDGET_DEFINITIONS[widget.kind].title}
                      </span>
                      <div>
                        <button
                          aria-label={`Move ${WIDGET_DEFINITIONS[widget.kind].title} left`}
                          disabled={widget.x === 0}
                          onClick={() =>
                            changeCell({ ...widget, x: widget.x - 1 })
                          }
                        >
                          <Icon name="back" size={12} />
                        </button>
                        <button
                          aria-label={`Move ${WIDGET_DEFINITIONS[widget.kind].title} right`}
                          disabled={widget.x + widget.w === 12}
                          onClick={() =>
                            changeCell({ ...widget, x: widget.x + 1 })
                          }
                        >
                          <Icon name="forward" size={12} />
                        </button>
                        <button
                          aria-label={`Move ${WIDGET_DEFINITIONS[widget.kind].title} up`}
                          disabled={widget.y === 0}
                          onClick={() =>
                            changeCell({ ...widget, y: widget.y - 1 })
                          }
                        >
                          <Icon name="up" size={12} />
                        </button>
                        <button
                          aria-label={`Move ${WIDGET_DEFINITIONS[widget.kind].title} down`}
                          disabled={widget.y + widget.h === 200}
                          onClick={() =>
                            changeCell({ ...widget, y: widget.y + 1 })
                          }
                        >
                          <Icon name="down" size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div
                    className="widget-content"
                    ref={(node) => {
                      if (node) node.inert = arranging || customizing;
                    }}
                  >
                    <Component
                      widget={widget}
                      active={active && !customizing && !arranging}
                      navigate={navigate}
                    />
                  </div>
                </motion.article>
              );
            })}
        </div>
        {!current.widgets.some((widget) => widget.visible) && (
          <div className="dashboard-empty">
            <h1>A blank canvas.</h1>
            <p>
              Add widgets in Customize dashboard, or use the address bar above.
            </p>
          </div>
        )}
        <footer className="dashboard-footer">
          <span>
            <Icon name="shield" size={14} />
            {api
              ? settings.shield.enabled
                ? `Lunar Shield · ${shield?.stats.totalBlocked ?? 0} requests / popups blocked this session`
                : "Lunar Shield is paused"
              : "Your Coquette desktop, made for the web."}
          </span>
          <button disabled={!api} onClick={() => navigate("lunar://bookmarks")}>
            Bookmarks
          </button>
          <button disabled={!api} onClick={() => navigate("lunar://history")}>
            History
          </button>
          <button disabled={!api} onClick={() => navigate("lunar://settings")}>
            Preferences
          </button>
        </footer>
      </div>
      {customizing && (
        <Modal title="Customize dashboard" onClose={close}>
          <Suspense fallback={<p role="status">Opening dashboard controls…</p>}>
            <DashboardStudio onDone={close} />
          </Suspense>
        </Modal>
      )}
    </section>
  );
}
