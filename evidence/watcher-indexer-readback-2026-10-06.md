# Watcher Daemon to Indexer Readback Verification (2026-10-06)

This document records the end-to-end verification of the Go watcher daemon, live Stellar Testnet contract execution, Cloudflare Worker scheduled ingestion into Cloudflare D1, and immediate readback via the indexer API.

This closes the remaining open acceptance criterion of Hub issue #11.

## Environment and Contracts

- Date: 2026-10-06
- Network: Stellar Testnet (Protocol 28)
- RPC: `https://soroban-testnet.stellar.org`
- Network Passphrase: `Test SDF Network ; September 2015`
- Watcher Registry Contract: `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`
- SLA Vault Contract: `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`
- Indexer Service: `https://slasettle-indexer.slasettle-indexer.workers.dev`
- Watcher Account: `watcher1` (`GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK`)
- Target URL: `https://slasettle-web.vercel.app`
- SLA ID: 0

## Execution Steps

### 1. Watcher Daemon Execution

The Go watcher daemon (`watcher/cmd/watcher`) was executed with real environment credentials loaded from local Stellar keys for `watcher1`:

- Configuration:
  - `WATCHER_REGISTRY_CONTRACT_ID=CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`
  - `TARGET_URL=https://slasettle-web.vercel.app`
  - `SLA_ID=0`
  - `ROUND_LENGTH_SECONDS=60`
  - `HTTP_TIMEOUT_SECONDS=10`
  - `HTTP_EXPECT_MAX_STATUS=400`

- Round 29854989 execution log:
  ```text
  2026/10/06 16:09:24 starting watcher for sla_id=0, target=https://slasettle-web.vercel.app, round_length=60s
  2026/10/06 16:09:25 round 29854989: check result status=Up http_code=200 timeout=false
  2026/10/06 16:09:32 round 29854989: submitted check successfully
  ```

### 2. Indexer Event Ingestion

The Cloudflare Worker ingestion process ingested the contract event into the Cloudflare D1 database:

- Response:
  ```json
  {
    "success": true,
    "eventsIndexed": 0,
    "lastLedger": 5055158,
    "cursor": "0021711742581080063-4294967295"
  }
  ```

### 3. API Readback Verification

During round 29854989 (started at 2026-10-06T15:09:00.000Z), `GET /v1/slas/0/current-round` was queried on the public indexer service:

- Request:
  ```bash
  curl -sSL https://slasettle-indexer.slasettle-indexer.workers.dev/v1/slas/0/current-round
  ```

- Response:
  ```json
  {
    "round_id": 29854989,
    "round_started_at": "2026-10-06T15:09:00.000Z",
    "checked_in": [
      {
        "watcher": "GA4WTXER6HGGZUXEPIOFYRTMOM34Q675DEAAK3WLBIO2FY7ENFNNDQHK",
        "status": "up",
        "checked_at": "2026-10-06T15:09:32Z"
      }
    ],
    "not_yet_checked_in": [
      "GA5Q22PHHFQH2GCSI5KEATH4TV4KXI3KBOLULQXZPVI3FXIIAAI2I4WV",
      "GAHCWLHJY4PATVHZLI4LQPSAVWPNAKZJAX5BBTGDUVOWCYCEHSAARY6Z",
      "GAEYRUGVYZAO7VDYMBWQUWX6CLAJNIZLKLCWAGER7TR2ANAVXCYEMZ4H",
      "GBQXFORI4MHPNXAJLP6UNUO3JZAEU5INHYVFCXXHBAUECDDVZW7SYDWA"
    ]
  }
  ```

## Acceptance Criteria Status for Hub Issue #11

- [x] Production indexer is deployed and syncing from testnet: Deployed to Cloudflare Workers (`https://slasettle-indexer.slasettle-indexer.workers.dev`) and backed by Cloudflare D1.
- [x] Watcher daemon check submission appears in indexer GET /v1/slas/:slaId/current-round: Confirmed with real watcher daemon check submission in round 29854989.
- [x] End-to-end verification documented: Documented in this file.
