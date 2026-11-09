import { LiquidEngine, type LiquidStatus } from "../liquid/LiquidEngine";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_GLASS,
  MATERIAL_COLORS,
  adaptiveGlassTone,
  type GlassSettings,
  type WallpaperAppearance,
} from "../../shared/glass";
import type { Wallpaper } from "../../shared/dashboard";
import { LUNAR_MOTION } from "../../shared/motion";
import { useWorkspaceActivity } from "./WorkspaceActivity";
import { createGlassInteractions } from "../components/ui/glass-interaction";

export const wallpaperIdentity = (value: Wallpaper) =>
  `${value.kind}:${value.kind === "builtin" ? value.builtin : value.mediaId}`;
function defaultAppearance(
  wallpaper: Wallpaper,
  dark: boolean,
): WallpaperAppearance {
  if (wallpaper.kind !== "builtin")
    return {
      color: dark ? "#264239" : "#c5d9b8",
      luminance: dark ? 0.08 : 0.65,
      source: "theme",
    };
  return wallpaper.builtin === "midnight"
    ? { color: "#263d41", luminance: 0.05, source: "preset" }
    : wallpaper.builtin === "rose"
      ? { color: "#e7d5c9", luminance: 0.7, source: "preset" }
      : { color: "#bed1b0", luminance: 0.64, source: "preset" };
}
export type MaterialPreferences = {
  motion: boolean;
  transparency: boolean;
  forcedColors: boolean;
  finePointer: boolean;
  svg: boolean;
  blur: boolean;
};
function useMaterialCapabilities(): MaterialPreferences {
  const [preferences, setPreferences] = useState<MaterialPreferences>({
    motion: false,
    transparency: false,
    forcedColors: false,
    finePointer: false,
    svg: false,
    blur: true,
  });
  useEffect(() => {
    const queries = [
      "(prefers-reduced-motion: reduce)",
      "(prefers-reduced-transparency: reduce)",
      "(forced-colors: active)",
      "(hover: hover) and (pointer: fine)",
    ].map((query) => window.matchMedia?.(query));
    const update = () =>
      setPreferences({
        motion: !!queries[0]?.matches,
        transparency: !!queries[1]?.matches,
        forcedColors: !!queries[2]?.matches,
        finePointer: !!queries[3]?.matches,
        svg:
          typeof CSS !== "undefined" &&
          !!CSS.supports?.("backdrop-filter", 'url("#lunar-optical-probe")'),
        blur:
          typeof CSS === "undefined" ||
          !CSS.supports ||
          CSS.supports("backdrop-filter", "blur(1px)"),
      });
    update();
    for (const query of queries) query?.addEventListener("change", update);
    return () => {
      for (const query of queries) query?.removeEventListener("change", update);
    };
  }, []);
  return preferences;
}
const noop = () => {};
const defaultPreferences: MaterialPreferences = {
  motion: false,
  transparency: false,
  forcedColors: false,
  finePointer: false,
  svg: false,
  blur: true,
};
const Material = createContext({
  settings: DEFAULT_GLASS,
  engine: null as LiquidEngine | null,
  liquidStatus: {
    supported: false,
    active: false,
    reason: "unmounted",
  } as LiquidStatus,
  chromeBlur: 12,
  tone: "light" as "light" | "dark",
  appearance: {
    color: "#c5d9b8",
    luminance: 0.65,
    source: "theme",
  } as WallpaperAppearance,
  reduced: false,
  foreground: true,
  preferences: defaultPreferences,
  filterPrefix: "",
  overlayCount: 0,
  reportAppearance: (_key: string, _value: WallpaperAppearance) => {},
  registerOverlay: (): (() => void) => noop,
});
export const useGlassMaterial = () => useContext(Material);

/** Single opt-in, deterministic SVG filter bank. SourceGraphic is Chromium's backdrop
 * texture, including the existing video element; no frame copies or render loops. */
