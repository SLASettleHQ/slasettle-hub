export interface WorkerEnv {
  DB: D1Database;
  RPC_URL: string;
  NETWORK_PASSPHRASE: string;
  WATCHER_REGISTRY_CONTRACT_ID: string;
  SLA_VAULT_CONTRACT_ID: string;
  START_LEDGER?: string;
  ROUND_LENGTH_SECONDS?: string;
  ALLOWED_ORIGINS?: string;
  MAX_LEDGERS_PER_REQUEST?: string;
}
