import CoquetteDesktopPortfolio from "./CoquetteDesktopPortfolio";
import App from "./App";
import SettingsView from "./SettingsView";
import ExtensionsView from "./ExtensionsView";
import ThemeStudioView from "./ThemeStudioView";
import NotesView from "./NotesView";
import { BUILTIN_THEMES } from "../styles/themes";
import { BrowserProvider, useBrowser } from "../state/BrowserContext";
function Desktop() {
  const { settings } = useBrowser();
  const theme =
    settings.customTheme ??
    BUILTIN_THEMES[settings.themeId] ??
    BUILTIN_THEMES["lunar-coquette"];
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
