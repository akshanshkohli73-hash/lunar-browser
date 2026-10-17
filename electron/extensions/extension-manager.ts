import { dialog, type BrowserWindow, type Session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ExtensionInfo, ExtensionRecord } from "../types";
import type { StorageService } from "../services/storage";
const manifestSchema = z
  .object({
    name: z.string().min(1).max(200),
    version: z.string().min(1).max(50),
    manifest_version: z.union([z.literal(2), z.literal(3)]),
    description: z.string().max(1000).optional(),
    permissions: z.array(z.string().max(500)).max(200).optional(),
    host_permissions: z.array(z.string().max(500)).max(200).optional(),
    content_scripts: z
      .array(
        z
          .object({ matches: z.array(z.string().max(500)).max(100) })
          .passthrough(),
      )
      .max(100)
      .optional(),
  })
  .passthrough();
export class ExtensionManager {
  private entries = new Map<string, ExtensionInfo>();
  private records: ExtensionRecord[];
  constructor(
    private session: Session,
    private storage: StorageService,
    private window: BrowserWindow,
  ) {
    this.records = storage.getExtensions();
  }
  private inspect(folder: string) {
    const realPath = fs.realpathSync(folder),
      file = path.join(realPath, "manifest.json");
    if (
      !fs.statSync(realPath).isDirectory() ||
      fs.statSync(file).size > 256 * 1024
    )
      throw new Error(
        "Select an extension folder with a manifest smaller than 256 KB.",
      );
    const raw = fs.readFileSync(file, "utf8"),
      manifest = manifestSchema.parse(JSON.parse(raw));
    return {
      realPath,
      manifest,
      hash: createHash("sha256").update(raw).digest("hex"),
      permissions: [
        ...new Set([
          ...(manifest.permissions ?? []),
          ...(manifest.host_permissions ?? []),
          ...(manifest.content_scripts ?? []).flatMap(
            (script) => script.matches,
          ),
        ]),
      ],
    };
  }
  public async restore() {
    for (const record of this.records) {
      try {
        const checked = this.inspect(record.path);
        const info: ExtensionInfo = {
          id: record.id,
          path: record.path,
          name: checked.manifest.name,
          version: checked.manifest.version,
          description: checked.manifest.description ?? "",
          permissions: checked.permissions,
          compatibility: "PARTIAL",
          enabled: false,
        };
        this.entries.set(record.id, info);
        if (record.enabled) {
          if (checked.hash !== record.approvedHash)
            throw new Error(
              "The manifest changed. Enable this extension again to review its permissions.",
            );
          const loaded = await this.session.extensions.loadExtension(
            record.path,
            { allowFileAccess: false },
          );
          if (loaded.id !== record.id) {
            this.session.extensions.removeExtension(loaded.id);
            throw new Error(
              "Extension identity changed. Remove and load it again.",
            );
          }
          info.enabled = !!this.session.extensions.getExtension(loaded.id);
        }
      } catch (error) {
        this.entries.set(record.id, {
          ...(this.entries.get(record.id) ?? {
            id: record.id,
            path: record.path,
            name: path.basename(record.path),
            version: "",
            description: "",
            permissions: [],
            compatibility: "PARTIAL",
          }),
          enabled: false,
          error:
            error instanceof Error
              ? error.message
              : "Extension could not be restored.",
        });
      }
    }
  }
  private async approve(
    checked: ReturnType<ExtensionManager["inspect"]>,
  ): Promise<boolean> {
    const result = await dialog.showMessageBox(this.window, {
      type: "warning",
      title: "Load unpacked extension?",
      message: `Trust ${checked.manifest.name}?`,
      detail: `Extensions can read and change matched pages. Only load code you trust. Electron implements a subset of Chrome extension APIs; Chrome Web Store installation and complete compatibility are not supported.\n\nRequested access:\n${checked.permissions.join("\n").slice(0, 6000) || "No manifest permissions declared."}`,
      buttons: ["Cancel", "Trust and load"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return result.response === 1;
  }
  public async loadUnpackedExtension(): Promise<ExtensionInfo | null> {
    if (this.records.length >= 50)
      throw new Error(
        "Remove an extension before loading another (50 maximum).",
      );
    const result = await dialog.showOpenDialog(this.window, {
      title: "Select unpacked extension folder",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const checked = this.inspect(result.filePaths[0]);
    if (!(await this.approve(checked))) return null;
    return this.loadApproved(checked);
  }
  private async loadApproved(
    checked: ReturnType<ExtensionManager["inspect"]>,
  ): Promise<ExtensionInfo> {
    const previous = this.records.find(
      (record) => record.path === checked.realPath,
    );
    if (
      previous?.approvedHash === checked.hash &&
      this.session.extensions.getExtension(previous.id)
    ) {
      const existing = this.entries.get(previous.id);
      if (existing) return structuredClone(existing);
    }
    const loaded = await this.session.extensions.loadExtension(
      checked.realPath,
      { allowFileAccess: false },
    );
    if (previous && loaded.id !== previous.id) {
      this.session.extensions.removeExtension(loaded.id);
      throw new Error(
        "The extension identity changed. Remove it and load the folder again.",
      );
    }
    const record = {
      id: loaded.id,
      path: checked.realPath,
      enabled: true,
      approvedHash: checked.hash,
    };
    const next = [
      ...this.records.filter((item) => item.id !== loaded.id),
      record,
    ];
    try {
      this.storage.saveExtensions(next);
    } catch (error) {
      this.session.extensions.removeExtension(loaded.id);
      throw error;
    }
    this.records = next;
    const info: ExtensionInfo = {
      id: loaded.id,
      path: checked.realPath,
      name: loaded.name,
      version: loaded.version,
      description: checked.manifest.description ?? "",
      enabled: !!this.session.extensions.getExtension(loaded.id),
      permissions: checked.permissions,
      compatibility: "PARTIAL",
    };
    this.entries.set(info.id, info);
    return structuredClone(info);
  }
  public getExtensions(): ExtensionInfo[] {
    return [...this.entries.values()].map((info) => ({
      ...structuredClone(info),
      enabled: !!this.session.extensions.getExtension(info.id),
    }));
  }
  public async toggleExtension(
    id: string,
    enabled: boolean,
  ): Promise<ExtensionInfo[]> {
    const record = this.records.find((item) => item.id === id);
    if (!record) throw new Error("This extension is no longer installed.");
    if (enabled) {
      const checked = this.inspect(record.path);
      if (
        checked.hash !== record.approvedHash &&
        !(await this.approve(checked))
      )
        return this.getExtensions();
      await this.loadApproved(checked);
    } else {
      const next = this.records.map((item) =>
        item.id === id ? { ...item, enabled: false } : item,
      );
      this.storage.saveExtensions(next);
      try {
        this.session.extensions.removeExtension(id);
      } catch (error) {
        this.storage.saveExtensions(this.records);
        throw error;
      }
      this.records = next;
    }
    return this.getExtensions();
  }
  public removeExtension(id: string): ExtensionInfo[] {
    if (!this.records.some((item) => item.id === id))
      throw new Error("This extension is no longer installed.");
    const next = this.records.filter((item) => item.id !== id);
    this.storage.saveExtensions(next);
    try {
      this.session.extensions.removeExtension(id);
    } catch (error) {
      this.storage.saveExtensions(this.records);
      throw error;
    }
    this.records = next;
    this.entries.delete(id);
    return this.getExtensions();
  }
  public dispose() {
    for (const id of this.entries.keys())
      if (this.session.extensions.getExtension(id))
        this.session.extensions.removeExtension(id);
  }
}
