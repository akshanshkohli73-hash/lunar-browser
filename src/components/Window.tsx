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
        y: Math.max(30, e.clientY - dragOffset.y),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const style: React.CSSProperties = windowState.isMaximized
    ? {
        position: 'absolute',
        top: 32,
        left: 0,
        right: 0,
        bottom: 80,
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
      className="flex flex-col bg-[var(--lunar-surface)] border border-[var(--lunar-border)] rounded-2xl shadow-2xl overflow-hidden transition-shadow duration-200"
    >
      {/* MACOS WINDOW TITLE BAR */}
      <div className="window-titlebar flex items-center justify-between h-9 px-3 bg-[var(--lunar-bg-secondary)] border-b border-[var(--lunar-border)] select-none cursor-move">
        {/* TRAFFIC LIGHTS */}
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={() => onClose(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#e0443e] border border-[#e0443e] flex items-center justify-center text-[8px] text-black font-bold opacity-80 hover:opacity-100 transition"
            title="Close"
          >
            ✕
          </button>
          <button
            onClick={() => onMinimize(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#dea123] border border-[#dea123] flex items-center justify-center text-[8px] text-black font-bold opacity-80 hover:opacity-100 transition"
            title="Minimize"
          >
            ⎯
          </button>
          <button
            onClick={() => onMaximize(windowState.id)}
            className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#1aab29] border border-[#1aab29] flex items-center justify-center text-[8px] text-black font-bold opacity-80 hover:opacity-100 transition"
            title="Maximize"
          >
            ▢
          </button>
        </div>

        {/* TITLE */}
        <div className="flex items-center gap-2 font-medium text-xs text-[var(--lunar-text)]">
          <span>{windowState.icon}</span>
          <span>{windowState.title}</span>
        </div>

        <div className="w-12" />
      </div>

      {/* WINDOW CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative bg-[var(--lunar-bg)]">
        {windowState.component}
      </div>
    </div>
  );
};

export default Window;
