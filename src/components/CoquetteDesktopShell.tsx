import React from 'react';
import CoquetteDesktopPortfolio from './CoquetteDesktopPortfolio';
import App from './App';

export const CoquetteDesktopShell: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#faf7f2] font-sans select-none relative">
      {/* NATIVE COQUETTE DESKTOP WITH LUNAR BROWSER RENDERED AS REAL WINDOW */}
      <CoquetteDesktopPortfolio
        browserComponent={App}
        headline="Lunar Browser"
        eyebrow="Private. Intelligent. Beautiful."
        height="100vh"
        accent="#f4b6cb"
        deep="#7d1d45"
      />
    </div>
  );
};

export default CoquetteDesktopShell;
