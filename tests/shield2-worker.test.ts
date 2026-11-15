import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFilterCompiler } from "../electron/blocker/compiler";
import { FilterEngine } from "../electron/blocker/filter-engine";
import { DEFAULT_SHIELD } from "../shared/defaults";
let folder: string, compile: ReturnType<typeof createFilterCompiler>;
beforeAll(async () => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-compiled-worker-"));
  const workerPath = path.join(folder, "compile-worker.cjs");
  await build({
    entryPoints: ["electron/blocker/compile-worker.ts"],
    outfile: workerPath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
  });
  compile = createFilterCompiler(workerPath);
});
afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});
describe("real worker-thread network compilation", () => {
  it("compiles a sizeable rule set off the calling thread and transfers a usable indexed engine with rule reasons", async () => {
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);
    const text = Array.from(
      { length: 12000 },
      (_, index) => `||tracker${index}.example.net^$script,third-party`,
    ).join("\n");
    const result = await compile(text, "abp");
    expect(timerRan).toBe(true);
    expect(result.rules).toBe(12000);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    const engine = new FilterEngine();
    engine.setCompiled("easyprivacy", "trackers", result.bytes);
    expect(
      engine.explain(
        "https://tracker100.example.net/file.js",
        "https://site.example.org",
        "script",
        { ...DEFAULT_SHIELD, filterLists: ["easyprivacy"] },
      ),
    ).toMatchObject({
      blocked: true,
      rule: "||tracker100.example.net^$script,third-party",
    });
  });
  it("reports unsupported input and accounts for excluded directives without returning an executable resource", async () => {
    await expect(compile("<html>not filters</html>", "abp")).rejects.toThrow(
      /Invalid/,
    );
    const result = await compile(
      "||safe.example^\nsite.example##+js(noop)\n/^https?:.*$/",
      "abp",
    );
    expect(result.rules).toBe(1);
    expect(result.rejected).toBe(2);
  });
  it("cancels both already-aborted and in-flight worker jobs instead of leaving a worker alive", async () => {
    const before = new AbortController();
    before.abort();
    await expect(
      compile("||tracker.example^", "abp", before.signal),
    ).rejects.toThrow(/cancelled/);
    const running = new AbortController(),
      promise = compile(
        Array.from(
          { length: 15000 },
          (_, index) => `||node${index}.example.org^`,
        ).join("\n"),
        "abp",
        running.signal,
      );
    running.abort();
    await expect(promise).rejects.toThrow(/cancelled/);
  });
});
