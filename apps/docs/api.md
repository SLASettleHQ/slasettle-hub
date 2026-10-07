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
environment and has no built-in default in the web app. A Cloudflare-hosted
instance exists at `https://slasettle-indexer.slasettle-indexer.workers.dev`
(see [Deployment topology](/deployment-topology)); browser (CORS) access to it
has not been verified.

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
    { "address": "GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK", "registered_at": "2026-09-27T23:26:57Z" }
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
  "round_id": 29842537,
  "round_started_at": "2026-09-27T23:37:00.000Z",
  "checked_in": [
    { "watcher": "GA4WTXER6...", "status": "down", "checked_at": "2026-09-27T23:37:12Z" }
  ],
  "not_yet_checked_in": ["GA5Q22PH..."]
}
```

## `GET /v1/slas/:slaId/settlements`

Query params: `limit` (default `20`, capped at `100`; a negative or fractional
value is rejected with `400`, see [Errors](#errors-and-input-handling-as-implemented)),
`before` (an opaque cursor from a previous response's `next_cursor`).

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
      "ledger_close_time": "2026-09-27T23:41:47Z",
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
      "created_at": "2026-09-27T23:36:12Z",
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

The round clock the frontend reads instead of computing a round from
the browser's own clock. `current_round_id` is
`floor(ledger_close_time_seconds / ROUND_LENGTH_SECONDS)` of the latest
ledger, so it can trail a watcher's own wall-clock round by up to about
one ledger interval at a round boundary. The contracts themselves never
read time: `round_id` is an opaque `u64` supplied by whoever calls
`submit_check` or `trigger_settlement` (see [Lifecycle](/lifecycle)).

```json
{
  "ledger_sequence": 4905879,
  "ledger_close_time": "2026-09-27T23:53:00.000Z",
  "current_round_id": 29842553
}
```

Values in the examples on this page are illustrative and taken from the
2026-09-27 evidence run. Timestamps that come from stored events
(`registered_at`, `checked_at`, `created_at`, and `ledger_close_time` on
a settlement) are the RPC's `ledgerClosedAt` string, without
milliseconds; timestamps the indexer computes (`round_started_at`, and
`ledger_close_time` on `/v1/clock`) carry `.000Z`.

## Errors and input handling, as implemented

- Every route is `GET`. An unhandled exception in a handler returns HTTP
  `500` with `{"error":"internal_error"}`. The routes that call the RPC
  while serving a request, and can therefore fail this way, are
  `/v1/clock` and `/v1/slas/:slaId/current-round` (latest ledger) and
  `/v1/slas/:slaId/settlements` (the lazy `get_sla` read for
  `quorum_threshold`).
- There is no `400` or `404` for a bad or unknown identifier: `:slaId`
  and `:address` are not validated. An SLA or provider with no rows
  returns `200` with `{"data":[],"next_cursor":null}`, and
  `current-round` for any `:slaId`, including a non-numeric one, returns
  `200` with every registered watcher under `not_yet_checked_in`.
- A `before` cursor that does not decode is ignored, so the first page
  is returned. `limit` is `20` when absent, empty, non-numeric or `0`,
  and is capped at `100`. A negative `limit` is rejected with HTTP `400`
  and `{"error":"invalid_limit","message":"limit must not be negative"}`.
  A fractional `limit` such as `1.5` is rejected with HTTP `400` and
  `{"error":"invalid_limit","message":"limit must be an integer"}`. No
  database query is made for either. (Before 2026-09-29 a negative `limit`
  reached SQLite, where a negative `LIMIT` means "no limit", and returned an
  empty page; until the following fix a fractional `limit` returned `500`.)
- A path that is not one of the six routes gets Express's default HTML
  `404`, not JSON.
- The contracts' error codes never appear in this API: it only reads
  events and one `get_sla` value.

## Amounts are strings, not numbers

Every monetary or `i128`-typed field in the responses above
(`penalty_amount`, `bond_amount_at_creation`) is a JSON string, never a
JSON number — `i128` values can exceed JavaScript's safe integer range,
and JSON has no native 128-bit integer type. Parse these as `BigInt`,
never `Number`, exactly as the SDK does internally (see [SDK](/sdk)).
