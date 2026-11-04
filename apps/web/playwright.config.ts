import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
  },
  webServer: {
    command:
      "pnpm --filter @slasettle/sdk build && pnpm --filter @slasettle/web dev --hostname 127.0.0.1 --port 3000",
    cwd: "../..",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
