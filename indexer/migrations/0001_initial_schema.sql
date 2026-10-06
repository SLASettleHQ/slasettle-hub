-- D1 initial schema migration for slasettle-indexer

CREATE TABLE IF NOT EXISTS checkpoint (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_ledger INTEGER NOT NULL,
  last_cursor TEXT
);

CREATE TABLE IF NOT EXISTS watchers (
  address TEXT PRIMARY KEY,
  registered_at TEXT NOT NULL,
  removed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_watchers_removed_registered ON watchers (removed_at, registered_at);

CREATE TABLE IF NOT EXISTS checks (
  event_id TEXT PRIMARY KEY,
  sla_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  watcher TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down')),
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_sla_round ON checks (sla_id, round_id);

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
CREATE INDEX IF NOT EXISTS idx_slas_provider ON slas (provider, created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_settlements_sla_time_event ON settlements (sla_id, ledger_close_time DESC, event_id DESC);
