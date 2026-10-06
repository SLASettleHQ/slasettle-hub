# slasettle-indexer

Indexes events from the `watcher_registry` and `sla_vault` Soroban contracts
and serves them over the endpoints documented in `apps/docs/api.md`.

## Verified status

Node 24.21.0 (matching the repository's `.nvmrc`) was used for the successful
install (`npm install`), TypeScript build (`tsc`), and test suite execution
(`npm test` / `node --test`). **0 type errors, 62/62 tests passing** (expanded
from the original 24/24 test run), as of 2026-10-06.

All eight event kinds have been confirmed against real emitted Testnet events:
`watcher_registered`, `watcher_removed`, `check_submitted`, `sla_created`,
`settlement_paid`, `bond_topped_up`, `sla_cancelled`, and `bond_withdrawn`.
The wire format of every kind is documented at the top of `src/rpc/decode.ts`.

## Hosted Production Service (Cloudflare Workers + D1)

The production indexer is deployed as a public service on Cloudflare's Free Tier ($0 operational cost):

- Public Service URL: `https://slasettle-indexer.slasettle-indexer.workers.dev`
- Database: Cloudflare D1 (`slasettle-indexer`, SQLite dialect)
- Ingestion Trigger: Cloudflare Worker Cron Trigger (`* * * * *`, every minute)
- Network: Stellar Testnet (Protocol 28)
- Target Contracts:
  - `watcher_registry`: `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`
  - `sla_vault`: `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`

### Production Architecture

```text
Stellar Testnet RPC
        |
        v
Cloudflare Worker scheduled cron (* * * * *)
        |
        v
Cloudflare D1 (schema in migrations/0001_initial_schema.sql)
        |
        v
Worker HTTP API (routes in src/worker/routes.ts)
        |
        v
Frontend (https://slasettle-web.vercel.app)
```

The scheduled handler queries Stellar RPC for new events since the stored
checkpoint cursor, decodes them via shared decoding logic (`src/rpc/decode.ts`),
classifies them (`src/ingest/classify.ts`), and writes new entries and an updated
checkpoint into Cloudflare D1.

### Public Endpoints

- `GET /v1/health` : returns `status: "ok"` and `last_indexed_ledger`
- `GET /v1/watchers` : list registered watchers
- `GET /v1/clock` : authoritative round and ledger info
- `GET /v1/slas/:slaId/current-round` : checked-in and pending watchers for active round
- `GET /v1/slas/:slaId/settlements` : paginated settlement history with vote tallies
- `GET /v1/providers/:address/slas` : list SLAs created by a provider

CORS allows requests from `https://slasettle-web.vercel.app` and `http://localhost:3000`.

## Local Development (Node + SQLite)

For local development without deploying to Cloudflare, the indexer can run as a standalone Node.js Express process backed by local SQLite:

```bash
npm install
cp .env.example .env   # fill in contract IDs
npm run build
npm start
```

Or for local watch mode: `npm run dev` (uses `tsx watch`).

### Local Environment Variables

| Variable | Required | Default |
|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | yes | none |
| `SLA_VAULT_CONTRACT_ID` | yes | none |
| `RPC_URL` | no | testnet |
| `NETWORK_PASSPHRASE` | no | testnet |
| `DB_PATH` | no | `./data/indexer.db` |
| `HTTP_PORT` | no | `8787` (or `PORT` fallback) |
| `POLL_INTERVAL_MS` | no | `5000` |
| `MAX_LEDGERS_PER_REQUEST` | no | `1000` |
| `ROUND_LENGTH_SECONDS` | no | `60` |
| `START_LEDGER` | no | current tip |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` |
| `LOG_LEVEL` | no | `info` |

## Known Limitations

1. **`bond_topped_up`, `sla_cancelled` and `bond_withdrawn` are decoded but not persisted.** No endpoint needs their history, so `classifyEvents` recognizes them and drops them deliberately.
2. **RPC retention is roughly 7 days.** If the indexer is down longer than the RPC retention window, historical events in that gap cannot be recovered from RPC alone.
3. **No backfill-from-genesis mode.** An unset `START_LEDGER` starts near the current chain tip to avoid unbounded initial sync.
4. **Single global watcher set and per-round settlement**, matching contract design limitations.
5. **Worker Free CPU Limit.** Event batches are bounded to stay well within Cloudflare Worker 10 ms CPU limits.
