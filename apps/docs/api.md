# Indexer API

The indexer (`indexer/src/api/routes.ts`, Express) exposes a small,
read-only HTTP API over its own SQLite cache. It never writes to either
contract; every endpoint below is `GET`. All queries against the
database use parameterized statements (`better-sqlite3`'s `?`
placeholders), never string-interpolated SQL.

CORS is controlled by `ALLOWED_ORIGINS` (see
[Environment variables](/environment-variables)) — an explicit,
comma-separated allowlist, never a wildcard.

Base URL is whatever `NEXT_PUBLIC_INDEXER_API_URL` is set to for a given
environment; there is no publicly hosted instance (see
[Deployment topology](/deployment-topology)).

## `GET /v1/health`

```json
{ "status": "ok", "last_indexed_ledger": 4905879 }
```

`last_indexed_ledger` is `null` if the indexer has not completed its
first ingestion pass yet.

## `GET /v1/watchers`

Currently registered watchers only (`removed_at IS NULL`).

```json
{
  "data": [
    { "address": "GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK", "registered_at": "2026-09-27T23:26:46.000Z" }
  ],
  "next_cursor": null
}
```

Not paginated (`next_cursor` is always `null`) — the eligible watcher
set is expected to stay small.

## `GET /v1/slas/:slaId/current-round`

Computes the current round from the indexer's own Soroban RPC ledger
read (`getLatestLedgerInfo`), not from the caller's clock —
`round_id = floor(ledger_close_time_seconds / ROUND_LENGTH_SECONDS)`.

```json
{
  "round_id": 81762,
  "round_started_at": "2026-09-27T23:37:00.000Z",
  "checked_in": [
    { "watcher": "GA4WTXER6...", "status": "down", "checked_at": "2026-09-27T23:37:12.000Z" }
  ],
  "not_yet_checked_in": ["GA5Q22PH..."]
}
```

## `GET /v1/slas/:slaId/settlements`

Query params: `limit` (default `20`, capped at `100`), `before` (an
opaque cursor from a previous response's `next_cursor`).

```json
{
  "data": [
    {
      "round_id": 1,
      "votes_up": 0,
      "votes_down": 3,
      "quorum_threshold": 3,
      "penalty_amount": "10000000",
      "beneficiary": "GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2",
      "tx_hash": "6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147",
      "ledger_close_time": "2026-09-27T23:41:47.000Z",
      "explorer_url": "https://stellar.expert/explorer/testnet/tx/6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147"
    }
  ],
  "next_cursor": null
}
```

`votes_up`/`votes_down` are not stored on the settlement row; they're
computed at request time by aggregating the `checks` table for that
exact `(sla_id, round_id)` — so there is one source of truth for a
round's vote counts, not two that could drift apart.
`quorum_threshold` is backfilled lazily from a live RPC read
(`fetchQuorumThreshold`) the first time a given SLA's settlement is
requested, then cached in the database.

Pagination is cursor-based: the cursor opaquely encodes
`(ledger_close_time, event_id)` of the last row returned, and a strict
`<` comparison on that pair is what the next page's query filters on —
never an offset, so pages stay correct even if new settlements are
ingested between requests.

## `GET /v1/providers/:address/slas`

```json
{
  "data": [
    {
      "sla_id": 0,
      "token": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      "bond_amount_at_creation": "50000000",
      "beneficiary": "GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2",
      "created_at": "2026-09-27T23:36:12.000Z",
      "tx_hash": "819dd54031a2391d9ead3dbd0a902f5fdaeb597f0914a8307cfacfecc7031083"
    }
  ],
  "next_cursor": null
}
```

`bond_amount_at_creation` is exactly that — the bond as of `create_sla`,
not the current balance. For the current balance, read
`sla_vault.get_bond_balance` directly via the SDK (see [SDK](/sdk)); the
indexer does not track live balance changes from `top_up_bond` or
settlements as a separate column.

## `GET /v1/clock`

The authoritative round clock. The frontend is expected to read this
rather than compute a round from the browser's own clock, since the
contracts only care about the round number a transaction actually lands
in, which is driven by ledger close time, not wall-clock time on any
particular machine.

```json
{
  "ledger_sequence": 4905879,
  "ledger_close_time": "2026-09-27T23:53:00.000Z",
  "current_round_id": 81762
}
```

## Amounts are strings, not numbers

Every monetary or `i128`-typed field in the responses above
(`penalty_amount`, `bond_amount_at_creation`) is a JSON string, never a
JSON number — `i128` values can exceed JavaScript's safe integer range,
and JSON has no native 128-bit integer type. Parse these as `BigInt`,
never `Number`, exactly as the SDK does internally (see [SDK](/sdk)).
