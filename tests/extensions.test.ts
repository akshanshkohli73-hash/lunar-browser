import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, Session } from "electron";
import { StorageService } from "../electron/services/storage";
const nativeDialogs = vi.hoisted(() => ({ folder: "", approved: 1 }));
vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: async () => ({
      canceled: false,
      filePaths: [nativeDialogs.folder],
    }),
    showMessageBox: async () => ({ response: nativeDialogs.approved }),
  },
}));
const { ExtensionManager } =
  await import("../electron/extensions/extension-manager");
let profile: string,
  folder: string,
  store: StorageService,
  registry: Map<string, { id: string; name: string; version: string }>,
  session: Session;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-ext-"));
  folder = path.join(profile, "fixture");
  fs.cpSync("tests/fixtures/extension", folder, { recursive: true });
  nativeDialogs.folder = folder;
  nativeDialogs.approved = 1;
  store = new StorageService(profile);
  registry = new Map();
  session = {
    extensions: {
      loadExtension: async (directory: string) => {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(directory, "manifest.json"), "utf8"),
        );
        const extension = {
          id: "fixture",
          name: String(manifest.name),
          version: String(manifest.version),
        };
        registry.set(extension.id, extension);
        return extension;
      },
      getExtension: (id: string) => registry.get(id) ?? null,
      removeExtension: (id: string) => {
        registry.delete(id);
      },
    },
  } as unknown as Session;
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("extension lifecycle (native API behavioral harness)", () => {
  it("loads, unloads, restores disabled state, re-enables and removes from the real registry adapter", async () => {
    const manager = new ExtensionManager(session, store, {} as BrowserWindow);
    const loaded = await manager.loadUnpackedExtension();
    expect(loaded?.enabled).toBe(true);
    expect(registry.size).toBe(1);
    expect(loaded?.compatibility).toBe("PARTIAL");
    expect((await manager.toggleExtension("fixture", false))[0].enabled).toBe(
      false,
    );
    expect(registry.size).toBe(0);
    const restored = new ExtensionManager(
      session,
      new StorageService(profile),
      {} as BrowserWindow,
    );
    await restored.restore();
    expect(restored.getExtensions()[0].enabled).toBe(false);
    await restored.toggleExtension("fixture", true);
    expect(registry.size).toBe(1);
    expect(restored.removeExtension("fixture")).toEqual([]);
    expect(registry.size).toBe(0);
    expect(new StorageService(profile).getExtensions()).toEqual([]);
  });
  it("requires renewed approval when the manifest changes instead of trusting a stored boolean", async () => {
    const manager = new ExtensionManager(session, store, {} as BrowserWindow);
    await manager.loadUnpackedExtension();
    manager.dispose();
    const file = path.join(folder, "manifest.json"),
      manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.permissions = ["storage"];
    fs.writeFileSync(file, JSON.stringify(manifest));
    const restored = new ExtensionManager(session, store, {} as BrowserWindow);
    await restored.restore();
    expect(registry.size).toBe(0);
    expect(restored.getExtensions()[0].error).toContain("manifest changed");
    nativeDialogs.approved = 0;
    await restored.toggleExtension("fixture", true);
    expect(registry.size).toBe(0);
    nativeDialogs.approved = 1;
    await restored.toggleExtension("fixture", true);
    expect(registry.size).toBe(1);
  });
  it("unloads a just-loaded extension if persistence fails and never fabricates an active entry", async () => {
    const manager = new ExtensionManager(session, store, {} as BrowserWindow);
    vi.spyOn(store, "saveExtensions").mockImplementation(() => {
      throw new Error("Could not save");
    });
    await expect(manager.loadUnpackedExtension()).rejects.toThrow(
      "Could not save",
    );
    expect(registry.size).toBe(0);
    expect(manager.getExtensions()).toEqual([]);
  });
});
