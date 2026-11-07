import { useEffect, useRef, useState } from "react";
import type { BrowserCommand } from "../../shared/api";
import { isWebUrl } from "../../shared/navigation";
import type { HistoryItem } from "../../shared/schemas";
import { useBrowser } from "../state/BrowserContext";
import { CONTROL_PANELS } from "../state/control-center";
import { useHistoryRevision } from "./useHistoryRevision";
import { Icon } from "./ui/Icon";
export const MENU_NAMES = [
  "Lunar",
  "File",
  "Edit",
  "View",
  "History",
  "Bookmarks",
  "Window",
  "Help",
] as const;
export type MenuName = (typeof MENU_NAMES)[number];
type Item = {
  id: string;
  label: string;
  action?: () => void | Promise<unknown>;
  disabled?: boolean;
  shortcut?: string;
  reason?: string;
  checked?: boolean;
};
export function DesktopMenuBar({
  open,
  onOpen,
  desktopVisible,
  onToggleDesktop,
  onLauncher,
  now,
}: {
  open: MenuName | null;
  onOpen: (menu: MenuName | null) => void;
  desktopVisible: boolean;
  onToggleDesktop: () => void;
  onLauncher: () => void;
  now: Date;
}) {
  const { api, ready, tabs, settings, bookmarks, openPage, report } =
    useBrowser();
  const historyRevision = useHistoryRevision();
  const current = tabs.tabs.find((tab) => tab.id === tabs.activeTabId);
  const web = !!current && isWebUrl(current.url),
    enabled = !!api && ready;
  const header = useRef<HTMLElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const focusBefore = useRef<HTMLElement | null>(null);
  const selection = useRef<[number | null, number | null]>([null, null]);
  const [recent, setRecent] = useState<HistoryItem[]>([]),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (open !== "History" || !api) return;
    let live = true;
    setHistoryError("");
    setRecent([]);
    void api
      .getHistory()
      .then((items) => {
        if (live) setRecent(items.slice(0, 7));
      })
      .catch(() => {
        if (live) setHistoryError("Could not read local history.");
      });
    return () => {
      live = false;
    };
  }, [api, open, historyRevision]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      menu.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) onOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, onOpen]);
  useEffect(() => {
    const focus = () => {
      remember();
      header.current
        ?.querySelector<HTMLButtonElement>("[role=menuitem]")
        ?.focus();
    };
    window.addEventListener("lunar:menu", focus);
    return () => window.removeEventListener("lunar:menu", focus);
  }, []);
  const remember = () => {
    if (open) return;
    const node = document.activeElement;
    if (node instanceof HTMLElement && node.closest(".lunar-menubar")) return;
    focusBefore.current = node instanceof HTMLElement ? node : null;
    selection.current =
      node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
        ? [node.selectionStart, node.selectionEnd]
        : [null, null];
  };
  const run = (action?: () => void | Promise<unknown>) => {
    onOpen(null);
    if (action) void Promise.resolve().then(action).catch(report);
  };
  const edit = (command: BrowserCommand) => {
    const node = focusBefore.current;
    if (node?.isConnected) {
      node.focus({ preventScroll: true });
      if (
        (node instanceof HTMLInputElement ||
          node instanceof HTMLTextAreaElement) &&
        selection.current[0] !== null
      )
        node.setSelectionRange(...selection.current);
    }
    const chrome =
      !!node?.closest("input,textarea,[contenteditable=true]") || !web;
    return api?.browserCommand(command, chrome ? "chrome" : "page");
  };
  const activateAfter = async (operation: Promise<unknown> | undefined) => {
    await operation;
    window.dispatchEvent(new Event("lunar:activate-browser"));
  };
  const go = async (url: string) => {
    if (!api) return;
    if (current) await api.navigateTab(current.id, url);
    else await api.createTab(url);
    window.dispatchEvent(new Event("lunar:activate-browser"));
  };
  const panel = (page: Parameters<typeof openPage>[0]) => () => openPage(page);
  const clearHistory = () => {
    window.dispatchEvent(new Event("lunar:clear-history"));
  };
  const lists: Record<MenuName, Item[]> = {
    Lunar: [
      { id: "about", label: "About Lunar Browser", action: panel("about") },
      {
        id: "controls",
        label: "Lunar controls",
        action: onLauncher,
        shortcut: "Ctrl+Space",
      },
      { id: "settings", label: "Settings…", action: panel("settings") },
      {
        id: "quit",
        label: "Quit Lunar Browser",
        action: () => api?.close(),
        disabled: !enabled,
      },
    ],
    File: [
      {
        id: "new",
        label: "New tab",
        action: () => activateAfter(api?.createTab()),
        disabled: !enabled,
        shortcut: "Ctrl+T",
      },
      {
        id: "window",
        label: "New window",
        disabled: true,
        reason: "Lunar currently supports one application window.",
      },
      {
        id: "close",
        label: "Close tab",
        action: () =>
          activateAfter(current ? api?.closeTab(current.id) : undefined),
        disabled: !enabled || !current,
        shortcut: "Ctrl+W",
      },
      {
        id: "duplicate",
        label: "Duplicate tab",
        action: () =>
          activateAfter(current ? api?.duplicateTab(current.id) : undefined),
        disabled: !enabled || !current,
      },
      { id: "downloads", label: "Downloads", action: panel("downloads") },
    ],
    Edit: (
      [
        ["undo", "Undo", "Ctrl+Z"],
        ["redo", "Redo", "Ctrl+Shift+Z"],
        ["cut", "Cut", "Ctrl+X"],
        ["copy", "Copy", "Ctrl+C"],
        ["paste", "Paste", "Ctrl+V"],
        ["selectAll", "Select all", "Ctrl+A"],
      ] as const
    ).map(([command, label, shortcut]) => ({
      id: command,
      label,
      shortcut,
      action: () => edit(command),
      disabled: !enabled,
    })),
    View: [
      {
        id: "reload",
        label: "Reload",
        action: () => current && api?.reloadTab(current.id),
        disabled: !enabled || !current,
        shortcut: "Ctrl+R",
      },
      {
        id: "hard-reload",
        label: "Reload without cache",
        action: () => current && api?.reloadTab(current.id, true),
        disabled: !enabled || !current,
        shortcut: "Ctrl+Shift+R",
      },
      ...(
        [
          ["zoomIn", "Zoom in", "Ctrl++"],
          ["zoomOut", "Zoom out", "Ctrl+−"],
          ["zoomReset", "Actual size", "Ctrl+0"],
        ] as const
      ).map(([command, label, shortcut]) => ({
        id: command,
        label,
        shortcut,
        action: () => api?.browserCommand(command, "page"),
        disabled: !enabled || !web,
        reason: !web ? "Website zoom is available on website tabs." : undefined,
      })),
      {
        id: "fullscreen",
        label: "Toggle fullscreen",
        action: () => api?.browserCommand("fullscreen", "chrome"),
        disabled: !enabled,
        shortcut: "F11",
      },
      { id: "home", label: "Dashboard", action: panel("newtab") },
      {
        id: "desktop",
        label: desktopVisible ? "Return to browser" : "Show desktop",
        action: onToggleDesktop,
      },
      { id: "appearance", label: "Appearance…", action: panel("themestudio") },
    ],
    History: [
      { id: "activity", label: "Open Activity", action: panel("history") },
      {
        id: "clear",
        label: "Clear browsing history…",
        action: clearHistory,
        disabled: !enabled,
      },
      ...recent.map((item) => ({
        id: item.id,
        label: item.title || new URL(item.url).hostname,
        action: () => go(item.url),
        disabled: !enabled,
      })),
      ...(historyError
        ? [{ id: "error", label: historyError, disabled: true }]
        : []),
      ...(!recent.length
        ? [
            {
              id: "empty",
              label: api
                ? "No recorded recent entries"
                : "History requires the desktop app",
              disabled: true,
            },
          ]
        : []),
    ],
    Bookmarks: [
      {
        id: "add",
        label: "Bookmark this page…",
        action: () => {
          window.dispatchEvent(new Event("lunar:bookmark"));
        },
        disabled: !enabled || !web,
        shortcut: "Ctrl+D",
      },
      { id: "manage", label: "Manage bookmarks", action: panel("bookmarks") },
      ...bookmarks.slice(0, 7).map((item) => ({
        id: item.id,
        label: item.title,
        action: () => go(item.url),
        disabled: !enabled,
      })),
      {
        id: "reading",
        label: "Reading list — not yet available",
        disabled: true,
      },
      {
        id: "saved",
        label: "Offline saved pages — not yet available",
        disabled: true,
      },
    ],
    Window: [
      ...CONTROL_PANELS.map((item) => ({
        id: item.id,
        label: item.label,
        action: panel(item.page),
        checked: current?.url === `lunar://${item.page}`,
      })),
      ...tabs.tabs.map((tab, index) => ({
        id: tab.id,
        label: `${index + 1}. ${tab.title}`,
        action: async () => {
          await api?.switchTab(tab.id);
          window.dispatchEvent(new Event("lunar:activate-browser"));
        },
        checked: tab.id === tabs.activeTabId,
        disabled: !enabled,
      })),
    ],
    Help: [
      { id: "shortcuts", label: "Keyboard shortcuts", action: panel("help") },
      { id: "diagnostics", label: "Diagnostics", action: panel("diagnostics") },
      { id: "about", label: "App information", action: panel("about") },
    ],
  };
  const topButtons = () => [
    ...(header.current?.querySelectorAll<HTMLButtonElement>(
      "[data-top-menu]",
    ) ?? []),
  ];
  return (
    <header
      ref={header}
      className="desktop-menu lunar-menubar"
      aria-label="Lunar desktop menu"
    >
      <span className="lunar-mark">
        <Icon name="moon" size={16} />
      </span>
      <nav
        role="menubar"
        aria-label="Application menu"
        onKeyDown={(event) => {
          const buttons = topButtons(),
            index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
          if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            const next =
              (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
              buttons.length;
            buttons[next]?.focus();
            if (open) onOpen(MENU_NAMES[next]);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onOpen(null);
          }
        }}
      >
        {MENU_NAMES.map((name, index) => (
          <button
            key={name}
            data-top-menu={name}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === name}
            tabIndex={(!open && index === 0) || open === name ? 0 : -1}
            onPointerDown={remember}
            onClick={() => {
              remember();
              onOpen(open === name ? null : name);
            }}
            onMouseEnter={() => {
              if (open && open !== name) onOpen(name);
            }}
            onKeyDown={(event) => {
              if (["ArrowDown", "Enter", " "].includes(event.key)) {
                event.preventDefault();
                remember();
                onOpen(name);
              }
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <span className="desktop-menu-space" />
      <button
        className="menu-desktop-toggle"
        onClick={onToggleDesktop}
        aria-label={desktopVisible ? "Return to browser" : "Show desktop"}
      >
        <Icon name="desktop" size={14} />
      </button>
      <time>
        {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
        · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
      {(
        [
          ["minimize", "Minimize application", "minimize"],
          ["maximize", "Maximize or restore application", "maximize"],
          ["close", "Close application", "x"],
        ] as const
      ).map(([method, label, icon]) => (
        <button
          key={method}
          disabled={!enabled}
          aria-label={label}
          onClick={() => run(() => api?.[method]())}
        >
          <Icon name={icon} size={13} />
        </button>
      ))}
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={`${open} menu`}
          className="lunar-dropdown"
          style={{ left: 28 + MENU_NAMES.indexOf(open) * 57 }}
          onKeyDown={(event) => {
            const buttons = [
                ...(menu.current?.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ) ?? []),
              ],
              index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
            if (event.key === "Escape") {
              event.preventDefault();
              onOpen(null);
              topButtons()[MENU_NAMES.indexOf(open)]?.focus();
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }
            if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
              event.preventDefault();
              onOpen(
                MENU_NAMES[
                  (MENU_NAMES.indexOf(open) +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    MENU_NAMES.length) %
                    MENU_NAMES.length
                ],
              );
            }
          }}
        >
          {lists[open].map((item) => (
            <button
              role="menuitem"
              aria-label={item.label}
              aria-current={item.checked ? "page" : undefined}
              key={item.id}
              title={item.reason}
              disabled={item.disabled}
              onClick={() => run(item.action)}
            >
              <span className="menu-check">
                {item.checked && <Icon name="check" size={13} />}
              </span>
              <span>{item.label}</span>
              {item.shortcut && <kbd aria-hidden="true">{item.shortcut}</kbd>}
            </button>
          ))}
          {!api && (
            <small>
              Desktop operations require Electron. Panel previews remain
              available.
            </small>
          )}
          {open === "History" && !settings.recordHistory && (
            <small>
              Recording is off; older saved visits can still be managed.
            </small>
          )}
        </div>
      )}
    </header>
  );
}
