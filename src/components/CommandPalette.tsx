import { useState } from "react";
import { Modal } from "./ui/Modal";
export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigatePage: (page: string) => void;
  onNewTab: () => void;
  onCloseTab: () => void;
}
export default function CommandPalette({
  isOpen,
  onClose,
  onNavigatePage,
  onNewTab,
  onCloseTab,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  if (!isOpen) return null;
  const commands = [
    { name: "New tab", action: onNewTab },
    { name: "Close current tab", action: onCloseTab },
    ...[
      "newtab",
      "settings",
      "themestudio",
      "history",
      "bookmarks",
      "downloads",
      "extensions",
    ].map((page) => ({
      name: {
        newtab: "Start page",
        settings: "Preferences",
        themestudio: "Theme Studio",
        history: "History",
        bookmarks: "Bookmarks",
        downloads: "Downloads",
        extensions: "Extensions",
      }[page]!,
      action: () => onNavigatePage(`lunar://${page}`),
    })),
  ];
  const filtered = commands.filter((command) =>
    command.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Modal title="Browser commands" onClose={onClose}>
      <input
        className="command-search"
        aria-label="Find a command"
        placeholder="What would you like to do?"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered[0]) {
            filtered[0].action();
            setQuery("");
            onClose();
          }
        }}
      />
      <div className="command-list">
        {filtered.map((command) => (
          <button
            key={command.name}
            onClick={() => {
              command.action();
              setQuery("");
              onClose();
            }}
          >
            {command.name}
          </button>
        ))}
        {!filtered.length && (
          <p className="empty-state">No matching commands.</p>
        )}
      </div>
    </Modal>
  );
}
