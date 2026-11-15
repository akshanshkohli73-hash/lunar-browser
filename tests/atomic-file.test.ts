import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AtomicFile } from "../electron/services/atomic-file";

const limit = 16 * 1024 * 1024;
const schema = z.object({ text: z.string() }).strict();
let profile: string;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-atomic-limit-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});

describe("profile recovery when the primary is missing", () => {
  it("loads an existing valid backup instead of silently replacing saved data with defaults", () => {
    const filename = path.join(profile, "records.json");
    const store = new AtomicFile(filename, schema, { text: "default" });
    store.write({ text: "recoverable save" });
    store.write({ text: "later save" });
    const backup = fs.readFileSync(`${filename}.bak`);
    fs.unlinkSync(filename);
    const warn = vi.fn();
    const recovered = new AtomicFile(
      filename,
      schema,
      { text: "default" },
      warn,
    );
    expect(recovered.read()).toEqual({ text: "recoverable save" });
    expect(warn).toHaveBeenCalledWith(
      "Recovered records.json from its last valid backup.",
    );
    expect(fs.readFileSync(`${filename}.bak`)).toEqual(backup);
    expect(fs.readdirSync(profile)).toEqual(["records.json.bak"]);
    recovered.write({ text: "new save after recovery" });
    expect(
      new AtomicFile(filename, schema, { text: "default" }).read(),
    ).toEqual({
      text: "new save after recovery",
    });
  });

  it("preserves an invalid orphaned backup and reports defaults without claiming recovery", () => {
    const filename = path.join(profile, "records.json");
    fs.writeFileSync(`${filename}.bak`, '{"text":false}');
    const warn = vi.fn();
    expect(
      new AtomicFile(filename, schema, { text: "default" }, warn).read(),
    ).toEqual({
      text: "default",
    });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "No valid backup exists for records.json. Defaults are in use.",
    );
    expect(fs.readFileSync(`${filename}.bak`, "utf8")).toBe('{"text":false}');
    expect(fs.readdirSync(profile)).toEqual(["records.json.bak"]);
  });
});

describe("profile writes must remain readable on restart", () => {
  it("rejects an oversized UTF-8 record before changing memory, the primary file or its recovery copy", () => {
    const filename = path.join(profile, "records.json");
    const store = new AtomicFile(filename, schema, { text: "default" });
    store.write({ text: "first valid save" });
    store.write({ text: "second valid save" });
    const primary = fs.readFileSync(filename);
    const backup = fs.readFileSync(`${filename}.bak`);
    // Four-byte characters catch guards that incorrectly count UTF-16 code units.
    const oversized = { text: "🌙".repeat(limit / 4) };
    const encoded = JSON.stringify(oversized, null, 2);
    expect(encoded.length).toBeLessThan(limit);
    expect(Buffer.byteLength(encoded, "utf8")).toBeGreaterThan(limit);
    expect(() => store.write(oversized)).toThrow(/16 MB/u);
    expect(store.read()).toEqual({ text: "second valid save" });
    expect(fs.readFileSync(filename)).toEqual(primary);
    expect(fs.readFileSync(`${filename}.bak`)).toEqual(backup);
    const warn = vi.fn();
    const restarted = new AtomicFile(
      filename,
      schema,
      { text: "default" },
      warn,
    );
    expect(restarted.read()).toEqual({ text: "second valid save" });
    expect(warn).not.toHaveBeenCalled();
    expect(fs.readdirSync(profile).sort()).toEqual([
      "records.json",
      "records.json.bak",
    ]);
    // A refused write must not poison the next valid save.
    store.write({ text: "valid after rejection" });
    expect(
      new AtomicFile(filename, schema, { text: "default" }).read(),
    ).toEqual({
      text: "valid after rejection",
    });
  });

  // This is an actual fsynced 16 MB boundary, not a disk-throughput benchmark.
  it("accepts exactly the existing 16 MB encoded-file limit and reads it back without quarantining it", () => {
    const filename = path.join(profile, "boundary.json");
    const overhead = Buffer.byteLength(JSON.stringify({ text: "" }, null, 2));
    const value = { text: "a".repeat(limit - overhead) };
    const warn = vi.fn();
    const store = new AtomicFile(filename, schema, { text: "default" }, warn);
    store.write(value);
    expect(fs.statSync(filename).size).toBe(limit);
    const restarted = new AtomicFile(
      filename,
      schema,
      { text: "default" },
      warn,
    );
    // Compare all bytes' decoded content without dumping 16 MB on assertion failure.
    expect(restarted.read().text === value.text).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    expect(fs.readdirSync(profile)).toEqual(["boundary.json"]);
  }, 30_000);
});
