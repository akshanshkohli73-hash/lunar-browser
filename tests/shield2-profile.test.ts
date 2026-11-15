import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ShieldProfileFile } from "../electron/blocker/profile-file";
let profile: string, filename: string;
const schema = z.object({ value: z.string() }).strict();
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-shield-async-"));
  filename = path.join(profile, "profile.json");
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(profile, { recursive: true, force: true });
});
describe("asynchronous validated Shield profile transactions", () => {
  it("serializes concurrent updates against the last successful snapshot without clobbering them", async () => {
    const file = new ShieldProfileFile(filename, schema, { value: "" });
    const first = file.update((current) => ({ value: current.value + "a" })),
      second = file.update((current) => ({ value: current.value + "b" }));
    await Promise.all([first, second]);
    expect(file.read()).toEqual({ value: "ab" });
    expect(JSON.parse(fs.readFileSync(filename, "utf8"))).toEqual({
      value: "ab",
    });
    expect(JSON.parse(fs.readFileSync(`${filename}.bak`, "utf8"))).toEqual({
      value: "a",
    });
    if (process.platform !== "win32")
      expect(fs.statSync(filename).mode & 0o777).toBe(0o600);
  });
  it("does not acknowledge a failed replacement, cleans temporary files and can recover on the next update", async () => {
    const file = new ShieldProfileFile(filename, schema, { value: "old" });
    await file.write({ value: "old" });
    const original = fs.promises.rename,
      rename = vi
        .spyOn(fs.promises, "rename")
        .mockImplementation(async (from, to) => {
          if (String(to) === filename) throw new Error("disk full");
          await original(from, to);
        });
    await expect(file.write({ value: "unsaved" })).rejects.toThrow(
      "Could not save",
    );
    expect(file.read().value).toBe("old");
    expect(
      fs
        .readdirSync(profile)
        .some((file) => file.endsWith(".tmp") || file.endsWith(".tmp.bak")),
    ).toBe(false);
    rename.mockRestore();
    await file.update((current) => ({ value: current.value + "-new" }));
    expect(file.read().value).toBe("old-new");
  });
  it("never recovers an unacknowledged private policy from a backup after its primary replacement failed", async () => {
    const file = new ShieldProfileFile(filename, schema, { value: "ask" });
    await file.write({ value: "ask" }, true);
    const original = fs.promises.rename,
      rename = vi
        .spyOn(fs.promises, "rename")
        .mockImplementation(async (from, to) => {
          if (String(to) === filename)
            throw new Error("primary replacement denied");
          await original(from, to);
        });
    await expect(
      file.write({ value: "unacknowledged sensitive Allow" }, true),
    ).rejects.toThrow(/Could not save/);
    rename.mockRestore();
    expect(file.read().value).toBe("ask");
    fs.unlinkSync(filename);
    expect(
      new ShieldProfileFile(filename, schema, { value: "default ask" }).read()
        .value,
    ).toBe("ask");
    expect(
      fs
        .readdirSync(profile)
        .some((name) => name.endsWith(".tmp") || name.endsWith(".tmp.bak")),
    ).toBe(false);
  });
  it("recovers a missing or corrupt primary from its validated backup and isolates caller mutations", async () => {
    const file = new ShieldProfileFile(filename, schema, { value: "fallback" });
    await file.write({ value: "saved" }, true);
    fs.unlinkSync(filename);
    const warnings: string[] = [];
    const recovered = new ShieldProfileFile(
      filename,
      schema,
      { value: "fallback" },
      (message) => warnings.push(message),
    );
    expect(recovered.read().value).toBe("saved");
    expect(warnings.join(" ")).toContain("Recovered");
    fs.writeFileSync(filename, '{"arbitrary":"invalid"}');
    const backup = new ShieldProfileFile(filename, schema, {
      value: "fallback",
    });
    expect(backup.read().value).toBe("saved");
    const copy = backup.read();
    copy.value = "caller";
    expect(backup.read().value).toBe("saved");
  });
  it("rejects invalid and oversized UTF-8 writes before either the file or cached value changes", async () => {
    const file = new ShieldProfileFile(filename, schema, { value: "saved" });
    await file.write({ value: "saved" });
    const before = fs.readFileSync(filename, "utf8");
    await expect(
      file.write({ value: "é".repeat(8 * 1024 * 1024) }),
    ).rejects.toThrow(/16 MiB/);
    expect(file.read().value).toBe("saved");
    expect(fs.readFileSync(filename, "utf8")).toBe(before);
    await expect(
      file.write({ value: 1 } as unknown as z.infer<typeof schema>),
    ).rejects.toThrow();
    expect(file.read().value).toBe("saved");
  });
  it("purges only this exact file's matching recovery files and overwrites private backups with the cleared state", async () => {
    const file = new ShieldProfileFile(filename, schema, {
      value: "sensitive",
    });
    await file.write({ value: "sensitive" });
    fs.writeFileSync(`${filename}.corrupt-123`, "old");
    fs.writeFileSync(`${filename}.corrupt-not-a-timestamp`, "keep");
    fs.writeFileSync(path.join(profile, "other.json.corrupt-123"), "keep");
    await file.write({ value: "" }, true);
    await file.purgeRecoveryCopies();
    expect(fs.existsSync(`${filename}.corrupt-123`)).toBe(false);
    expect(fs.existsSync(`${filename}.corrupt-not-a-timestamp`)).toBe(true);
    expect(fs.existsSync(path.join(profile, "other.json.corrupt-123"))).toBe(
      true,
    );
    expect(fs.readFileSync(`${filename}.bak`, "utf8")).not.toContain(
      "sensitive",
    );
  });
});
