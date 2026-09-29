# slasettle-indexer

Indexes events from the `watcher_registry` and `sla_vault` Soroban contracts
and serves them over the six endpoints documented in
`apps/docs/api.md`. Testnet only, for now.

## Verified status

Node 24.21.0 (matches the repository's `.nvmrc`), `npm run build` (`tsc`),
and `npm test` (`node --test`) all pass. **0 type errors, 45/45 tests
passing**, as of 2026-09-29.

The event *topic naming* was originally flagged as unverified, since
`#[contractevent]`'s exact wire format was never observed from a real
emitted event when this was written. All eight event kinds have since been
confirmed against real emitted Testnet events (each with a fix committed
when the real shape differed from what was assumed; see git log):
`watcher_registered`, `watcher_removed`, `check_submitted`, `sla_created`
and `settlement_paid` in earlier sessions, and `bond_topped_up`,
`sla_cancelled` and `bond_withdrawn` on 2026-09-27
(`slasettle-vault/evidence/testnet-2026-09-27.md`). The wire format of
every kind is documented at the top of `src/rpc/decode.ts`.

## Setup

```bash
npm install
cp .env.example .env   # fill in the two contract IDs after deployment
npm run build
npm start
```

Or for local iteration: `npm run dev` (uses `tsx watch`).

## Required environment variables

| Variable | Required | Default |
|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | yes | none |
| `SLA_VAULT_CONTRACT_ID` | yes | none |
| `RPC_URL` | no | testnet |
| `NETWORK_PASSPHRASE` | no | testnet |
| `DB_PATH` | no | `./data/indexer.db` |
| `HTTP_PORT` | no | `8787` |
| `POLL_INTERVAL_MS` | no | `5000` |
| `MAX_LEDGERS_PER_REQUEST` | no | `1000` |
| `ROUND_LENGTH_SECONDS` | no | `60` |
| `START_LEDGER` | no | current tip |
| `ALLOWED_ORIGINS` | no | `http://localhost:3000` |
| `LOG_LEVEL` | no | `info` |

`ALLOWED_ORIGINS` is a comma-separated list of exact frontend origins
allowed to call this API from a browser. Never a wildcard. Set this to the
real deployed frontend origin(s) before deploying anywhere but local dev.
`LOG_LEVEL` is read directly by the logger in `src/index.ts`, not through
`src/config.ts` like the rest of this table.

Startup fails loudly (not silently) if a required variable is missing — see
`src/config.ts`.

## Architecture, briefly

- `src/rpc/client.ts` — wraps `getEvents`, enforces the RPC's own
  constraints (cursor and startLedger are mutually exclusive, 5-contract
  batch cap).
- `src/rpc/decode.ts` — decodes raw events. i128/u128 values stay strings or
  bigint, never coerced to `Number`, since amounts can exceed
  `Number.MAX_SAFE_INTEGER`.
- `src/ingest/classify.ts` — turns decoded events into DB row shapes. An
  unrecognized event topic is logged, not silently dropped.
- `src/ingest/poller.ts` — the ingestion loop. Writes the checkpoint and any
  events in one SQLite transaction, so a crash mid-cycle can never leave the
  checkpoint ahead of what was actually stored, which would otherwise cause
  silent gaps on restart.
- `src/db/` — SQLite schema and a typed wrapper. `INSERT OR IGNORE` on each
  event's own `id` makes re-processing an already-seen range idempotent.
- `src/api/` — the six endpoints, as documented in `apps/docs/api.md`. `quorum_threshold`
  isn't in the on-chain events (the contracts don't emit it), so it's
  fetched once via a live `get_sla` read the first time a settlement needs
  it, then cached.

## Known limitations, stated plainly

1. **`bond_topped_up`, `sla_cancelled` and `bond_withdrawn` are decoded
   but not persisted.** No endpoint needs their history, so
   `classifyEvents` recognizes them and drops them on purpose.
2. **RPC retention is roughly 7 days.** If this indexer is down longer than
   that, the gap cannot be recovered from RPC alone. `runOnce` logs this
   explicitly rather than silently skipping the gap.
3. **No backfill-from-genesis mode.** `START_LEDGER` unset starts near the
   current chain tip, on purpose, to avoid an unbounded first run.
4. **Single global watcher set and per-round settlement**, same limitations
   as the contracts themselves — see `SLASettle-contract-spec.md`.
