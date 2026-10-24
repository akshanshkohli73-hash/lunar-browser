import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyCredentials } from "../electron/services/legacy-credentials";
import type { SecretVault } from "../electron/services/ai-service";
import { readResponseText } from "../electron/services/response-text";
let profile: string;
beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "lunar-migration-"));
});
afterEach(() => fs.rmSync(profile, { recursive: true, force: true }));
describe("legacy credential handling", () => {
  it("migrates a known plaintext key without leaving it in the settings file or backup", () => {
    const saved = new Map<string, string>(),
      vault: SecretVault = {
        secure: () => true,
        read: (provider) => saved.get(provider),
        save: (provider, key) => {
          saved.set(provider, key);
        },
        delete: (provider) => {
          saved.delete(provider);
        },
      };
    const legacy = {
      searchEngine: "bing",
      aiProvider: "gemini",
      aiApiKey: "legacy-sensitive-key",
    };
    for (const file of ["settings.json", "settings.json.bak"])
      fs.writeFileSync(path.join(profile, file), JSON.stringify(legacy));
    expect(migrateLegacyCredentials(profile, vault).join(" ")).toContain(
      "migrated",
    );
    expect(saved.get("gemini")).toBe("legacy-sensitive-key");
    for (const file of fs.readdirSync(profile))
      expect(fs.readFileSync(path.join(profile, file), "utf8")).not.toContain(
        "legacy-sensitive-key",
      );
    expect(
      JSON.parse(fs.readFileSync(path.join(profile, "settings.json"), "utf8"))
        .searchEngine,
    ).toBe("bing");
  });
  it("does not silently fall back to plaintext if a system keychain is unavailable", () => {
    const vault: SecretVault = {
      secure: () => false,
      read: () => undefined,
      save: () => {
        throw new Error("must not store");
      },
      delete: () => {},
    };
    fs.writeFileSync(
      path.join(profile, "settings.json"),
      JSON.stringify({ aiApiKey: "old-key" }),
    );
    expect(migrateLegacyCredentials(profile, vault).join(" ")).toContain(
      "re-enter",
    );
    expect(
      fs.readFileSync(path.join(profile, "settings.json"), "utf8"),
    ).not.toContain("old-key");
  });
});
describe("bounded network responses", () => {
  it("rejects oversized bodies even when the server omits Content-Length", async () => {
    await expect(
      readResponseText(new Response("too much data"), 4),
    ).rejects.toThrow("size limit");
    await expect(readResponseText(new Response("ok"), 4)).resolves.toBe("ok");
    await expect(
      readResponseText(
        new Response("x", { headers: { "content-length": "200" } }),
        4,
      ),
    ).rejects.toThrow("size limit");
  });
});
