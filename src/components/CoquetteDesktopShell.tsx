import React from 'react';
import CoquetteDesktopPortfolio from './CoquetteDesktopPortfolio';
import App from './App';

export const CoquetteDesktopShell: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#faf7f2] font-sans select-none relative">
      {/* RECOVERED 21ST.DEV COQUETTE DESKTOP PORTFOLIO ENGINE */}
      <CoquetteDesktopPortfolio
        headline="Lunar Browser"
        eyebrow="Private. Intelligent. Beautiful."
        height="100vh"
        accent="#f4b6cb"
        deep="#7d1d45"
        openOnLoad={null}
      />

      {/* LUNAR BROWSER INTEGRATED APPLICATION WINDOW OVERLAY */}
      <div className="absolute inset-x-4 top-8 bottom-20 z-30 pointer-events-none flex items-center justify-center">
        <div className="w-full h-full max-w-[1280px] max-h-[820px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-[#eadfd5] overflow-hidden pointer-events-auto flex flex-col">
          {/* DESKTOP INTEGRATED WINDOW HEADER */}
          <div className="h-8 px-3 bg-[#faf7f2] border-b border-[#eadfd5] flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ffb3ba] border border-[#ff8b94]" />
              <div className="w-3 h-3 rounded-full bg-[#ffdfba] border border-[#ffc98b]" />
              <div className="w-3 h-3 rounded-full bg-[#baffc9] border border-[#8bff9f]" />
            </div>
            <div className="text-xs font-semibold text-[#4a3e3e] flex items-center gap-1.5">
              <span>🎀</span>
              <span>Lunar Browser — Private AI Web Browser</span>
            </div>
            <div className="text-xs text-[#a39292]">macOS Desktop</div>
          </div>

          {/* BROWSER CONTENT */}
          <div className="flex-1 overflow-hidden relative w-full h-full min-w-0 min-h-0">
            <App />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoquetteDesktopShell;
