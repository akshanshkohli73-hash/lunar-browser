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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-[#EADFD5] shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all">
        {items.map((item) => {
          const isActive = activeWindowId === item.id && item.isOpen && !item.isMinimized;
          return (
            <div key={item.id} className="relative group flex flex-col items-center">
              {/* TOOLTIP */}
              <div className="absolute -top-10 px-2.5 py-1 rounded-lg bg-[#3D3535] text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-lg">
                {item.title}
              </div>

              {/* DOCK BUTTON */}
              <button
                onClick={() => onAppClick(item.id)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all duration-200 transform group-hover:scale-115 group-hover:-translate-y-1.5 ${
                  isActive
                    ? 'bg-[#FFF0F3] border border-[#F4C2C2] shadow-[0_2px_8px_rgba(244,194,194,0.4)]'
                    : 'bg-white/60 border border-[#F0E6DF] hover:bg-white hover:border-[#E8DFC8]'
                }`}
              >
                <span>{item.icon}</span>
              </button>

              {/* DOCK ACTIVE DOT */}
              {item.isOpen && (
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1 transition ${
                    item.isMinimized ? 'bg-[#A39292]' : 'bg-[#D87093] shadow-[0_0_6px_#D87093]'
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
