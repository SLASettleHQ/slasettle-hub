# Environment variables

Four independent configuration surfaces: `apps/web`, `packages/sdk`
(reads from the same variables as `apps/web`, no config file of its
own), `indexer`, and `watcher`. None share a single `.env` file.

## `apps/web` / `packages/sdk` — `apps/web/.env.example`

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | yes | e.g. `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | yes | e.g. `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID` | yes | see [Current Testnet deployment](/testnet-deployment) |
| `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID` | yes | see [Current Testnet deployment](/testnet-deployment) |
| `NEXT_PUBLIC_INDEXER_API_URL` | yes | base URL of the indexer API, e.g. `https://slasettle-indexer.slasettle-indexer.workers.dev` (or `http://localhost:8787` in local dev) |

`NEXT_PUBLIC_*` variables are inlined into the Next.js client bundle at
build time — they are visible to anyone loading the page, which is
correct here since none of them are secret. None of the five has a
default value; `packages/sdk`'s `getSdkConfig()` throws a named
`MissingSdkConfigError` rather than proceeding with a guessed value if
any is absent.

## `indexer` — `indexer/.env.example`

| Variable | Required | Default |
|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | yes | none |
| `SLA_VAULT_CONTRACT_ID` | yes | none |
| `RPC_URL` | no | Testnet RPC |
| `NETWORK_PASSPHRASE` | no | Testnet passphrase |
| `DB_PATH` | no | `./data/indexer.db` |
| `HTTP_PORT` | no | `8787` |
| `POLL_INTERVAL_MS` | no | `5000` |
| `MAX_LEDGERS_PER_REQUEST` | no | `1000` |
| `ROUND_LENGTH_SECONDS` | no | `60` |
| `START_LEDGER` | no | current tip |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` |
| `LOG_LEVEL` | no | `info` |

`ALLOWED_ORIGINS` is the indexer's CORS allowlist: a comma-separated
list of exact origins. It is never a wildcard (`*`) in this codebase.

`MAX_LEDGERS_PER_REQUEST` is passed to `getEvents` as its `limit`
(`indexer/src/ingest/poller.ts`), so it bounds the number of events per
page, not a ledger range, despite the name.

`npm start` loads `indexer/.env` through Node's `--env-file`. `npm run
dev` (`tsx watch`) does not, so export the variables in your shell for
that mode.

## `watcher` — `watcher/.env.example`

| Variable | Required | Notes |
|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | yes | |
| `WATCHER_SECRET_KEY` | yes | a real Stellar secret key; read once at startup, never logged |
| `TARGET_URL` | yes | the endpoint this watcher process checks |
| `SLA_ID` | yes | one watcher process is scoped to one SLA |
| `RPC_URL` | no | Testnet RPC by default |
| `NETWORK_PASSPHRASE` | no | Testnet passphrase by default |
| `ROUND_LENGTH_SECONDS` | no | see `watcher/README.md` |
| `HTTP_TIMEOUT_SECONDS` | no | see `watcher/README.md` |
| `HTTP_EXPECT_MAX_STATUS` | no | see `watcher/README.md` |

`.env` (not `.env.example`) is gitignored inside `watcher/`, precisely
because it is the one place in this repository a real secret key is
expected to live. Never commit a filled-in `watcher/.env`.

The watcher reads only its process environment (`os.LookupEnv`); it has
no `.env` loader, so `go run ./cmd/watcher` does not pick up
`watcher/.env` by itself. Export the variables through your process
supervisor or shell instead. `NETWORK_PASSPHRASE` contains spaces and a
`;`, so it must be quoted (`export NETWORK_PASSPHRASE='Test SDF Network ;
September 2015'`) or left unset to use the default; `source .env` does not
work with the unquoted line in `.env.example`.

## Which pair of contract IDs to use

If you're pointing any of the above at the live, verified Testnet
deployment, use the IDs under "Live, verified deployment" in
[Current Testnet deployment](/testnet-deployment), not the historical
pair — unless you specifically intend to test against the historical,
pre-quorum-fix deployment.
