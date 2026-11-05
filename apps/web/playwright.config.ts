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
    env: {
      NEXT_PUBLIC_INDEXER_API_URL: "https://indexer.invalid",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban.invalid",
      NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID: "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526",
      NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID: "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ",
    },
  },
});
