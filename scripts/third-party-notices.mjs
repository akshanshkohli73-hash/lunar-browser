import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve("package.json");
/** Include license/copyright files for installed runtime dependencies, not development tools. */
export function writeThirdPartyNotices() {
  const visited = new Set(),
    sections = [];
  function visit(name, parent) {
    const resolve = createRequire(parent);
    let directory;
    try {
      directory = path.dirname(resolve.resolve(`${name}/package.json`));
    } catch {
      directory = path.dirname(resolve.resolve(name));
      while (!fs.existsSync(path.join(directory, "package.json")))
        directory = path.dirname(directory);
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    const identity = `${manifest.name}@${manifest.version}`;
    if (visited.has(identity)) return;
    visited.add(identity);
    const files = fs
      .readdirSync(directory)
      .filter(
        (file) =>
          /^(?:licen[cs]e|copying|copyright|notice)(?:[.-]|$)/iu.test(file) &&
          fs.statSync(path.join(directory, file)).isFile(),
      );
    if (!files.length)
      throw new Error(
        `No license/copyright text found for ${identity}. Review before packaging.`,
      );
    const repository =
      typeof manifest.repository === "string"
        ? manifest.repository
        : manifest.repository?.url;
    sections.push(
      `## ${identity}\nLicense: ${manifest.license ?? "See text below"}\nSource: ${repository ?? manifest.homepage ?? "npm registry package"}\n\n${files.map((file) => `### ${file}\n\n${fs.readFileSync(path.join(directory, file), "utf8").trim()}`).join("\n\n")}`,
    );
    for (const child of Object.keys(manifest.dependencies ?? {}).sort())
      visit(child, path.join(directory, "package.json"));
  }
  const manifest = JSON.parse(fs.readFileSync(root, "utf8"));
  for (const name of Object.keys(manifest.dependencies).sort())
    visit(name, root);
  fs.mkdirSync("assets/licenses", { recursive: true });
  fs.writeFileSync(
    "assets/licenses/THIRD-PARTY-NOTICES.txt",
    "Lunar Browser — bundled runtime dependency notices\n\nUnmodified Ghostery modules are MPL-2.0 covered software; their corresponding source is available in the exact-version npm packages and https://github.com/ghostery/adblocker. Lunar's integration is separate; no cosmetic/scriptlet features are enabled.\n\n" +
      sections.sort().join("\n\n" + "=".repeat(72) + "\n\n") +
      "\n",
  );
}
