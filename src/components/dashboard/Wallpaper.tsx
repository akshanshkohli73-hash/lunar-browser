import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  const motionPaused = reduceMotion || !!preferred;
  const video = useRef<HTMLVideoElement>(null);
  const [foreground, setForeground] = useState(() => !document.hidden);
  const [error, setError] = useState(false),
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
  useEffect(() => {
    setError(false);
    setMuted(true);
    setPaused(motionPaused);
  }, [value.mediaId, motionPaused]);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    // Restoring visibility never autoplays audio, even after an earlier manual unmute.
    node.muted = true;
    setMuted(true);
    let live = true;
    if (playing)
      void node.play().catch(() => {
        if (live) setError(true);
      });
    else node.pause();
    return () => {
      live = false;
      node.pause();
    };
  }, [playing, value.mediaId, value.kind]);
  useEffect(() => {
    if (!value.audioControls && video.current) {
      video.current.muted = true;
      setMuted(true);
    }
  }, [value.audioControls]);
  const style = {
    objectFit: value.fit,
    objectPosition: value.position,
    filter: `blur(${value.blur}px)`,
  } as CSSProperties;
  const source =
    value.kind === "builtin"
      ? WALLPAPERS[value.builtin].url
      : `lunar-media://wallpaper/${value.mediaId}`;
  return (
    <>
      <div
        className={`dashboard-wallpaper ${value.effects && playing && !motionPaused ? "has-drift" : ""}`}
        aria-hidden="true"
      >
        {value.kind === "video" ? (
          <video
            ref={video}
            src={source}
            style={style}
            loop={value.loop}
            muted
            playsInline
            preload={active ? "metadata" : "none"}
            onError={() => setError(true)}
            onEnded={() => setPaused(true)}
          />
        ) : (
          <img
            src={source}
            alt=""
            style={style}
            onError={() => setError(true)}
          />
        )}
        <div
          className="dashboard-wallpaper-shade"
          style={{ opacity: value.overlay }}
        />
      </div>
      {error && (
        <p className="wallpaper-error" role="status">
          This wallpaper could not load or play. Try Play, choose another
          supported file/codec, or reset to a built-in image.
        </p>
      )}
      {value.kind === "video" && (
        <div className="wallpaper-playback">
          <button
            onClick={() => {
              setError(false);
              setPaused((current) => !current);
            }}
          >
            {paused ? "Play wallpaper" : "Pause wallpaper"}
          </button>
          {value.audioControls && !preview && (
            <button
              onClick={() => {
                if (video.current && active && foreground) {
                  video.current.muted = !muted;
                  setMuted(!muted);
                }
              }}
              disabled={!playing}
            >
              {muted ? "Unmute wallpaper" : "Mute wallpaper"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
