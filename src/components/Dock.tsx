import React from 'react';

export interface DockItem {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  isMinimized: boolean;
}

interface DockProps {
  items: DockItem[];
  activeWindowId: string;
  onAppClick: (id: string) => void;
}

export const Dock: React.FC<DockProps> = ({ items, activeWindowId, onAppClick }) => {
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--lunar-surface)]/80 backdrop-blur-xl border border-[var(--lunar-border)] shadow-2xl transition-all">
        {items.map((item) => {
          const isActive = activeWindowId === item.id && item.isOpen && !item.isMinimized;
          return (
            <div key={item.id} className="relative group flex flex-col items-center">
              {/* TOOLTIP */}
              <div className="absolute -top-9 px-2 py-1 rounded bg-[var(--lunar-bg-secondary)] border border-[var(--lunar-border)] text-[10px] text-[var(--lunar-text)] opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-md">
                {item.title}
              </div>

              {/* DOCK ICON */}
              <button
                onClick={() => onAppClick(item.id)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all duration-200 transform group-hover:scale-125 group-hover:-translate-y-2 ${
                  isActive
                    ? 'bg-[var(--lunar-primary)]/20 border border-[var(--lunar-primary)] shadow-[0_0_12px_var(--lunar-glow)]'
                    : 'bg-white/5 border border-[var(--lunar-border)] hover:bg-white/10'
                }`}
              >
                <span>{item.icon}</span>
              </button>

              {/* ACTIVE DOT INDICATOR */}
              {item.isOpen && (
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1 transition ${
                    item.isMinimized
                      ? 'bg-[var(--lunar-text-muted)]'
                      : 'bg-[var(--lunar-primary)] shadow-[0_0_6px_var(--lunar-primary)]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dock;
