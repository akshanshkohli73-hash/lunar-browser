import App from "./App";
import LunarDesktop from "./LunarDesktop";
import { WorkspaceActivity } from "../state/WorkspaceActivity";
import { BrowserProvider } from "../state/BrowserContext";

/** The original Coquette frame surrounds one permanently mounted browser workspace. */
export default function CoquetteDesktopShell() {
  return (
    <BrowserProvider>
      <WorkspaceActivity active>
        <LunarDesktop browserComponent={App} />
      </WorkspaceActivity>
    </BrowserProvider>
  );
}
