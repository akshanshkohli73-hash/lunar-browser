import CoquetteDesktopPortfolio from "./CoquetteDesktopPortfolio";
import App from "./App";
import SettingsView from "./AsyncSettingsView";
import ExtensionsView from "./ExtensionsView";
import ThemeStudioView from "./AsyncThemeStudio";
import NotesView from "./NotesView";
import { BrowserProvider, useBrowser } from "../state/BrowserContext";
function Desktop() {
  const { theme } = useBrowser();
  return (
    <CoquetteDesktopPortfolio
      browserComponent={App}
      themeStudioComponent={ThemeStudioView}
      settingsComponent={SettingsView}
      notesComponent={NotesView}
      extensionsComponent={ExtensionsView}
      headline="Lunar Browser"
      eyebrow="A little space to explore."
      height="100dvh"
      accent={theme.colors.secondary}
      deep={theme.colors.primary}
    />
  );
}
export default function CoquetteDesktopShell() {
  return (
    <BrowserProvider>
      <Desktop />
    </BrowserProvider>
  );
}
