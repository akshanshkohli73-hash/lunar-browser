import {
  shell,
  type Session,
  type DownloadItem,
  type WebContents,
  type Event,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { DownloadItemInfo } from "../types";
import type { StorageService } from "../services/storage";

export function safeFilename(value: string): string {
  const clean =
    value
      .replaceAll("\\", "/")
      .split("/")
      .at(-1)
      ?.split("")
      .map((character) =>
        character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
          ? "_"
          : character,
      )
      .join("")
      .replace(/[. ]+$/u, "")
      .slice(0, 200) || "download";
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(clean)
    ? `_${clean}`
    : clean;
}
interface DownloadOptions {
  owns: (id: number) => boolean;
  notify: (items: DownloadItemInfo[]) => void;
  error: (message: string) => void;
  downloadsPath: string;
  onStart: (contentsId: number) => void;
}
export class DownloadManager {
  private active = new Map<string, DownloadItem>();
  private cleanups = new Map<string, () => void>();
  private disposed = false;
  private items: DownloadItemInfo[];
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private session: Session,
    private storage: StorageService,
    private options: DownloadOptions,
  ) {
    this.items = storage.getDownloads().map((item) => ({
      ...item,
      canResume: false,
      canCancel: false,
      speed: 0,
      ...(["progressing", "paused"].includes(item.status)
        ? {
            status: "interrupted" as const,
            error: "Interrupted when the previous application session ended.",
          }
        : {}),
    }));
    session.on("will-download", this.onDownload);
  }
  private onDownload = (event: Event, item: DownloadItem, wc: WebContents) => {
    if (this.disposed || !wc || !this.options.owns(wc.id)) {
      event.preventDefault();
      return;
    }
    if (this.active.size >= 20) {
      event.preventDefault();
      this.options.error(
        "Too many simultaneous downloads. Wait for a download to finish.",
      );
      return;
    }
    this.options.onStart(wc.id);
    const id = `dl_${randomUUID()}`,
      filename = safeFilename(item.getFilename());
    // Chromium's native Save As dialog asks for every destination and confirms overwrites.
    item.setSaveDialogOptions({
      title: "Save download",
      defaultPath: path.join(this.options.downloadsPath, filename),
      buttonLabel: "Save",
      properties: ["showOverwriteConfirmation", "createDirectory"],
    });
    const info: DownloadItemInfo = {
      id,
      filename,
      url: item.getURL().slice(0, 8192),
      savePath: "",
      receivedBytes: 0,
      totalBytes: Math.max(0, item.getTotalBytes()),
      speed: 0,
      canResume: false,
      canCancel: true,
      status: "progressing",
      startTime: Date.now(),
    };
    this.active.set(id, item);
    this.items.push(info);
    this.publish();
    let lastBytes = 0,
      lastTime = Date.now();
    const update = () => {
      const now = Date.now(),
        bytes = item.getReceivedBytes();
      info.speed = Math.max(
        0,
        Math.round(
          (bytes - lastBytes) / Math.max(0.001, (now - lastTime) / 1000),
        ),
      );
      lastBytes = bytes;
      lastTime = now;
      info.receivedBytes = bytes;
      info.totalBytes = Math.max(0, item.getTotalBytes());
      info.savePath = item.getSavePath();
      info.canResume = item.canResume();
    };
    const onUpdated = (_event: Event, state: "interrupted" | "progressing") => {
      if (this.disposed) return;
      update();
      info.status =
        state === "interrupted"
          ? "interrupted"
          : item.isPaused()
            ? "paused"
            : "progressing";
      this.publish();
    };
    const onDone = (
      _event: Event,
      state: "completed" | "cancelled" | "interrupted",
    ) => {
      if (this.disposed) return;
      update();
      info.status = state;
      info.speed = 0;
      info.canResume = false;
      info.canCancel = false;
      if (state === "interrupted")
        info.error = "The download failed. Retry from the original page.";
      this.cleanups.get(id)?.();
      this.cleanups.delete(id);
      this.active.delete(id); // Completed items retain metadata, never native resources.
      this.publish(true);
    };
    this.cleanups.set(id, () => {
      item.removeListener("updated", onUpdated);
      item.removeListener("done", onDone);
    });
    item.on("updated", onUpdated);
    item.once("done", onDone);
  };
  public getDownloads(): DownloadItemInfo[] {
    return structuredClone(this.items).reverse();
  }
  private requireItem(id: string) {
    if (this.disposed) throw new Error("The download manager is closing.");
    const info = this.items.find((item) => item.id === id);
    if (!info) throw new Error("This download is no longer available.");
    return { info, item: this.active.get(id) };
  }
  public cancelDownload(id: string) {
    const { item } = this.requireItem(id);
    if (!item) throw new Error("This download has already ended.");
    item.cancel();
  }
  public pauseDownload(id: string) {
    const { item, info } = this.requireItem(id);
    if (!item || info.status !== "progressing")
      throw new Error("This download cannot be paused.");
    item.pause();
    info.status = "paused";
    info.canResume = item.canResume();
    info.speed = 0;
    this.publish();
  }
  public resumeDownload(id: string) {
    const { item, info } = this.requireItem(id);
    if (!item || !item.canResume())
      throw new Error(
        "This download cannot be resumed. Retry it from its page.",
      );
    item.resume();
    info.status = "progressing";
    info.canResume = false;
    this.publish();
  }
  public revealDownload(id: string) {
    const { info } = this.requireItem(id);
    if (
      info.status !== "completed" ||
      !info.savePath ||
      !path.isAbsolute(info.savePath) ||
      !fs.existsSync(info.savePath)
    )
      throw new Error("The completed file is not available to reveal.");
    shell.showItemInFolder(info.savePath); // Never shell.openPath or execute a downloaded file.
  }
  public clearCompleted() {
    if (this.disposed) throw new Error("The download manager is closing.");
    const next = this.items.filter((item) => this.active.has(item.id));
    this.storage.saveDownloads(next); // Do not claim a cleared archive if the write failed.
    this.items = next;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.options.notify(this.getDownloads());
  }
  private publish(immediate = false) {
    if (this.disposed) return;
    if (this.items.length > 200) {
      const active = this.items.filter((item) => this.active.has(item.id));
      this.items = [
        ...this.items
          .filter((item) => !this.active.has(item.id))
          .slice(-(200 - active.length)),
        ...active,
      ];
    }
    this.options.notify(this.getDownloads());
    if (immediate) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.persist();
    } else
      this.timer ??= setTimeout(() => {
        this.timer = undefined;
        this.persist();
      }, 1000);
  }
  private persist() {
    try {
      this.storage.saveDownloads(this.items.slice(-200));
    } catch (error) {
      this.options.error(
        error instanceof Error
          ? error.message
          : "Could not save download records.",
      );
    }
  }
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.session.removeListener("will-download", this.onDownload);
    if (this.timer) clearTimeout(this.timer);
    for (const [id, item] of this.active) {
      this.cleanups.get(id)?.();
      const info = this.items.find((info) => info.id === id);
      try {
        item.cancel();
        if (info) info.status = "cancelled";
      } catch {
        if (info) {
          info.status = "interrupted";
          info.error = "Interrupted during application shutdown.";
        }
      }
      if (info) {
        info.canCancel = false;
        info.canResume = false;
        info.speed = 0;
      }
    }
    this.cleanups.clear();
    this.active.clear();
    this.persist();
  }
}
