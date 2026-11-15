import type { SessionState } from "../../shared/schemas";
import type { StorageService } from "./storage";

/** Owns one window's debounced, opt-in tab-session writes. */
export class SessionSaver {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: { state: SessionState; serialized: string } | undefined;
  private disposed = false;
  constructor(
    private storage: Pick<
      StorageService,
      "getSettings" | "getSession" | "saveSession"
    >,
    private report: (message: string) => void,
  ) {}
  public queue(state: SessionState) {
    if (this.disposed) return;
    if (!this.storage.getSettings().restoreSession) {
      this.clearTimer();
      this.pending = undefined;
      return;
    }
    const serialized = JSON.stringify(state);
    // This is a cached, validated read, not disk I/O. Settings opt-in can also
    // save a snapshot; a private marker misses those writes and failed saves.
    if (serialized === JSON.stringify(this.storage.getSession())) {
      this.clearTimer();
      this.pending = undefined;
      return;
    }
    // Duplicate loading events must not postpone the pending write indefinitely.
    // After a failure the timer is absent, so the same snapshot can retry.
    if (this.pending?.serialized === serialized && this.timer !== undefined)
      return;
    this.pending = { state: structuredClone(state), serialized };
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.save();
    }, 500);
  }
  private clearTimer() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private save() {
    if (!this.pending) return;
    if (!this.storage.getSettings().restoreSession) {
      this.pending = undefined;
      return;
    }
    try {
      this.storage.saveSession(this.pending.state);
      this.pending = undefined;
    } catch (error) {
      this.report(
        error instanceof Error ? error.message : "Could not save the session.",
      );
    }
  }
  public dispose(finalState: SessionState) {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    this.pending = {
      state: structuredClone(finalState),
      serialized: JSON.stringify(finalState),
    };
    this.save();
    this.pending = undefined;
  }
}
