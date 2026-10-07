# Environment Configuration

SLASettle uses decoupled environment configurations across its web application, indexer service, and watcher daemon.

## Web Console & SDK (`apps/web/.env.local`)

These variables are consumed by `@slasettle/sdk` and inlined into the Next.js bundle at build time. None of these variables contain sensitive credentials.

| Variable | Required | Default / Testnet Value | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | Stellar RPC endpoint for contract simulations and submission. |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Yes | `Test SDF Network ; September 2015` | Stellar network passphrase for transaction envelope signing. |
| `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID` | Yes | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | Address of deployed `sla_vault` smart contract. |
| `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID` | Yes | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | Address of deployed `watcher_registry` smart contract. |
| `NEXT_PUBLIC_INDEXER_API_URL` | Yes | `https://slasettle-indexer.slasettle-indexer.workers.dev` | Endpoint of the event indexer service (or `http://localhost:8787`). |

> [!NOTE]
> `@slasettle/sdk` invokes `getSdkConfig()` at runtime. If any required variable is omitted, it throws a explicit `MissingSdkConfigError` rather than guessing a fallback.

---

## Event Indexer (`services/indexer/.env`)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `WATCHER_REGISTRY_CONTRACT_ID` | Yes | None | Registry contract address to track for check submissions. |
| `SLA_VAULT_CONTRACT_ID` | Yes | None | Vault contract address to track for lifecycle events. |
| `RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint for event polling. |
| `NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Network passphrase. |
| `DB_PATH` | No | `./data/indexer.db` | Local SQLite database file path (when running Node engine). |
| `HTTP_PORT` | No | `8787` | HTTP listening port for REST API. |
| `POLL_INTERVAL_MS` | No | `5000` | Polling cadence for ledger event ingestion (in ms). |
| `MAX_LEDGERS_PER_REQUEST` | No | `1000` | Batch size limit for `getEvents` RPC calls. |
| `ROUND_LENGTH_SECONDS` | No | `60` | Duration of each monitoring round for the `/v1/clock` API. |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Strict comma-separated list of allowed CORS origins. |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`). |

---

## Watcher Node Daemon (`services/watcher/.env`)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `WATCHER_REGISTRY_CONTRACT_ID` | Yes | None | Deployed `watcher_registry` address. |
| `WATCHER_SECRET_KEY` | Yes | None | Stellar private secret key (`S...`) used to sign check submissions. |
| `TARGET_URL` | Yes | None | HTTP endpoint URL monitored by this watcher instance. |
| `SLA_ID` | Yes | None | Numerical SLA index monitored by this watcher. |
| `RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint. |
| `NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Network passphrase. |
| `ROUND_LENGTH_SECONDS` | No | `60` | Duration of monitoring round in seconds. |
| `HTTP_TIMEOUT_SECONDS` | No | `5` | Request timeout for HTTP probing. |
| `HTTP_EXPECT_MAX_STATUS` | No | `299` | Maximum acceptable HTTP status code considered `UP`. |

> [!CAUTION]
> The `WATCHER_SECRET_KEY` variable holds real signing credentials. Never commit `.env` files containing secret keys.
