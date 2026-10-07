# Indexer REST API

The SLASettle Indexer service provides a read-optimized REST API that parses on-chain Soroban events into indexed records for fast client consumption.

- **Hosted Production Endpoint**: `https://slasettle-indexer.slasettle-indexer.workers.dev`
- **Hosting Engine**: Cloudflare Workers with Cloudflare D1 SQL storage
- **Design Boundary**: Read-only. The API contains zero write endpoints and holds no signing keys.

---

## API Endpoints

### 1. Health Status (`GET /v1/health`)
Returns ingestion engine health and the most recently ingested ledger sequence.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "last_indexed_ledger": 5214890
}
```

---

### 2. Network Clock (`GET /v1/clock`)
Returns the authoritative network reference timestamp and active round sequence.

**Response `200 OK`**:
```json
{
  "current_time": "2026-10-07T14:32:00.000Z",
  "unix_timestamp": 1791383520,
  "round_length_seconds": 60,
  "current_round_id": 29856392
}
```

---

### 3. Active Watchers (`GET /v1/watchers`)
Returns the list of currently authorized watcher nodes (`removed_at IS NULL`).

**Response `200 OK`**:
```json
{
  "data": [
    {
      "address": "GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK",
      "registered_at": "2026-10-01T12:00:00Z"
    }
  ],
  "next_cursor": null
}
```

---

### 4. Active Round Status (`GET /v1/slas/:slaId/current-round`)
Aggregates checks submitted during the active round for a specified SLA.

**Parameters**:
- `slaId`: Numerical SLA identifier (path parameter).

**Response `200 OK`**:
```json
{
  "round_id": 29856392,
  "round_started_at": "2026-10-07T14:32:00.000Z",
  "checked_in": [
    {
      "watcher": "GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK",
      "status": "up",
      "checked_at": "2026-10-07T14:32:15Z"
    }
  ],
  "not_yet_checked_in": [
    "GB7N22Q..."
  ]
}
```

---

### 5. Settlement History (`GET /v1/slas/:slaId/settlements`)
Chronological list of all executed breach penalty settlements for an SLA.

**Parameters**:
- `slaId`: Numerical SLA identifier (path parameter).
- `limit`: Number of records to return (optional, default: `20`, maximum: `100`).
- `before`: Opaque pagination cursor (optional).

**Response `200 OK`**:
```json
{
  "data": [
    {
      "round_id": 1042,
      "votes_up": 1,
      "votes_down": 4,
      "quorum_threshold": 3,
      "penalty_amount": "10000000",
      "beneficiary": "GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2",
      "tx_hash": "6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147",
      "ledger_close_time": "2026-10-01T12:45:00Z",
      "explorer_url": "https://stellar.expert/explorer/testnet/tx/6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147"
    }
  ],
  "next_cursor": null
}
```

---

## Error Handling & CORS Policy

- **`400 Bad Request`**: Returned when path parameters or query constraints (e.g. invalid cursor or negative limits) fail validation.
- **`404 Not Found`**: Returned if an SLA identifier has no recorded events.
- **`500 Internal Error`**: Returned if upstream Soroban RPC queries or database reads experience an unhandled failure.
- **CORS Allowlist**: Cross-Origin Resource Sharing is controlled via strict allowlists (`ALLOWED_ORIGINS`). Wildcard origins (`*`) are disallowed in production deployments.
