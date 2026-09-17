# slasettle-indexer

Indexes events from the `watcher_registry` and `sla_vault` Soroban contracts
and serves them over the six endpoints defined in
`SLASettle-indexer-api-spec.md`. Testnet only, for now.

## Verified status — unlike the contracts repo, this one actually compiled

This code was written, installed, compiled, and tested for real in the same
sandbox — Node 22, npm install, `tsc --noEmit`, and `node --test` all ran
successfully. **0 type errors, 24/24 tests passing**, as of the last commit.
That's a meaningfully different situation from `slasettle-vault`, which could
only be written by hand and never compiled — read this section, not that
repo's caveats, for what's actually been checked here.

What "verified" means concretely: the TypeScript compiler confirmed every
type in this codebase is internally consistent, and the real installed
`@stellar/stellar-sdk` types were used to catch and fix three real mistakes
during development (see git log): `EventResponse` has no `pagingToken`
field (it's `id`), `GetLatestLedgerResponse` uses `closeTime` not
`ledgerCloseTime`, and topic filters must be plain strings, not `ScVal`
objects.

**What is still genuinely unverified:** the event *topic naming* itself.
`#[contractevent]`'s exact wire format for the field-level `#[topic]` style
used in `slasettle-vault` was never observed from a real emitted event,
because those contracts were never compiled or deployed either. See the
large comment at the top of `src/rpc/decode.ts` for exactly what to check
and fix before trusting this against real testnet events — a compiler can't
catch a wrong string literal, only real data can.

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
| `WATCHER_REGISTRY_CONTRACT_ID` | yes | — |
| `SLA_VAULT_CONTRACT_ID` | yes | — |
| `RPC_URL` | no | testnet |
| `NETWORK_PASSPHRASE` | no | testnet |
| `DB_PATH` | no | `./data/indexer.db` |
| `HTTP_PORT` | no | `8787` |
| `POLL_INTERVAL_MS` | no | `5000` |
| `START_LEDGER` | no | current tip |

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
- `src/api/` — the six endpoints, matching the spec exactly. `quorum_threshold`
  isn't in the on-chain events (the contracts don't emit it), so it's
  fetched once via a live `get_sla` read the first time a settlement needs
  it, then cached.

## Known limitations, stated plainly

1. **Topic-naming assumption unverified against real events** — see above.
2. **RPC retention is roughly 7 days.** If this indexer is down longer than
   that, the gap cannot be recovered from RPC alone. `runOnce` logs this
   explicitly rather than silently skipping the gap.
3. **No backfill-from-genesis mode.** `START_LEDGER` unset starts near the
   current chain tip, on purpose, to avoid an unbounded first run.
4. **Single global watcher set and per-round settlement**, same limitations
   as the contracts themselves — see `SLASettle-contract-spec.md`.
