import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Generous relative to typical CI — this suite runs several tests that
    // reset the module registry and re-import fresh module instances (to
    // test env-driven singleton config), which is slower than a plain
    // synchronous assertion.
    testTimeout: 30_000,
  },
});
