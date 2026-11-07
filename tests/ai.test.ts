import { describe, it, expect, vi } from "vitest";
vi.mock("electron", () => ({ safeStorage: {} }));
const { AIService, requestAI } =
  await import("../electron/services/ai-service");
import type { SecretVault } from "../electron/services/ai-service";
import { DEFAULT_SETTINGS } from "../shared/defaults";
const response = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
  });
describe("AI adapters and explicit sharing", () => {
  it("constructs the documented OpenRouter request and parses actual response structure", async () => {
    let request: RequestInit | undefined,
      endpoint = "";
    const transport: typeof fetch = async (url, init) => {
      endpoint = String(url);
      request = init;
      return response("A concise answer.");
    };
    expect(
      await requestAI(
        { aiProvider: "openrouter", aiModel: "provider/model" },
        "test-secret",
        "question",
        "reference",
        transport,
      ),
    ).toBe("A concise answer.");
    expect(endpoint).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer test-secret",
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "provider/model",
      messages: [{ role: "system" }, { role: "user" }],
    });
    expect(String(request?.body)).not.toContain("test-secret");
    expect(String(request?.body)).toContain("untrusted reference material");
  });
  it("uses the Gemini header, not an API key in the query string, and parses text parts", async () => {
    let endpoint = "",
      request: RequestInit | undefined;
    const transport: typeof fetch = async (url, init) => {
      endpoint = String(url);
      request = init;
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: "one " }, { text: "two" }] } },
          ],
        }),
      );
    };
    expect(
      await requestAI(
        { aiProvider: "gemini", aiModel: "models/configured-model" },
        "private-key",
        "question",
        "",
        transport,
      ),
    ).toBe("one two");
    expect(endpoint).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/configured-model:generateContent",
    );
    expect(endpoint).not.toContain("private-key");
    expect(request?.headers).toMatchObject({ "x-goog-api-key": "private-key" });
  });
  it("does not extract or send page context without explicit consent, and does not return the key", async () => {
    const pageText = vi.fn(async () => "consented page material");
    let body = "";
    const vault: SecretVault = {
      secure: () => true,
      read: () => "secret",
      save: () => {},
      delete: () => {},
    };
    const transport: typeof fetch = async (_url, init) => {
      body = String(init?.body);
      return response("reply");
    };
    const service = new AIService(
      vault,
      () => ({
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        aiModel: "provider/model",
      }),
      pageText,
      () => "tab_a",
      transport,
    );
    expect(
      await service.ask({
        prompt: "hello",
        sharePageContext: false,
        tabId: "tab_a",
      }),
    ).toBe("reply");
    expect(pageText).not.toHaveBeenCalled();
    expect(body).not.toContain("consented page material");
    expect(JSON.stringify(service.status())).not.toContain("secret");
    expect(
      await service.ask({
        prompt: "summarize",
        sharePageContext: true,
        tabId: "tab_a",
      }),
    ).toBe("reply");
    expect(body).toContain("consented page material");
    await expect(
      service.ask({
        prompt: "summarize",
        sharePageContext: true,
        tabId: "tab_other",
      }),
    ).rejects.toThrow("active page changed");
  });
  it("rejects unconfigured and disabled states rather than creating demo answers", async () => {
    const vault: SecretVault = {
      secure: () => false,
      read: () => undefined,
      save: () => {},
      delete: () => {},
    };
    const service = new AIService(
      vault,
      () => ({ ...DEFAULT_SETTINGS, aiEnabled: true }),
      async () => "",
      () => null,
    );
    await expect(
      service.ask({ prompt: "hello", sharePageContext: false }),
    ).rejects.toThrow("Configure an API key");
    await expect(
      requestAI({ aiProvider: "openrouter", aiModel: "" }, "key", "hello", ""),
    ).rejects.toThrow("model identifier");
  });
  it("handles rate limits, rejection, malformed replies, and network timeouts without leaking provider bodies", async () => {
    const settings = {
      aiProvider: "openrouter" as const,
      aiModel: "provider/model",
    };
    for (const [status, message] of [
      [429, "rate limit"],
      [401, "rejected"],
      [503, "HTTP 503"],
    ] as const) {
      await expect(
        requestAI(
          settings,
          "SECRET",
          "hello",
          "",
          async () => new Response("SECRET provider failure", { status }),
        ),
      ).rejects.toThrow(message);
    }
    await expect(
      requestAI(
        settings,
        "SECRET",
        "hello",
        "",
        async () => new Response("not json"),
      ),
    ).rejects.toThrow("invalid response");
    await expect(
      requestAI(settings, "SECRET", "hello", "", async () => {
        throw new Error("SECRET timeout");
      }),
    ).rejects.toThrow("timed out");
  });
});

describe("AI service shutdown", () => {
  it("aborts the owning window’s request and refuses requests after disposal", async () => {
    const vault: SecretVault = {
      secure: () => true,
      read: () => "test-key",
      save: () => {},
      delete: () => {},
    };
    const transport: typeof fetch = async (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      });
    const service = new AIService(
      vault,
      () => ({
        ...DEFAULT_SETTINGS,
        aiEnabled: true,
        aiModel: "provider/model",
      }),
      async () => "",
      () => null,
      transport,
    );
    const pending = service.ask({ prompt: "hello", sharePageContext: false });
    service.dispose();
    await expect(pending).rejects.toThrow("timed out");
    await expect(
      service.ask({ prompt: "hello", sharePageContext: false }),
    ).rejects.toThrow("closing");
  });
});
