-- Checkpoint: a single row tracking how far ingestion has gotten. Written
-- in the same transaction as the events it corresponds to, so a crash mid-
-- cycle can never leave the checkpoint ahead of what was actually stored.
-- last_cursor is the RPC's own response-level pagination cursor (one per
-- page, from GetEventsResponse.cursor) — a different thing from an
-- individual event's own id, which is what event_id means everywhere else
-- in this schema (this indexer's own dedup key, not an RPC concept).
CREATE TABLE IF NOT EXISTS checkpoint (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_ledger INTEGER NOT NULL,
  last_cursor TEXT
);

-- Current eligible watcher set, built from watcher_registered /
-- watcher_removed events. removed_at is NULL while still eligible.
CREATE TABLE IF NOT EXISTS watchers (
  address TEXT PRIMARY KEY,
  registered_at TEXT NOT NULL,
  removed_at TEXT
);

-- One row per submit_check event. event_id is the idempotency key —
-- re-processing an already-seen ledger range on restart must not double
-- count a vote.
CREATE TABLE IF NOT EXISTS checks (
  event_id TEXT PRIMARY KEY,
  sla_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  watcher TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down')),
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_sla_round ON checks (sla_id, round_id);

-- One row per sla_created event. bond_amount_at_creation is the value at
-- creation time only — live balance is never tracked here, it's always a
-- direct contract read from the SDK. See the indexer API spec for why.
--
-- quorum_threshold is nullable and NOT populated from the event itself —
-- the contract's sla_created event does not carry it (see the contract
-- spec's event list). It never changes after an SLA is created, so it is
-- fetched with a single live get_sla read the first time an API response
-- needs it, then cached here. See api/routes/settlements.ts and
-- rpc/liveReads.ts.
CREATE TABLE IF NOT EXISTS slas (
  sla_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  bond_amount_at_creation TEXT NOT NULL,
  quorum_threshold INTEGER,
  beneficiary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  tx_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slas_provider ON slas (provider);

-- One row per settlement_paid event. quorum_threshold is nullable for the
-- same reason as in slas above, and filled in the same lazy way.
CREATE TABLE IF NOT EXISTS settlements (
  event_id TEXT PRIMARY KEY,
  sla_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  quorum_threshold INTEGER,
  penalty_amount TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  ledger_close_time TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settlements_sla ON settlements (sla_id, ledger_close_time);
