import React, { useState, useEffect } from 'react';
import CoquetteDesktopPortfolio from './CoquetteDesktopPortfolio';
import App from './App';
import SettingsView from './SettingsView';
import ExtensionsView from './ExtensionsView';
import ThemeStudioView from './ThemeStudioView';
import NotesView from './NotesView';
import { BUILTIN_THEMES, applyThemeTokens, ThemeTokens } from '../styles/themes';

export const CoquetteDesktopShell: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeTokens>(BUILTIN_THEMES['lunar-coquette']);

  useEffect(() => {
    applyThemeTokens(currentTheme);
  }, [currentTheme]);

  const ThemeStudioWrapper: React.FC = () => (
    <ThemeStudioView
      currentTheme={currentTheme}
      onThemeChange={(newTheme) => {
        setCurrentTheme(newTheme);
        applyThemeTokens(newTheme);
      }}
    />
  );

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#faf7f2] font-sans select-none relative">
      <CoquetteDesktopPortfolio
        browserComponent={App}
        themeStudioComponent={ThemeStudioWrapper}
        settingsComponent={SettingsView}
        notesComponent={NotesView}
        extensionsComponent={ExtensionsView}
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
