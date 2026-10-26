-- D1 forward migration for slasettle-indexer v0.2 integration.
--
-- Non-destructive: adds nullable columns (existing rows get NULL, which is
-- valid for a column with no NOT NULL/CHECK constraint) and a new table.
-- Does not drop, rename, or alter any existing column, and does not
-- require the production D1 database to be empty.
--
-- SQLite's ALTER TABLE ADD COLUMN cannot add a NOT NULL column without a
-- DEFAULT when the table already has rows, so endpoint_hash is added
-- nullable here even though classify.ts always provides it for new v0.2
-- rows — existing v0.1 rows have no endpoint_hash to backfill.

ALTER TABLE checks ADD COLUMN endpoint_hash TEXT;
ALTER TABLE slas ADD COLUMN endpoint_hash TEXT;

CREATE TABLE IF NOT EXISTS sla_lifecycle_events (
  event_id TEXT PRIMARY KEY,
  sla_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('bond_topped_up', 'sla_cancelled', 'bond_withdrawn')),
  amount TEXT,
  tx_hash TEXT NOT NULL,
  ledger_close_time TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_sla ON sla_lifecycle_events (sla_id, ledger_close_time DESC);
