import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { AtomicFile } from "../services/atomic-file";

/** Validated startup recovery + serialized asynchronous durable mutations.
 * One owner per file. This never mixes asynchronous writes with AtomicFile.write.
 */
export class ShieldProfileFile<T> {
  private value: T;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private filename: string,
    private schema: z.ZodType<T>,
    fallback: T,
    warn: (message: string) => void = () => {},
    migrate?: (input: unknown) => unknown,
  ) {
    this.value = new AtomicFile(
      filename,
      schema,
      fallback,
      warn,
      migrate,
    ).read();
  }
  read(): T {
    return structuredClone(this.value);
  }
  update(change: (value: T) => T, privateWrite = false): Promise<T> {
    const operation = this.tail.then(async () => {
      const next = this.schema.parse(change(this.read()));
      const text = JSON.stringify(next);
      if (Buffer.byteLength(text) > 16 * 1024 * 1024)
        throw new Error("Shield data exceeds the 16 MiB profile limit.");
      const previous = JSON.stringify(this.value);
      await this.replace(text, privateWrite ? text : previous, previous);
      this.value = next;
      return this.read();
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  write(value: T, privateWrite = false) {
    const copy = structuredClone(value);
    return this.update(() => copy, privateWrite);
  }
  idle(): Promise<void> {
    return this.tail.then(() => {});
  }
  private async replace(text: string, backup: string, previous: string) {
    const temporary = `${this.filename}.${randomUUID()}.tmp`,
      backupTemp = `${temporary}.bak`;
    let backupReplaced = false;
    const write = async (filename: string, value: string) => {
      const file = await fs.promises.open(filename, "wx", 0o600);
      try {
        await file.writeFile(value, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
    };
    try {
      await write(temporary, text);
      // Recovery copies are atomically replaced too. No partially written backup.
      await write(backupTemp, backup);
      await fs.promises.rename(backupTemp, `${this.filename}.bak`);
      backupReplaced = true;
      await fs.promises.rename(temporary, this.filename);
    } catch {
      // A private write also refreshes recovery copies to prevent deleted data
      // resurfacing. If its primary replacement fails, that uncommitted backup
      // must not later resurrect an unacknowledged rule or sensitive Allow.
      if (backupReplaced) {
        try {
          await write(backupTemp, previous);
          await fs.promises.rename(backupTemp, `${this.filename}.bak`);
        } catch {
          // Prefer no backup to recovering an uncommitted policy. The validated
          // previous primary remains untouched when its replacement failed.
          await fs.promises.unlink(`${this.filename}.bak`).catch(() => {});
        }
      }
      throw new Error(
        `Could not save ${path.basename(this.filename)}. Check disk space and profile permissions.`,
      );
    } finally {
      await Promise.all(
        [temporary, backupTemp].map((file) =>
          fs.promises.unlink(file).catch(() => {}),
        ),
      );
    }
  }
  async purgeRecoveryCopies() {
    await this.idle();
    const prefix = `${path.basename(this.filename)}.corrupt-`;
    for (const name of await fs.promises.readdir(path.dirname(this.filename))) {
      if (
        !name.startsWith(prefix) ||
        !/^\d+(?:-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})?$/iu.test(
          name.slice(prefix.length),
        )
      )
        continue;
      const file = path.join(path.dirname(this.filename), name);
      if ((await fs.promises.lstat(file)).isFile())
        await fs.promises.unlink(file);
    }
  }
}
