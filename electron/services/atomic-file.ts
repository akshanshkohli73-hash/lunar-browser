import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

/** Cached, validated JSON with atomic replacement. Memory changes only after a successful write. */
export class AtomicFile<T> {
  private value: T;
  constructor(
    private filename: string,
    private schema: z.ZodType<T>,
    fallback: T,
    private warn: (message: string) => void = () => {},
    migrate?: (value: unknown) => unknown,
  ) {
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.value = structuredClone(fallback);
    if (!fs.existsSync(filename)) return;
    try {
      this.value = this.parse(filename, migrate);
    } catch {
      const quarantine = `${filename}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(filename, quarantine);
        fs.chmodSync(quarantine, 0o600);
      } catch {
        this.warn(
          `Could not preserve the damaged ${path.basename(filename)} file.`,
        );
      }
      this.warn(
        `${path.basename(filename)} was damaged. The original was preserved for recovery.`,
      );
      if (fs.existsSync(`${filename}.bak`)) {
        try {
          this.value = this.parse(`${filename}.bak`, migrate);
          this.warn(
            `Recovered ${path.basename(filename)} from its last valid backup.`,
          );
        } catch {
          this.warn(
            `No valid backup exists for ${path.basename(filename)}. Defaults are in use.`,
          );
        }
      }
    }
  }
  private parse(filename: string, migrate?: (value: unknown) => unknown): T {
    const stat = fs.statSync(filename);
    if (stat.size > 16 * 1024 * 1024)
      throw new Error("Storage file is too large.");
    const parsed: unknown = JSON.parse(fs.readFileSync(filename, "utf8"));
    return this.schema.parse(migrate ? migrate(parsed) : parsed);
  }
  public read(): T {
    return structuredClone(this.value);
  }
  public purgeCorruptCopies(): void {
    const directory = path.dirname(this.filename),
      prefix = path.basename(this.filename) + ".corrupt-";
    try {
      for (const name of fs.readdirSync(directory)) {
        if (
          !name.startsWith(prefix) ||
          !/^\d+$/u.test(name.slice(prefix.length))
        )
          continue;
        const filename = path.join(directory, name);
        if (fs.lstatSync(filename).isFile()) fs.unlinkSync(filename);
      }
    } catch {
      throw new Error(
        `Could not remove recovery copies of ${path.basename(this.filename)}. Check profile permissions.`,
      );
    }
  }
  public write(input: T, preservePrevious = true): T {
    const next = this.schema.parse(input);
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(next, null, 2));
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      // Only validated previous content is placed in the recovery copy.
      if (
        fs.existsSync(this.filename) ||
        fs.existsSync(`${this.filename}.bak`)
      ) {
        fs.writeFileSync(
          `${this.filename}.bak`,
          JSON.stringify(preservePrevious ? this.value : next),
          { mode: 0o600 },
        );
        fs.chmodSync(`${this.filename}.bak`, 0o600);
      }
      fs.renameSync(temporary, this.filename);
      this.value = next;
      return this.read();
    } catch {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      throw new Error(
        `Could not save ${path.basename(this.filename)}. Check disk space and profile permissions.`,
      );
    }
  }
}
