import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SecretVault } from "./ai-service";
/** Scrub known legacy plaintext stores without making another plaintext backup. */
export function migrateLegacyCredentials(
  profile: string,
  vault: SecretVault,
): string[] {
  const warnings: string[] = [];
  for (const name of ["settings.json", "settings.json.bak"]) {
    const filename = path.join(profile, name);
    if (!fs.existsSync(filename) || fs.statSync(filename).size > 1024 * 1024)
      continue;
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filename, "utf8"));
    } catch {
      continue;
    } // The validated profile loader handles corrupted JSON.
    if (!raw || typeof raw !== "object" || !("aiApiKey" in raw)) continue;
    const object = raw as Record<string, unknown>,
      key = object.aiApiKey;
    if (typeof key === "string" && key) {
      const provider = object.aiProvider === "gemini" ? "gemini" : "openrouter";
      if (key.length <= 512 && vault.secure()) {
        if (!vault.read(provider)) vault.save(provider, key);
        warnings.push(
          "A legacy AI key was migrated into OS-encrypted storage. AI remains opt-in.",
        );
      } else
        warnings.push(
          "An old plaintext AI key was removed. Configure a system keychain and re-enter it in Preferences if you want to use AI.",
        );
    }
    delete object.aiApiKey;
    const temporary = `${filename}.${randomUUID()}.migration.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(object), {
        mode: 0o600,
        flag: "wx",
      });
      fs.renameSync(temporary, filename);
    } catch {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      throw new Error(
        "Could not remove a legacy plaintext key. Check profile permissions before starting Lunar.",
      );
    }
  }
  return [...new Set(warnings)];
}
