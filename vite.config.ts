import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  base: "./",
  resolve: { alias: { "@": path.resolve("src") } },
  server: {
    host: "0.0.0.0",
    // Arena preview hosts are reverse proxies, not browser-engine endpoints.
    allowedHosts: [".e2b.app", "localhost"],
  },
  build: { outDir: "dist/renderer", emptyOutDir: true },
});
