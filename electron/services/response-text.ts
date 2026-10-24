/** Bounded streaming reads prevent large provider/list responses from exhausting the main process. */
export async function readResponseText(
  response: Pick<Response, "body" | "headers">,
  limit: number,
): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => {});
    throw new Error("The remote response exceeds the supported size limit.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error(
          "The remote response exceeds the supported size limit.",
        );
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
