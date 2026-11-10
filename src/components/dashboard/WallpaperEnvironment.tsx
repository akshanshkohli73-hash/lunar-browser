import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Wallpaper as WallpaperSettings } from "../../../shared/dashboard";
import { Wallpaper } from "./Wallpaper";

const Environment = createContext<{
  register: (id: string, node: HTMLElement) => () => void;
} | null>(null);

/** One persistent image/video owner in the existing shell, not a second media
 * pipeline. Views register only a controls host; preview reuses its texture. */
export function WallpaperEnvironment({
  value,
  active,
  reduced,
  resumeKey,
  children,
}: {
  value: WallpaperSettings;
  active: boolean;
  reduced: boolean;
  resumeKey: string;
  children: ReactNode;
}) {
  const hosts = useRef(new Map<string, HTMLElement>());
  const [controlsHost, setControlsHost] = useState<HTMLElement | null>(null);
  const register = useCallback((id: string, node: HTMLElement) => {
    hosts.current.set(id, node);
    const sync = () =>
      setControlsHost(
        [...hosts.current.values()].filter((host) => host.isConnected).at(-1) ??
          null,
      );
    sync();
    return () => {
      hosts.current.delete(id);
      sync();
    };
  }, []);
  const scope = useMemo(() => ({ register }), [register]);
  return (
    <Environment.Provider value={scope}>
      <div
        className="lunar-wallpaper-environment"
        data-wallpaper-owner="shell"
        data-wallpaper-active={String(active)}
      >
        <Wallpaper
          value={value}
          active={active}
          reduceMotion={reduced}
          resumeKey={resumeKey}
          controlsHost={controlsHost}
          shell
        />
      </div>
      {children}
    </Environment.Provider>
  );
}

export function useWallpaperControls(active: boolean) {
  const environment = useContext(Environment),
    id = useId();
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (environment && node && active) return environment.register(id, node);
  }, [environment, node, active, id]);
  return { shared: !!environment, controlsRef: setNode };
}
