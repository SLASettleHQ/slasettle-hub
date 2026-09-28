import { test } from "node:test";
import assert from "node:assert/strict";
import { IndexerDb } from "./db.js";

function freshDb(): IndexerDb {
  return new IndexerDb(":memory:");
}

test("checkpoint starts undefined on a fresh db", () => {
  const db = freshDb();
  assert.equal(db.getCheckpoint(), undefined);
  db.close();
});

test("applyBatch writes the checkpoint and it round-trips", () => {
  const db = freshDb();
  db.applyBatch({
    lastLedger: 100,
    lastCursor: "abc",
    watcherEvents: [],
    checks: [],
    slas: [],
    settlements: [],
  });
  const cp = db.getCheckpoint();
  assert.equal(cp?.last_ledger, 100);
  assert.equal(cp?.last_cursor, "abc");
  db.close();
});

test("applying the same batch twice does not duplicate checks (idempotency)", () => {
  const db = freshDb();
  const check = {
    event_id: "tok-1",
    sla_id: "1",
    round_id: "1",
    watcher: "GWATCHER",
    status: "down" as const,
    checked_at: "2026-01-01T00:00:00Z",
  };
  const batch = {
    lastLedger: 1,
    lastCursor: "tok-1",
    watcherEvents: [],
    checks: [check],
    slas: [],
    settlements: [],
  };

  db.applyBatch(batch);
  db.applyBatch(batch); // simulate a restart re-processing the same range

  const count = db.raw.prepare("SELECT COUNT(*) as c FROM checks").get() as { c: number };
  assert.equal(count.c, 1);
  db.close();
});

test("watcher removal after registration sets removed_at without deleting the row", () => {
  const db = freshDb();
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [{ type: "registered", address: "GWATCHER", at: "2026-01-01T00:00:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });
  db.applyBatch({
    lastLedger: 2,
    lastCursor: null,
    watcherEvents: [{ type: "removed", address: "GWATCHER", at: "2026-01-02T00:00:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });

  const row = db.raw.prepare("SELECT * FROM watchers WHERE address = ?").get("GWATCHER") as {
    removed_at: string | null;
  };
  assert.equal(row.removed_at, "2026-01-02T00:00:00Z");
  db.close();
});

test("re-registering a previously removed watcher clears removed_at", () => {
  const db = freshDb();
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [
      { type: "registered", address: "GWATCHER", at: "2026-01-01T00:00:00Z" },
      { type: "removed", address: "GWATCHER", at: "2026-01-02T00:00:00Z" },
    ],
    checks: [],
    slas: [],
    settlements: [],
  });
  // Second batch: registered again after having been removed.
  db.applyBatch({
    lastLedger: 2,
    lastCursor: null,
    watcherEvents: [{ type: "registered", address: "GWATCHER", at: "2026-01-03T00:00:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });

  const row = db.raw.prepare("SELECT * FROM watchers WHERE address = ?").get("GWATCHER") as {
    removed_at: string | null;
  };
  assert.equal(row.removed_at, null);
  db.close();
});

test("register, remove, and re-register the same watcher within a single batch applies in real chronological order, not grouped by event type", () => {
  // This is the exact shape of the real bug found via live Testnet evidence
  // (Phase 10): a watcher was registered, removed, then re-registered, and
  // all three events landed in one ingestion batch. The previous
  // implementation ran every registration first and every removal second,
  // so the removal (chronologically the middle event) was applied last and
  // incorrectly won, leaving a just-re-registered watcher looking removed.
  const db = freshDb();
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [
      { type: "registered", address: "GWATCHER", at: "2026-01-01T00:00:00Z" },
      { type: "removed", address: "GWATCHER", at: "2026-01-01T00:00:05Z" },
      { type: "registered", address: "GWATCHER", at: "2026-01-01T00:00:10Z" },
    ],
    checks: [],
    slas: [],
    settlements: [],
  });

  const row = db.raw.prepare("SELECT * FROM watchers WHERE address = ?").get("GWATCHER") as {
    removed_at: string | null;
  };
  assert.equal(row.removed_at, null);
  db.close();
});
