import { writeThirdPartyNotices } from "./third-party-notices.mjs";
import { build } from "esbuild";
export async function buildElectron() {
  writeThirdPartyNotices();
  await build({
    entryPoints: {
      "main/index": "electron/main/index.ts",
      "preload/index": "electron/preload/index.ts",
    },
    outdir: "dist/electron",
    outExtension: { ".js": ".cjs" },
    platform: "node",
    target: "node22",
    format: "cjs",
    bundle: true,
    external: ["electron"],
    sourcemap: true,
  });
}
if (process.argv[1]?.endsWith("build-electron.mjs")) await buildElectron();
