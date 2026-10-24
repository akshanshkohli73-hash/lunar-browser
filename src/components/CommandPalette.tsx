import { useState } from "react";
import { Modal } from "./ui/Modal";
import { CONTROL_PANELS } from "../state/control-center";
export interface CommandPaletteProps {
  isOpen: boolean;
  nativeAvailable: boolean;
  hasTab: boolean;
  onClose: () => void;
  onNavigatePage: (page: string) => void;
  onNewTab: () => void;
  onCloseTab: () => void;
}
export default function CommandPalette({
  isOpen,
  nativeAvailable,
  hasTab,
  onClose,
  onNavigatePage,
  onNewTab,
  onCloseTab,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  if (!isOpen) return null;
  const commands = [
    { name: "New tab", action: onNewTab, disabled: !nativeAvailable },
    {
      name: "Close current tab",
      action: onCloseTab,
      disabled: !nativeAvailable || !hasTab,
    },
    ...CONTROL_PANELS.map((item) => ({
      name: item.label,
      action: () => onNavigatePage(`lunar://${item.page}`),
      disabled: false,
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
          if (event.key === "Enter" && filtered[0] && !filtered[0].disabled) {
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
            disabled={command.disabled}
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
