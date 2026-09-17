import { z } from "zod";

/**
 * Every value that could differ between testnet and mainnet, or between one
 * deployment and another, comes from the environment — nothing here is
 * hardcoded. Fails fast and loudly on startup if anything required is
 * missing, rather than limping along with an undefined contract ID.
 */
const ConfigSchema = z.object({
  RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  NETWORK_PASSPHRASE: z.string().default("Test SDF Network ; September 2015"),
  WATCHER_REGISTRY_CONTRACT_ID: z.string().min(1, "WATCHER_REGISTRY_CONTRACT_ID is required"),
  SLA_VAULT_CONTRACT_ID: z.string().min(1, "SLA_VAULT_CONTRACT_ID is required"),
  DB_PATH: z.string().default("./data/indexer.db"),
  HTTP_PORT: z.coerce.number().int().positive().default(8787),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  // getEvents on Soroban RPC accepts at most 1000 ledgers per request in
  // practice on most public RPC providers, and public nodes generally only
  // retain roughly 7 days (~120,960 ledgers at ~5s/ledger) of history at
  // all — see README for what happens if the indexer falls behind that.
  MAX_LEDGERS_PER_REQUEST: z.coerce.number().int().positive().default(1000),
  ROUND_LENGTH_SECONDS: z.coerce.number().int().positive().default(60),
  // Where to start on a completely fresh database (no checkpoint yet).
  // Unset means "start near the current chain tip" — not genesis, which
  // would be an unbounded first run, and public RPC nodes only retain
  // roughly 7 days of history anyway (see README).
  START_LEDGER: z.coerce.number().int().positive().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid or missing configuration:\n${issues}`);
  }
  return result.data;
}
