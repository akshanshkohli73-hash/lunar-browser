import { net } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { FilterListStatus } from "../types";
import type { CustomSubscription, ShieldSource } from "../../shared/shield";
import { ShieldProfileFile } from "./profile-file";
import { FilterEngine, FILTER_LIMIT_BYTES } from "./filter-engine";
import { compileInWorker, type FilterCompiler } from "./compiler";
import { FILTER_SOURCES, customSource } from "./sources";
import { readResponseText } from "../services/response-text";
const ENGINE = "ghostery-2.20.1-network-v2";
const INTERVAL = 24 * 60 * 60 * 1000;
const digest = (input: string | Uint8Array) =>
  createHash("sha256").update(input).digest("hex");
const cachedFileSchema = z
  .object({
    text: z.string().max(FILTER_LIMIT_BYTES),
    etag: z.string().max(512).optional(),
  })
  .strict();
const cacheSchema = z
  .object({
    version: z.literal(1),
    engine: z.literal(ENGINE),
    identity: z.string().max(64),
    compiled: z.string().max(14 * 1024 * 1024),
    digest: z.string().max(64),
    files: z.array(cachedFileSchema).max(8),
    rules: z.number().int().min(0).max(200000),
    rejected: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative(),
    updatedAt: z.number().nonnegative(),
    checkedAt: z.number().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    const bytes = Buffer.from(value.compiled, "base64");
    const valid =
      value.rules === 0
        ? !value.compiled && !value.digest && !value.files.length
        : bytes.byteLength <= 10 * 1024 * 1024 &&
          bytes.toString("base64") === value.compiled &&
          digest(bytes) === value.digest &&
          value.files.length > 0;
    if (
      !valid ||
      value.files.reduce(
        (total, file) => total + Buffer.byteLength(file.text),
        0,
      ) > FILTER_LIMIT_BYTES ||
      value.files.some((file) => /[\r\n]/u.test(file.etag || ""))
    )
      context.addIssue({
        code: "custom",
        message: "Invalid compiled filter integrity or source-data bounds.",
      });
  });
