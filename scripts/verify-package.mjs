import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  validateConfiguration,
} = require("app-builder-lib/out/util/config/config.js");
const { DebugLogger } = require("builder-util");
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
// Building an internal artifact must never implicitly publish a GitHub release.
for (const name of ["dist", "dist:win"])
  assert.ok(
    manifest.scripts[name].endsWith("--publish never"),
    `${name} must explicitly disable publishing`,
  );
await validateConfiguration(manifest.build, new DebugLogger(false));
for (const file of [
  manifest.main,
  "dist/electron/preload/index.cjs",
  "dist/renderer/index.html",
  "assets/icons/lunar.ico",
  "assets/icons/lunar.png",
])
  assert.ok(fs.statSync(file).size > 0, `Missing packaging input: ${file}`);
const icon = fs.readFileSync(manifest.build.win.icon);
assert.equal(icon.readUInt16LE(2), 1);
assert.equal(icon.readUInt16LE(4), 7);
for (let index = 0; index < 7; index++) {
  const entry = 6 + index * 16,
    offset = icon.readUInt32LE(entry + 12),
    size = icon[entry] || 256;
  assert.equal(
    icon.subarray(offset, offset + 8).toString("hex"),
    "89504e470d0a1a0a",
  );
  assert.equal(icon.readUInt32BE(offset + 16), size);
}
assert.equal(manifest.build.nsis.oneClick, false);
assert.equal(manifest.build.nsis.deleteAppDataOnUninstall, false);
console.log(
  "PASS: electron-builder configuration schema, compiled entry points, 7-size Windows icon, non-destructive NSIS profile policy, and explicit no-publish build policy. No installer or Windows runtime is implied.",
);
