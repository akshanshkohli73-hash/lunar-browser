import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
const Activity = createContext(true);
/** One visibility subscription for a workspace, not one per glass surface or video frame. */
export function WorkspaceActivity({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    const visible = () => setForeground(!document.hidden),
      blur = () => setForeground(false);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return (
    <Activity.Provider value={active && foreground}>
      {children}
    </Activity.Provider>
  );
}
export const useWorkspaceActivity = () => useContext(Activity);