function OpticalFilters({ prefix }: { prefix: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className="glass-optical-defs">
      <defs>
        {Array.from({ length: 10 }, (_, i) => (
          <filter
            key={i}
            id={`${prefix}-${i + 1}`}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014 0.02"
              numOctaves={1}
              seed={23}
              result="organic-map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="organic-map"
              scale={(i + 1) * 0.8}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
export function GlassMaterialProvider({
  children,
  settings,
  wallpaper,
  text,
  category,
  reducedMotion,
  chromeBlur = 12,
}: {
  children: ReactNode;
  settings: GlassSettings;
  wallpaper: Wallpaper;
  text: "theme" | "light" | "dark";
  category: string;
  reducedMotion: boolean;
  chromeBlur?: number;
}) {
  const [engine] = useState(() => new LiquidEngine());
  const [liquidStatus, setLiquidStatus] = useState<LiquidStatus>({
    supported: false,
    active: false,
    reason: "initializing",
  });
  useLayoutEffect(() => {
    engine.mount(document);
    const unsubscribe = engine.subscribe(setLiquidStatus);
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);
  const preferences = useMaterialCapabilities();
  const foreground = useWorkspaceActivity();
  const prefix = `lunar-optic-${useId().replace(/[^a-z0-9_-]/giu, "")}`;
  const key = wallpaperIdentity(wallpaper),
    latestKey = useRef(key);
  latestKey.current = key;
  const [sample, setSample] = useState<{
    key: string;
    appearance: WallpaperAppearance;
  } | null>(null);
  const fallbackAppearance = useMemo(
    () => defaultAppearance(wallpaper, ["dark", "cyber"].includes(category)),
    [key, category],
  );
  const appearance =
    sample?.key === key ? sample.appearance : fallbackAppearance;
  const tone = adaptiveGlassTone(text, category, appearance, settings.adaptive);
  const reportAppearance = useCallback(
    (key: string, appearance: WallpaperAppearance) => {
      if (key === latestKey.current)
        setSample((previous) =>
          previous?.key === key &&
          previous.appearance.color === appearance.color
            ? previous
            : { key, appearance },
        );
    },
    [],
  );
  const [overlayCount, setOverlayCount] = useState(0);
  const registerOverlay = useCallback(() => {
    setOverlayCount((count) => count + 1);
    return () => setOverlayCount((count) => Math.max(0, count - 1));
  }, []);
  const reduced = reducedMotion || settings.reducedMotion || preferences.motion;
  useEffect(
    () =>
      engine.update({
        settings,
        reduced,
        foreground,
        transparency: preferences.transparency,
        forcedColors: preferences.forcedColors,
        finePointer: preferences.finePointer,
        identity: key,
      }),
    [
      engine,
      settings,
      reduced,
      foreground,
      preferences.transparency,
      preferences.forcedColors,
      preferences.finePointer,
      key,
    ],
  );
  const lighting =
    foreground &&
    settings.enabled &&
    settings.performance !== "simple" &&
    !reduced &&
    !preferences.transparency &&
    !preferences.forcedColors &&
    preferences.finePointer;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.effectsQuality = settings.performance;
    root.style.setProperty(
      "--organic-press-scale",
      String(LUNAR_MOTION.pressScale),
    );
    root.style.setProperty(
      "--organic-dock-scale",
      String(LUNAR_MOTION.dockScale),
    );
    root.dataset.materialTone = tone;
    root.style.setProperty("--organic-ink", MATERIAL_COLORS[tone].ink);
    root.style.setProperty("--organic-muted", MATERIAL_COLORS[tone].muted);
    root.style.setProperty("--organic-paper", MATERIAL_COLORS[tone].paper);
    root.dataset.glassHoverMotion = String(
      settings.hoverMotion && !reduced && foreground && preferences.finePointer,
    );
    root.dataset.glassPointer = String(lighting);
    root.style.setProperty(
      "--organic-duration",
      `${180 / settings.animationSpeed}ms`,
    );
    root.style.setProperty(
      "--organic-fade-duration",
      `${LUNAR_MOTION.crossfadeMs / settings.animationSpeed}ms`,
    );
    root.style.setProperty(
      "--organic-hover-y",
      `${LUNAR_MOTION.hoverY * settings.elevation}px`,
    );
  }, [
    tone,
    foreground,
    preferences.finePointer,
    settings.performance,
    settings.hoverMotion,
    settings.animationSpeed,
    settings.elevation,
    reduced,
    lighting,
  ]);
  useEffect(
    () =>
      lighting
        ? createGlassInteractions(document, settings.animationSpeed, {
            clock: engine.clock,
            move: engine.interaction.move,
            reset: engine.interaction.reset,
          })
        : undefined,
    [lighting, settings.animationSpeed, engine],
  );
  const value = useMemo(
    () => ({
      settings,
      engine,
      liquidStatus,
      chromeBlur,
      tone,
      appearance,
      reduced,
      foreground,
      preferences,
      filterPrefix: prefix,
      overlayCount,
      reportAppearance,
      registerOverlay,
    }),
    [
      settings,
      engine,
      liquidStatus,
      chromeBlur,
      tone,
      appearance,
      reduced,
      foreground,
      preferences,
      prefix,
      overlayCount,
      reportAppearance,
      registerOverlay,
    ],
  );
  return (
    <Material.Provider value={value}>
      {preferences.svg && <OpticalFilters prefix={prefix} />}
      {children}
    </Material.Provider>
  );
}