type Cache = z.infer<typeof cacheSchema>;
const blank = (source: ShieldSource): Cache => ({
  version: 1,
  engine: ENGINE,
  identity: digest(JSON.stringify(source.urls)),
  compiled: "",
  digest: "",
  files: [],
  rules: 0,
  rejected: 0,
  ignored: 0,
  updatedAt: 0,
  checkedAt: 0,
});
interface Entry {
  source: ShieldSource;
  file: ShieldProfileFile<Cache>;
  cache: Cache;
  updating: boolean;
  error?: string;
}
export class ShieldSubscriptions {
  private entries = new Map<string, Entry>();
  private current: {
    id: string;
    controller: AbortController;
    done: Promise<void>;
  } | null = null;
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;
  private lifecycle = new AbortController();
  constructor(
    private profile: string,
    private engine: FilterEngine,
    private changed: () => void,
    private compile: FilterCompiler = compileInWorker,
    private clock: () => number = Date.now,
  ) {}
  configure(custom: CustomSubscription[]) {
    const sources = [
      ...Object.values(FILTER_SOURCES),
      ...custom.map(customSource),
    ];
    const ids = new Set(sources.map((source) => source.id));
    for (const id of this.entries.keys())
      if (!ids.has(id)) {
        if (this.current?.id === id) this.current.controller.abort();
        this.engine.removeRemote(id);
        this.entries.delete(id);
      }
    for (const source of sources)
      if (!this.entries.has(source.id)) {
        let warning: string | undefined;
        const file = new ShieldProfileFile(
          path.join(this.profile, `shield-list-${source.id}.json`),
          cacheSchema,
          blank(source),
          (message) => {
            warning = message;
          },
        );
        let cache = file.read();
        if (cache.identity !== digest(JSON.stringify(source.urls))) {
          warning = "The source changed; update to obtain compatible rules.";
          cache = blank(source);
        }
        const entry: Entry = {
          source,
          file,
          cache,
          error: warning,
          updating: false,
        };
        if (cache.rules) {
          try {
            const bytes = Buffer.from(cache.compiled, "base64");
            if (digest(bytes) !== cache.digest) throw new Error("digest");
            this.engine.setCompiled(source.id, source.category, bytes);
          } catch {
            entry.cache = blank(source);
            entry.error =
              "The compiled cache is invalid. Update to recover; bundled rules remain available.";
          }
        }
        this.entries.set(source.id, entry);
      }
  }
  async migrateLegacy() {
    for (const [id, filename, schema] of [
      [
        "stevenblack",
        "filter-cache.json",
        z.object({
          domains: z.array(z.string().max(253)).max(200000),
          updatedAt: z.number().nonnegative(),
        }),
      ],
      [
        "easyprivacy",
        "privacy-filter-cache.json",
        z.object({
          text: z.string().max(FILTER_LIMIT_BYTES),
          updatedAt: z.number().nonnegative(),
        }),
      ],
    ] as const) {
      const entry = this.entries.get(id)!;
      if (
        fs.existsSync(path.join(this.profile, `shield-list-${id}.json`)) ||
        entry.cache.rules
      )
        continue;
      try {
        const filenamePath = path.join(this.profile, filename);
        if ((await fs.promises.stat(filenamePath)).size > 16 * 1024 * 1024)
          continue;
        const parsed = schema.parse(
          JSON.parse(await fs.promises.readFile(filenamePath, "utf8")),
        );
        const text =
          "domains" in parsed
            ? parsed.domains.map((domain) => `0.0.0.0 ${domain}`).join("\n")
            : parsed.text;
        if (!text) continue;
        const compiled = await this.compile(
          text,
          entry.source.format,
          this.lifecycle.signal,
        );
        const cache = {
          ...blank(entry.source),
          compiled: Buffer.from(compiled.bytes).toString("base64"),
          digest: digest(compiled.bytes),
          files: [{ text }],
          rules: compiled.rules,
          rejected: compiled.rejected,
          ignored: compiled.ignored,
          updatedAt: parsed.updatedAt,
          checkedAt: parsed.updatedAt,
        };
        await entry.file.write(cache);
        entry.cache = cache;
        this.engine.setCompiled(id, entry.source.category, compiled.bytes);
      } catch (error) {
        if (!(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ))
          entry.error =
            "Legacy list recovery failed. Bundled rules are still available; update this source to recover.";
      }
    }
  }
  status(): FilterListStatus[] {
    return [...this.entries.values()].map(
      ({ source, cache, error, updating }) => ({
        id: source.id,
        name: source.name,
        source: source.homepage,
        license: source.license,
        description: source.description,
        category: source.category,
        format: source.format,
        ruleCount: cache.rules,
        rejected: cache.rejected,
        ignored: cache.ignored,
        updatedAt: cache.updatedAt || null,
        checkedAt: cache.checkedAt || null,
        updating,
        custom: source.custom || false,
        ...(error ? { error } : {}),
      }),
    );
  }
  due(enabled: string[]) {
    return enabled.filter((id) => {
      const entry = this.entries.get(id);
      return (
        entry &&
        (!entry.cache.checkedAt ||
          entry.cache.checkedAt > this.clock() ||
          this.clock() - entry.cache.checkedAt > INTERVAL)
      );
    });
  }
  update(ids: string[]): Promise<void> {
    if (this.disposed)
      return Promise.reject(new Error("The filter service is closing."));
    const selected = [...new Set(ids)].filter((id) => this.entries.has(id));
    if (!selected.length)
      return Promise.reject(
        new Error(
          "Select a maintained or custom source before requesting an update.",
        ),
      );
    const operation = this.tail.then(async () => {
      for (const id of selected) {
        if (this.disposed) break;
        const entry = this.entries.get(id);
        if (entry) await this.updateOne(entry);
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  private async updateOne(entry: Entry) {
    const { source } = entry,
      controller = new AbortController();
    let complete!: () => void;
    const done = new Promise<void>((resolve) => {
      complete = resolve;
    });
    this.current = { id: source.id, controller, done };
    entry.updating = true;
    entry.error = undefined;
    this.changed();
    try {
      const files: Cache["files"] = [];
      let changed = false,
        total = 0;
      for (const [index, url] of source.urls.entries()) {
        const previous = entry.cache.files[index];
        const response = await net.fetch(url, {
          headers: {
            Accept: "application/vnd.github.raw+json, text/plain",
            "User-Agent": "Lunar-Browser",
            ...(previous?.etag ? { "If-None-Match": previous.etag } : {}),
          },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
          redirect: "error",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (response.status === 304 && previous) {
          files.push(previous);
          total += Buffer.byteLength(previous.text);
          if (total > FILTER_LIMIT_BYTES)
            throw new Error("The combined source exceeds the 8 MiB limit.");
          continue;
        }
        if (!response.ok)
          throw new Error(
            `Filter update failed (HTTP ${response.status}). Last-good rules remain active.`,
          );
        const contentType =
          response.headers.get("content-type") || "text/plain";
        if (
          /html|json/iu.test(contentType) &&
          !contentType.includes("github.raw")
        )
          throw new Error(
            "The source returned a page or JSON metadata, not raw filter text.",
          );
        const text = await readResponseText(
          response,
          FILTER_LIMIT_BYTES - total,
        );
        if (!text.trim() || /^\s*[<{]/u.test(text) || text.includes("\u0000"))
          throw new Error(
            "The source did not return valid raw filter text. Last-good rules remain active.",
          );
        total += Buffer.byteLength(text);
        if (total > FILTER_LIMIT_BYTES)
          throw new Error("The combined source exceeds the 8 MiB limit.");
        changed ||= text !== previous?.text;
        const etag = response.headers.get("etag");
        files.push({
          text,
          ...(etag && etag.length <= 512 && !/[\r\n]/u.test(etag)
            ? { etag }
            : {}),
        });
      }
      if (
        this.disposed ||
        controller.signal.aborted ||
        this.entries.get(source.id) !== entry
      )
        return;
      if (!changed && entry.cache.rules) {
        entry.cache = await entry.file.write({
          ...entry.cache,
          files,
          checkedAt: this.clock(),
        });
        return;
      }
      const text = files.map((file) => file.text).join("\n");
      const compiled = await this.compile(
        text,
        source.format,
        controller.signal,
      );
      if (
        this.disposed ||
        controller.signal.aborted ||
        this.entries.get(source.id) !== entry
      )
        return;
      const cache = {
        ...blank(source),
        files,
        compiled: Buffer.from(compiled.bytes).toString("base64"),
        digest: digest(compiled.bytes),
        rules: compiled.rules,
        rejected: compiled.rejected,
        ignored: compiled.ignored,
        updatedAt: this.clock(),
        checkedAt: this.clock(),
      };
      // Do not replace a functioning engine until compiled data has safely persisted.
      const install = this.engine.prepareSource(
        source.id,
        source.category,
        compiled.bytes,
      );
      await entry.file.write(cache);
      if (!this.disposed && this.entries.get(source.id) === entry) {
        install();
        entry.cache = cache;
      }
    } catch (error) {
      if (!this.disposed)
        entry.error =
          error instanceof Error
            ? error.message.slice(0, 350)
            : "Update failed. Last-good rules remain active.";
    } finally {
      entry.updating = false;
      if (this.current?.controller === controller) this.current = null;
      complete();
      if (!this.disposed) this.changed();
    }
  }
  async reset(id: string, remove = false) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown filter source.");
    if (this.current?.id === id) this.current.controller.abort();
    // Queue immediately behind all already-requested updates. A concurrent removal
    // owns the entry from the moment it is deleted, so reset must not recreate it.
    const operation = this.tail.then(async () => {
      if (this.entries.get(id) !== entry) return;
      await entry.file.write(blank(entry.source), true);
      await entry.file.purgeRecoveryCopies();
      entry.cache = blank(entry.source);
      entry.error = undefined;
      this.engine.removeRemote(id);
      if (remove) {
        await entry.file.idle();
        for (const suffix of ["", ".bak"])
          await fs.promises
            .unlink(path.join(this.profile, `shield-list-${id}.json${suffix}`))
            .catch((error) => {
              if (error.code !== "ENOENT") throw error;
            });
      }
      this.changed();
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async remove(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown custom subscription.");
    if (!entry.source.custom)
      throw new Error("Built-in sources cannot be removed.");
    this.entries.delete(id);
    this.engine.removeRemote(id);
    if (this.current?.id === id) this.current.controller.abort();
    const operation = this.tail.then(async () => {
      await entry.file.write(blank(entry.source), true);
      await entry.file.purgeRecoveryCopies();
      for (const suffix of ["", ".bak"])
        await fs.promises
          .unlink(path.join(this.profile, `shield-list-${id}.json${suffix}`))
          .catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
      this.changed();
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async dispose() {
    this.disposed = true;
    this.lifecycle.abort();
    this.current?.controller.abort();
    await this.tail;
  }
}
