import { useEffect, useState } from "react";
const HISTORY_CLEARED = "lunar:history-cleared";
/** Invalidates local UI caches only after the main process confirms a clear. */
export function announceHistoryCleared() {
  window.dispatchEvent(new Event(HISTORY_CLEARED));
}
export function useHistoryRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const cleared = () => setRevision((value) => value + 1);
    window.addEventListener(HISTORY_CLEARED, cleared);
    return () => window.removeEventListener(HISTORY_CLEARED, cleared);
  }, []);
  return revision;
}
