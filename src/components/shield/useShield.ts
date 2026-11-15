import { useCallback, useEffect, useRef, useState } from "react";
import type { ShieldState } from "../../../electron/types";
import { isWebUrl } from "../../../shared/navigation";
import { useBrowser } from "../../state/BrowserContext";

export function useShield(url: string) {
  const { api, shield: signal } = useBrowser();
  const origin = isWebUrl(url) ? new URL(url).origin : undefined;
  const [state, setState] = useState<ShieldState | null>(null);
  const [loading, setLoading] = useState(!!api),
    [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lifecycle = useRef({
    live: true,
    origin,
    epoch: 0,
    issued: 0,
    accepted: 0,
    running: false,
  });
  if (lifecycle.current.origin !== origin) {
    lifecycle.current.origin = origin;
    lifecycle.current.epoch++;
  }
  useEffect(() => {
    lifecycle.current.live = true;
    return () => {
      lifecycle.current.live = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (!api) {
      setLoading(false);
      return;
    }
    const issued = ++lifecycle.current.issued,
      epoch = lifecycle.current.epoch;
    const current = () =>
      lifecycle.current.live &&
      lifecycle.current.epoch === epoch &&
      lifecycle.current.origin === origin &&
      issued > lifecycle.current.accepted;
    try {
      const next = await api.getShieldState(origin);
      if (current()) {
        lifecycle.current.accepted = issued;
        setState(next || null);
        setReadError("");
        setLoading(false);
      }
    } catch (failure) {
      if (current()) {
        setReadError(
          failure instanceof Error
            ? failure.message
            : "Protection state could not be read.",
        );
        setLoading(false);
      }
    }
  }, [api, origin]);
  const latestLoad = useRef(load);
  latestLoad.current = load;
  useEffect(() => {
    setLoading(!!api);
    setReadError("");
    setError("");
    setMessage("");
  }, [api, origin]);
  useEffect(() => {
    void load();
  }, [load, signal]);
  const run = useCallback(
    async (
      operation: () => Promise<unknown>,
      success = "Saved. New requests use this policy; reload the page if needed.",
    ) => {
      if (lifecycle.current.running || !lifecycle.current.live) return false;
      lifecycle.current.running = true;
      const epoch = lifecycle.current.epoch;
      const current = () =>
        lifecycle.current.live && epoch === lifecycle.current.epoch;
      setBusy(true);
      setError("");
      setMessage("");
      let ok = false;
      try {
        const result = await operation();
        ok = result !== false;
        if (current()) setMessage(ok ? success : "Cancelled. No changes made.");
      } catch (failure) {
        if (current())
          setError(
            failure instanceof Error
              ? failure.message
              : "The operation failed.",
          );
      } finally {
        // If the user selected another origin during the native operation, read
        // that current origin rather than allowing an old-origin reply to win.
        if (lifecycle.current.live) await latestLoad.current();
        lifecycle.current.running = false;
        if (lifecycle.current.live) setBusy(false);
      }
      return ok;
    },
    [],
  );
  const protection = state?.protection;
  const site =
    protection?.site && protection.site.origin === origin
      ? protection.site
      : null;
  return {
    api,
    state,
    protection,
    site,
    loading,
    busy,
    error: error || readError,
    message,
    run,
    reload: load,
  };
}
export type ShieldView = ReturnType<typeof useShield>;
