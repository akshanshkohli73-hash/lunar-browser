import React, { useState, useEffect } from 'react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigatePage: (page: string) => void;
  onNewTab: () => void;
  onCloseTab: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigatePage,
  onNewTab,
  onCloseTab,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { id: 'new_tab', label: 'New Tab', category: 'Tabs', action: () => { onNewTab(); onClose(); } },
    { id: 'close_tab', label: 'Close Current Tab', category: 'Tabs', action: () => { onCloseTab(); onClose(); } },
    { id: 'settings', label: 'Open Settings', category: 'Navigation', action: () => { onNavigatePage('lunar://settings'); onClose(); } },
    { id: 'history', label: 'Open History', category: 'Navigation', action: () => { onNavigatePage('lunar://history'); onClose(); } },
    { id: 'bookmarks', label: 'Open Bookmarks', category: 'Navigation', action: () => { onNavigatePage('lunar://bookmarks'); onClose(); } },
    { id: 'downloads', label: 'Open Downloads', category: 'Navigation', action: () => { onNavigatePage('lunar://downloads'); onClose(); } },
    { id: 'extensions', label: 'Open Extensions', category: 'Navigation', action: () => { onNavigatePage('lunar://extensions'); onClose(); } },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-xl bg-[#0d0f17] border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <span className="text-cyan-400">⌘</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <span className="text-[10px] text-slate-500 font-mono">ESC to cancel</span>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands</div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-300 text-slate-300 text-xs transition text-left"
              >
                <span>{cmd.label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
