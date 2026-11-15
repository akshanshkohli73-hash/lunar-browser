import { parentPort, workerData } from "node:worker_threads";
import { z } from "zod";
import { compileSource, FILTER_LIMIT_BYTES } from "./filter-engine";
const input = z
  .object({
    text: z.string().max(FILTER_LIMIT_BYTES),
    format: z.enum(["hosts", "abp"]),
  })
  .strict();
try {
  const value = input.parse(workerData),
    result = compileSource(value.text, value.format);
  // Own the transfer buffer: serialized views need not cover a whole ArrayBuffer.
  const bytes = Uint8Array.from(result.bytes);
  parentPort?.postMessage({ ...result, bytes }, [bytes.buffer]);
} catch (error) {
  parentPort?.postMessage({
    error:
      error instanceof Error ? error.message : "Filter compilation failed.",
  });
}
