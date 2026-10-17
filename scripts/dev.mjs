import { createServer } from "vite";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { buildElectron } from "./build-electron.mjs";
await buildElectron();
const server = await createServer();
await server.listen();
const require = createRequire(import.meta.url);
const electron = require("electron");
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: server.resolvedUrls.local[0] },
});
const close = async () => {
  child.kill();
  await server.close();
};
process.on("SIGTERM", close);
process.on("SIGINT", close);
child.on("exit", async (code) => {
  await server.close();
  process.exitCode = code ?? 1;
});
