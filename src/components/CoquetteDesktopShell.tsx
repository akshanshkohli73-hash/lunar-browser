import App from "./App";
import LunarDesktop from "./LunarDesktop";
import { BrowserProvider } from "../state/BrowserContext";

/** The original Coquette frame surrounds one permanently mounted browser workspace. */
export default function CoquetteDesktopShell() {
  return (
    <BrowserProvider>
      <LunarDesktop browserComponent={App} />
    </BrowserProvider>
  );
}
