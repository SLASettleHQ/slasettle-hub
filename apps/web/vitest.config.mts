import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30_000,
    pool: "vmThreads",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
