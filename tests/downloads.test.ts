import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "electron";
import { StorageService } from "../electron/services/storage";
vi.mock("electron", () => ({ shell: { showItemInFolder: () => {} } }));
const { DownloadManager, safeFilename } =
  await import("../electron/downloads/download-manager");
class Item extends EventEmitter {
  received = 0;
  paused = false;
  dialog: unknown;
  cancelled = false;
  getFilename() {
    return "../../CON.exe";
  }
  getURL() {
    return "https://example.com/file";
  }
  getTotalBytes() {
    return 200;
  }
  getReceivedBytes() {
    return this.received;
  }
  getSavePath() {
    return "/downloads/chosen-file.txt";
  }
  isPaused() {
    return this.paused;
  }
  canResume() {
    return this.paused;
  }
  setSaveDialogOptions(options: unknown) {
    this.dialog = options;
  }
  cancel() {
    this.cancelled = true;
    this.emit("done", {}, "cancelled");
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
  }
}
let profile: string,
  session: EventEmitter,
  storage: StorageService,
  manager: InstanceType<typeof DownloadManager>;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-download-"));
  session = new EventEmitter();
  storage = new StorageService(profile);
  manager = new DownloadManager(session as unknown as Session, storage, {
    owns: (id) => id === 7,
    notify: () => {},
    error: () => {},
    downloadsPath: "/downloads",
    onStart: () => {},
  });
});
afterEach(() => {
  manager.dispose();
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("download lifecycle", () => {
  it("uses safe names and a native destination dialog with overwrite confirmation", () => {
    expect(safeFilename("../../CON.exe")).toBe("_CON.exe");
    expect(safeFilename("C:\\path\\file?.txt")).toBe("file_.txt");
    const item = new Item();
    session.emit(
      "will-download",
      {
        preventDefault: () => {
          throw new Error("unexpected denial");
        },
      },
      item,
      { id: 7 },
    );
    expect(item.dialog).toMatchObject({
      defaultPath: "/downloads/_CON.exe",
      properties: ["showOverwriteConfirmation", "createDirectory"],
    });
    expect(manager.getDownloads()[0].status).toBe("progressing");
  });
  it("reports byte progress, pause/resume, cancelled paused tasks, and final actual save paths", () => {
    const item = new Item();
    session.emit("will-download", {}, item, { id: 7 });
    const id = manager.getDownloads()[0].id;
    item.received = 80;
    item.emit("updated", {}, "progressing");
    expect(manager.getDownloads()[0].receivedBytes).toBe(80);
    manager.pauseDownload(id);
    expect(manager.getDownloads()[0].status).toBe("paused");
    manager.resumeDownload(id);
    expect(manager.getDownloads()[0].status).toBe("progressing");
    item.received = 200;
    item.emit("done", {}, "completed");
    expect(manager.getDownloads()[0]).toMatchObject({
      status: "completed",
      savePath: "/downloads/chosen-file.txt",
      receivedBytes: 200,
      speed: 0,
    });
    expect(() => manager.cancelDownload(id)).toThrow("already ended");
    expect(new StorageService(profile).getDownloads()[0].status).toBe(
      "completed",
    );
    const paused = new Item();
    session.emit("will-download", {}, paused, { id: 7 });
    const next = manager.getDownloads()[0].id;
    manager.pauseDownload(next);
    manager.cancelDownload(next);
    expect(manager.getDownloads()[0].status).toBe("cancelled");
  });
  it("rejects downloads without owned web contents and keeps records if clearing fails", () => {
    let denied = false;
    session.emit(
      "will-download",
      {
        preventDefault: () => {
          denied = true;
        },
      },
      new Item(),
      { id: 9 },
    );
    expect(denied).toBe(true);
    expect(manager.getDownloads()).toEqual([]);
    const item = new Item();
    session.emit("will-download", {}, item, { id: 7 });
    item.emit("done", {}, "completed");
    vi.spyOn(storage, "saveDownloads").mockImplementation(() => {
      throw new Error("Disk full");
    });
    expect(() => manager.clearCompleted()).toThrow("Disk full");
    expect(manager.getDownloads()).toHaveLength(1);
  });
});

describe("shutdown ownership", () => {
  it("removes item listeners and cannot write an old archive after a later window starts", () => {
    const item = new Item();
    session.emit("will-download", {}, item, { id: 7 });
    manager.dispose();
    expect(item.listenerCount("updated")).toBe(0);
    expect(item.listenerCount("done")).toBe(0);
    const saved = storage.getDownloads();
    expect(saved[0]).toMatchObject({
      status: "cancelled",
      canCancel: false,
      canResume: false,
    });
    item.emit("updated", {}, "progressing");
    item.emit("done", {}, "completed");
    expect(storage.getDownloads()).toEqual(saved);
  });
});
