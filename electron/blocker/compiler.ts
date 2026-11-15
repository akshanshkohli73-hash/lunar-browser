import { Worker } from "node:worker_threads";
import path from "node:path";
import { z } from "zod";
import type { SourceFormat } from "../../shared/shield";
export interface CompiledFilters {
  bytes: Uint8Array;
  rules: number;
  rejected: number;
  ignored: number;
}
export type FilterCompiler = (
  text: string,
  format: SourceFormat,
  signal?: AbortSignal,
) => Promise<CompiledFilters>;
const metadata = z.object({
  rules: z.number().int().min(1).max(200000),
  rejected: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
});
export const createFilterCompiler =
  (workerPath: string): FilterCompiler =>
  (text, format, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Filter compilation cancelled."));
        return;
      }
      const worker = new Worker(workerPath, {
        workerData: { text, format },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      let settled = false;
      const finish = (error?: Error, result?: CompiledFilters) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        void worker.terminate();
        if (error) reject(error);
        else resolve(result!);
      };
      const abort = () => finish(new Error("Filter compilation cancelled."));
      const timer = setTimeout(
        () =>
          finish(
            new Error(
              "The filter exceeded the 45 second compilation budget. Last-good rules remain active.",
            ),
          ),
        45000,
      );
      signal?.addEventListener("abort", abort, { once: true });
      worker.on("message", (message: unknown) => {
        if (
          message &&
          typeof message === "object" &&
          "error" in message &&
          typeof message.error === "string"
        ) {
          finish(new Error(message.error.slice(0, 300)));
          return;
        }
        const parsed = metadata.safeParse(message);
        if (
          !parsed.success ||
          !message ||
          typeof message !== "object" ||
          !("bytes" in message) ||
          !(message.bytes instanceof Uint8Array) ||
          message.bytes.byteLength > 10 * 1024 * 1024
        ) {
          finish(new Error("Invalid compiled filter response."));
          return;
        }
        finish(undefined, { ...parsed.data, bytes: message.bytes });
      });
      worker.on("error", () =>
        finish(
          new Error("The filter worker failed. Last-good rules remain active."),
        ),
      );
      worker.on("exit", () => {
        if (!settled)
          finish(
            new Error("The filter worker exited before producing valid rules."),
          );
      });
    });

export const compileInWorker = createFilterCompiler(
  path.join(__dirname, "../blocker/compile-worker.cjs"),
);
