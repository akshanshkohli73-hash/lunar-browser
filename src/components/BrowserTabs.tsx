import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import type { TabInfo } from "../../electron/types";
import type { LunarAPI } from "../../shared/api";
import { lunarSpring } from "../../shared/motion";
import { useGlassMaterial } from "../state/GlassMaterialProvider";
import { Icon } from "./ui/Icon";

type Props = {
  tabs: TabInfo[];
  activeId: string | null;
  api: Pick<LunarAPI, "switchTab" | "closeTab" | "reorderTabs"> | undefined;
  report: (error: unknown) => void;
  onMenu: (id: string) => void;
};

/** Native actions remain in the existing API/TabManager. Arrow/Home/End explore
 * tabs; Enter/Space activate (manual tab pattern avoids focus theft by a page).
 * One ResizeObserver tracks the strip, not one observer/context per tab. */
export function BrowserTabs({ tabs, activeId, api, report, onMenu }: Props) {
  const { reduced } = useGlassMaterial();
  const list = useRef<HTMLDivElement>(null),
    dragId = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const measure = useRef<() => void>(() => {});
  const [focused, setFocused] = useState<string | null>(null);
  const [edges, setEdges] = useState({ before: false, after: false });
  const roving = tabs.some((tab) => tab.id === focused) ? focused : activeId;
  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const update = () => {
      const next = {
        before: node.scrollLeft > 2,
        after: node.scrollWidth - node.clientWidth - node.scrollLeft > 2,
      };
      setEdges((old) =>
        old.before === next.before && old.after === next.after ? old : next,
      );
    };
    measure.current = update;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    return () => {
      measure.current = () => {};
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, []);
  const order = tabs.map((tab) => tab.id).join("|");
  useLayoutEffect(() => {
    buttons.current.get(roving ?? "")?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    });
    measure.current();
  }, [roving, order]);
  const explore = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "tab") return;
    const index = tabs.findIndex((tab) => tab.id === target.dataset.tabId);
    if (index < 0) return;
    if (event.key === "Delete") {
      event.preventDefault();
      const next = tabs[index + 1] ?? tabs[index - 1];
      if (next) {
        setFocused(next.id);
        buttons.current.get(next.id)?.focus();
      }
      void api?.closeTab(tabs[index].id).catch(report);
      return;
    }
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : event.key === "ArrowLeft"
              ? (index + tabs.length - 1) % tabs.length
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setFocused(tabs[next].id);
    const button = buttons.current.get(tabs[next].id);
    button?.focus();
    button?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    });
  };
  const scroll = (direction: number) =>
    list.current?.scrollBy?.({
      left: direction * Math.max(160, list.current.clientWidth * 0.7),
      behavior: reduced ? "instant" : "smooth",
    });
  return (
    <div className="browser-tab-rail">
      {(edges.before || edges.after) && (
        <button
          className="icon-button tab-scroll"
          aria-label="Scroll tabs left"
          disabled={!edges.before}
          onClick={() => scroll(-1)}
        >
          <Icon name="back" size={14} />
        </button>
      )}
      <div
        ref={list}
        className="browser-tabs"
        role="tablist"
        aria-label="Browser tabs"
        aria-orientation="horizontal"
        onKeyDown={explore}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(null);
        }}
      >
        <AnimatePresence
          initial={false}
          onExitComplete={() => measure.current()}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              roving={tab.id === roving}
              api={api}
              report={report}
              onMenu={onMenu}
              register={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              dragId={dragId}
              tabs={tabs}
            />
          ))}
        </AnimatePresence>
      </div>
      {(edges.before || edges.after) && (
        <button
          className="icon-button tab-scroll"
          aria-label="Scroll tabs right"
          disabled={!edges.after}
          onClick={() => scroll(1)}
        >
          <Icon name="forward" size={14} />
        </button>
      )}
    </div>
  );
}

function Tab({
  tab,
  active,
  roving,
  api,
  report,
  onMenu,
  register,
  dragId,
  tabs,
}: Omit<Props, "activeId"> & {
  tab: TabInfo;
  active: boolean;
  roving: boolean;
  register: (node: HTMLButtonElement | null) => void;
  dragId: React.MutableRefObject<string | null>;
}) {
  const present = useIsPresent();
  const { reduced, settings } = useGlassMaterial();
  return (
    <motion.div
      className={`browser-tab ${active ? "is-active" : ""}`}
      role="presentation"
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, width: 0, minWidth: 0, margin: 0 }
      }
      transition={lunarSpring(settings.animationSpeed, reduced)}
      aria-hidden={!present}
      style={{ pointerEvents: present ? undefined : "none" }}
      draggable={present && !!api}
      onDragEndCapture={() => {
        dragId.current = null;
      }}
      onDragStartCapture={() => {
        dragId.current = tab.id;
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const from = dragId.current;
        dragId.current = null;
        if (!api || !from || from === tab.id) return;
        const ids = tabs.map((item) => item.id).filter((id) => id !== from);
        ids.splice(ids.indexOf(tab.id), 0, from);
        void api.reorderTabs(ids).catch(report);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (present) onMenu(tab.id);
      }}
    >
      <button
        ref={register}
        role="tab"
        data-tab-id={tab.id}
        aria-selected={active}
        aria-controls="page-viewport"
        tabIndex={roving ? 0 : -1}
        disabled={!present || !api}
        title={tab.url}
        onClick={() => void api?.switchTab(tab.id).catch(report)}
      >
        {tab.isLoading ? (
          <span className="loading-spinner" />
        ) : (
          <Icon
            name={
              tab.isPinned
                ? "pin"
                : tab.url.startsWith("lunar:")
                  ? "moon"
                  : "globe"
            }
            size={13}
          />
        )}
        <span>{tab.title}</span>
        {tab.isMuted || tab.audible ? <Icon name="volume" size={12} /> : null}
      </button>
      <button
        className="tab-close"
        tabIndex={active ? 0 : -1}
        disabled={!present || !api}
        aria-label={`Close ${tab.title}`}
        onClick={() => void api?.closeTab(tab.id).catch(report)}
      >
        <Icon name="x" size={12} />
      </button>
      {active && (
        <motion.span
          className="browser-tab-light"
          aria-hidden="true"
          layoutId={reduced ? undefined : "lunar-tab-light"}
          transition={lunarSpring(settings.animationSpeed, reduced)}
        />
      )}
    </motion.div>
  );
}
