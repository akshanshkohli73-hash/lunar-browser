import React, { useState } from 'react';

export interface WindowState {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface WindowProps {
  windowState: WindowState;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
}

export const Window: React.FC<WindowProps> = ({
  windowState,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onUpdatePosition,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  if (!windowState.isOpen || windowState.isMinimized) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus(windowState.id);
    if ((e.target as HTMLElement).closest('.window-titlebar')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - windowState.position.x,
        y: e.clientY - windowState.position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !windowState.isMaximized) {
      onUpdatePosition(windowState.id, {
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(28, e.clientY - dragOffset.y),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const style: React.CSSProperties = windowState.isMaximized
    ? {
        position: 'absolute',
        top: 28,
        left: 0,
        right: 0,
        bottom: 68,
        zIndex: windowState.zIndex,
      }
    : {
        position: 'absolute',
        top: windowState.position.y,
        left: windowState.position.x,
        width: windowState.size.width,
        height: windowState.size.height,
        zIndex: windowState.zIndex,
      };

  return (
    <div
      style={style}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="flex flex-col bg-[#FAF7F2] border border-[#EADFD5] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] overflow-hidden transition-shadow duration-200"
    >
      {/* COQUETTE MACOS WINDOW TITLE BAR */}
      <div className="window-titlebar flex items-center justify-between h-9 px-3.5 bg-[#FAF7F2] border-b border-[#EADFD5] select-none cursor-move">
        {/* TRAFFIC LIGHTS */}
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={() => onClose(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#FFB3BA] hover:bg-[#FF8B94] border border-[#FF8B94] flex items-center justify-center text-[8px] text-[#3D3535] font-bold transition"
            title="Close"
          >
            ✕
          </button>
          <button
            onClick={() => onMinimize(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#FFDFBA] hover:bg-[#FFC98B] border border-[#FFC98B] flex items-center justify-center text-[8px] text-[#3D3535] font-bold transition"
            title="Minimize"
          >
            ⎯
          </button>
          <button
            onClick={() => onMaximize(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#BAFFC9] hover:bg-[#8BFF9F] border border-[#8BFF9F] flex items-center justify-center text-[8px] text-[#3D3535] font-bold transition"
            title="Maximize"
          >
            ▢
          </button>
        </div>

        {/* TITLE */}
        <div className="flex items-center gap-2 font-medium text-xs text-[#3D3535]">
          <span>{windowState.icon}</span>
          <span>{windowState.title}</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-[#D87093]">
          <span>🎀</span>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden relative bg-[var(--lunar-bg, #FAF7F2)]">
        {windowState.component}
      </div>
    </div>
  );
};

export default Window;
