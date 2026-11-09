import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { rgbAppearance, type WallpaperAppearance } from "../../../shared/glass";
import {
  useGlassMaterial,
  wallpaperIdentity,
} from "../../state/GlassMaterialProvider";
import { useReducedMotionPreference } from "../useReducedMotionPreference";
import type { Wallpaper as WallpaperSettings } from "../../../shared/dashboard";
const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">${body}</svg>`)}`;
export const WALLPAPERS = {
  meadow: {
    name: "Coquette meadow",
    url: svg(
      '<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#e5eee4"/><stop offset="1" stop-color="#fbf4df"/></linearGradient><pattern id="p" width="180" height="170" patternUnits="userSpaceOnUse"><path d="M55 120q-12-26 0-40m0 23q-24-8-21-18 20 0 21 18m0-12q21-15 26-7-3 17-26 7" fill="none" stroke="#78967e" stroke-width="2"/><circle cx="55" cy="76" r="10" fill="#f8dfcc"/><circle cx="55" cy="76" r="3" fill="#b59562"/></pattern></defs><path fill="url(#s)" d="M0 0h1600v1000H0z"/><circle cx="1280" cy="160" r="95" fill="#f7e5b3" opacity=".7"/><path d="M0 710q310-300 740-20t860-80v390H0" fill="#c4d4b6"/><path d="M0 850q390-260 880-50t720-40v240H0" fill="#a5bd9e"/><path fill="url(#p)" opacity=".65" d="M0 620h1600v380H0z"/>',
    ),
  },
  rose: {
    name: "Rose stationery",
    url: svg(
      '<defs><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 0h44v44H0z" fill="#faf2eb"/><path d="M0 44h44M44 0v44" stroke="#d3b4b7" opacity=".25"/></pattern></defs><path fill="url(#p)" d="M0 0h1600v1000H0z"/><path d="M0 800q300-260 700-60t900-110v370H0" fill="#e4b8bd" opacity=".5"/><g fill="none" stroke="#a75f6d" stroke-width="5" opacity=".3"><path d="M1220 160q-100-110-125-30t125 30q100-110 125-30t-125 30l-55 130m55-130 65 120"/></g>',
    ),
  },
  midnight: {
    name: "Midnight garden",
    url: svg(
      '<defs><radialGradient id="s"><stop stop-color="#495a68"/><stop offset="1" stop-color="#17252e"/></radialGradient><pattern id="p" width="160" height="180" patternUnits="userSpaceOnUse"><circle cx="28" cy="40" r="1.6" fill="#e2d5bb"/><path d="m110 90 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#a9b9af"/></pattern></defs><path fill="url(#s)" d="M0 0h1600v1000H0z"/><path fill="url(#p)" opacity=".6" d="M0 0h1600v1000H0z"/><path d="M0 870q260-260 700-60t900-90v280H0" fill="#203f3d"/><circle cx="1270" cy="180" r="70" fill="#e3d4b0"/><circle cx="1300" cy="155" r="67" fill="#263842"/>',
    ),
  },
};
const appearances = new Map<string, WallpaperAppearance | null>();
function sampleOnce(
  source: string,
  node: HTMLImageElement | HTMLVideoElement,
): WallpaperAppearance | null {
  if (appearances.has(source)) return appearances.get(source) ?? null;
  let appearance: WallpaperAppearance | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      context.drawImage(node, 0, 0, 8, 8);
      appearance = rgbAppearance(context.getImageData(0, 0, 8, 8).data);
    }
  } catch {
    /* Private media can taint a canvas. Never relax CORS / web security for a tint. */
  }
  if (appearances.size >= 16)
    appearances.delete(appearances.keys().next().value!);
  appearances.set(source, appearance);
  return appearance;
}
export function Wallpaper({
  value,
  active,
  preview = false,
  reduceMotion = false,
}: {
  value: WallpaperSettings;
  active: boolean;
  preview?: boolean;
  reduceMotion?: boolean;
}) {
  const preferred = useReducedMotionPreference();
  const material = useGlassMaterial();
  const motionPaused = reduceMotion || material.reduced || !!preferred;
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [ownsVideo, setOwnsVideo] = useState(!preview);
  useLayoutEffect(() => {
    if (!preview || value.kind !== "video") {
      setOwnsVideo(!preview);
      return;
    }
    const update = () =>
      setOwnsVideo(!document.querySelector(".new-tab-dashboard video"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [preview, value.kind, value.mediaId]);
  const [foreground, setForeground] = useState(() => !document.hidden);
  const [error, setError] = useState(""),
    [muted, setMuted] = useState(true),
    [paused, setPaused] = useState(motionPaused);
  useEffect(() => {
    const visible = () => setForeground(!document.hidden);
    const blur = () => setForeground(false),
      focus = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  }, []);
  const playing = active && foreground && !paused;
  const available = useRef(active && foreground);
  available.current = active && foreground;
  const fail = (node: HTMLVideoElement, failure?: unknown) => {
    if (video.current !== node || (failure !== undefined && !available.current))
      return;
    setPaused(true); // A rejected play/decoder failure must offer Play, never a stale Pause.
    const name =
      failure && typeof failure === "object" && "name" in failure
        ? failure.name
        : "";
    if (name === "AbortError") return;
    if (name === "NotAllowedError") {
      setError(
        "Playback was blocked by autoplay policy. Use Play wallpaper to start muted playback.",
      );
      return;
    }
    const code = node.error?.code;
    setError(
      code === 2
        ? "The local video could not be read. Choose the file again."
        : code === 3
          ? "The video decoder failed. Try H.264 MP4 or VP8/VP9 WebM."
          : code === 4
            ? "The file is unavailable or its container/codec is unsupported. Try H.264 MP4 or VP8/VP9 WebM."
            : "Playback could not start. Choose a readable, supported local video.",
    );
  };
  const start = (node: HTMLVideoElement) => {
    node.muted = true;
    setMuted(true);
    void node.play().catch((failure) => fail(node, failure));
  };
  useEffect(() => {
    setError("");
    setMuted(true);
    setPaused(motionPaused);
  }, [value.mediaId, motionPaused, ownsVideo]);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    // Restoring visibility never autoplays audio, even after an earlier manual unmute.
    node.muted = true;
    setMuted(true);
    let live = true;
    if (playing && node.paused)
      void node.play().catch((failure) => {
        if (live) fail(node, failure);
      });
    else if (!playing) node.pause();
    return () => {
      live = false;
    };
  }, [playing, value.mediaId, value.kind, ownsVideo]);
  // Only a source change/unmount owns cleanup. Do not pause a synchronous user-
  // initiated Play again during the previous playback effect's cleanup.
  useEffect(() => {
    const node = video.current;
    return () => {
      node?.pause();
    };
  }, [value.mediaId, value.kind, ownsVideo]);
  useEffect(() => {
    if (!value.audioControls && video.current) {
      video.current.muted = true;
      setMuted(true);
    }
  }, [value.audioControls, ownsVideo]);
  const style = {
    objectFit: value.fit,
    objectPosition: value.position,
    filter: `blur(${value.blur}px)`,
  } as CSSProperties;
  const source =
    value.kind === "builtin"
      ? WALLPAPERS[value.builtin].url
      : `lunar-media://wallpaper/${value.mediaId}`;
  useEffect(() => {
    const node = value.kind === "video" ? video.current : image.current;
    if (!node || !material.engine) return;
    return material.engine.registerBackground(node, {
      identity: source,
      active: active && foreground,
      priority: preview ? 1 : 10,
      fit: value.fit,
      position: value.position,
      blur: value.blur,
      shade: value.overlay,
    });
  }, [
    material.engine,
    source,
    value.kind,
    value.fit,
    value.position,
    value.blur,
    value.overlay,
    active,
    foreground,
    ownsVideo,
    preview,
  ]);
  const previous = useRef({ source, kind: value.kind, style });
  const [outgoing, setOutgoing] = useState<{
    source: string;
    style: CSSProperties;
  } | null>(null);
  const fadeMs = 200 / material.settings.animationSpeed;
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { source, kind: value.kind, style };
    if (before.source === source || motionPaused || !value.effects) {
      setOutgoing(null);
      return;
    }
    // Images crossfade for a bounded interval. Video is never cloned for a transition.
    if (before.kind !== "video" && value.kind !== "video")
      setOutgoing({ source: before.source, style: before.style });
    else setOutgoing(null);
    const timer = window.setTimeout(() => setOutgoing(null), fadeMs);
    return () => window.clearTimeout(timer);
  }, [
    source,
    motionPaused,
    value.effects,
    value.kind,
    value.fit,
    value.position,
    value.blur,
    fadeMs,
  ]);
  const loaded = (node: HTMLImageElement | HTMLVideoElement) => {
    if (value.kind === "builtin") return; // Authoritative, deterministic preset metadata.
    const appearance = sampleOnce(source, node);
    if (appearance)
      material.reportAppearance(wallpaperIdentity(value), appearance);
  };
  return (
    <>
      <div
        className={`dashboard-wallpaper ${value.effects && !motionPaused ? "has-soft-transitions" : ""}`}
        data-wallpaper-source={value.kind}
        style={{ "--wallpaper-fade-ms": `${fadeMs}ms` } as CSSProperties}
        aria-hidden="true"
      >
        {value.kind === "video" && preview && !ownsVideo ? (
          <div
            className="liquid-video-preview"
            data-liquid-view="video"
            aria-label="Shared live video wallpaper preview"
          >
            <p className="liquid-video-fallback">
              Video preview shares the desktop player. Live optical preview
              requires an available Liquid Engine.
            </p>
          </div>
        ) : value.kind === "video" ? (
          <video
            key={source}
            ref={video}
            crossOrigin="anonymous"
            src={source}
            style={style}
            loop={value.loop}
            muted={muted}
            playsInline
            preload={active ? "metadata" : "none"}
            onLoadedData={(event) => loaded(event.currentTarget)}
            onError={(event) => fail(event.currentTarget)}
            onEnded={() => setPaused(true)}
          />
        ) : (
          <img
            key={source}
            ref={image}
            crossOrigin="anonymous"
            src={source}
            alt=""
            style={style}
            onLoad={(event) => loaded(event.currentTarget)}
            onError={() =>
              setError(
                "The local image could not be read. Choose it again or reset the wallpaper.",
              )
            }
          />
        )}
        {outgoing && (
          <img
            className="wallpaper-outgoing"
            src={outgoing.source}
            style={outgoing.style}
            alt=""
          />
        )}
        <div
          className="dashboard-wallpaper-shade"
          style={{ opacity: value.overlay }}
        />
      </div>
      {error && (
        <p className="wallpaper-error" role="status">
          This wallpaper could not load or play. {error}
        </p>
      )}
      {value.kind === "video" && (!preview || ownsVideo) && (
        <div className="wallpaper-playback">
          <button
            disabled={!active || !foreground}
            onClick={() => {
              const node = video.current;
              if (!node) return;
              if (!paused) {
                setPaused(true);
                node.pause();
                return;
              }
              setError("");
              if (node.error) node.load();
              setPaused(false);
              start(node); // Keep the browser's user activation: do not defer Play to an effect.
            }}
          >
            {paused ? "Play wallpaper" : "Pause wallpaper"}
          </button>
          {!preview && (
            <button
              onClick={() => {
                if (video.current && active && foreground) {
                  video.current.muted = !muted;
                  setMuted(!muted);
                }
              }}
              disabled={!playing || !value.audioControls}
              title={
                !value.audioControls
                  ? "Enable manual sound controls in Appearance to unmute."
                  : undefined
              }
            >
              {muted ? "Unmute wallpaper" : "Mute wallpaper"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
