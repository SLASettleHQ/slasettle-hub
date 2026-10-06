import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IndexerD1 } from "./d1.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { createMockD1 } from "./mockD1.js";

function createTestD1(): { d1: IndexerD1; raw: Database.Database } {
  const raw = new Database(":memory:");
  const migrationSql = readFileSync(join(__dirname, "../../migrations/0001_initial_schema.sql"), "utf-8");
  raw.exec(migrationSql);
  const mock = createMockD1(raw);
  return { d1: new IndexerD1(mock), raw };
}

test("D1: checkpoint starts undefined on fresh db", async () => {
  const { d1 } = createTestD1();
  const cp = await d1.getCheckpoint();
  assert.equal(cp, undefined);
});

test("D1: applyBatch writes checkpoint and round-trips", async () => {
  const { d1 } = createTestD1();
  await d1.applyBatch({
    lastLedger: 100,
    lastCursor: "c100",
    watcherEvents: [],
    checks: [],
    slas: [],
    settlements: [],
  });

  const cp = await d1.getCheckpoint();
  assert.deepEqual(cp, { last_ledger: 100, last_cursor: "c100" });
});

test("D1: applying the same batch twice does not duplicate checks (idempotency)", async () => {
  const { d1 } = createTestD1();
  const batch = {
    lastLedger: 100,
    lastCursor: null,
    watcherEvents: [],
    checks: [
      {
        event_id: "evt-1",
        sla_id: "0",
        round_id: "1",
        watcher: "GAAAA",
        status: "up" as const,
        checked_at: "2026-10-01T00:00:00Z",
      },
    ],
    slas: [],
    settlements: [],
  };

  await d1.applyBatch(batch);
  await d1.applyBatch(batch);

  const checks = await d1.getCheckedInForRound("0", "1");
  assert.equal(checks.length, 1);
  assert.equal(checks[0]?.watcher, "GAAAA");
});

test("D1: watcher removal and re-registration preserve state", async () => {
  const { d1 } = createTestD1();

  await d1.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [{ type: "registered", address: "GWATCHER1", at: "2026-10-01T00:00:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });

  let watchers = await d1.getEligibleWatchers();
  assert.equal(watchers.length, 1);
  assert.equal(watchers[0]?.address, "GWATCHER1");

  await d1.applyBatch({
    lastLedger: 2,
    lastCursor: null,
    watcherEvents: [{ type: "removed", address: "GWATCHER1", at: "2026-10-01T00:01:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });

  watchers = await d1.getEligibleWatchers();
  assert.equal(watchers.length, 0);

  await d1.applyBatch({
    lastLedger: 3,
    lastCursor: null,
    watcherEvents: [{ type: "registered", address: "GWATCHER1", at: "2026-10-01T00:02:00Z" }],
    checks: [],
    slas: [],
    settlements: [],
  });

  watchers = await d1.getEligibleWatchers();
  assert.equal(watchers.length, 1);
  assert.equal(watchers[0]?.address, "GWATCHER1");
});

test("D1: SLA and settlement persistence and pagination", async () => {
  const { d1 } = createTestD1();

  await d1.applyBatch({
    lastLedger: 10,
    lastCursor: null,
    watcherEvents: [],
    checks: [],
    slas: [
      {
        sla_id: "0",
        provider: "GPROVIDER",
        token: "GTOKEN",
        bond_amount_at_creation: "1000000000",
        quorum_threshold: 3,
        beneficiary: "GBENEFICIARY",
        created_at: "2026-10-01T00:00:00Z",
        tx_hash: "txsla0",
      },
    ],
    settlements: [
      {
        event_id: "s1",
        sla_id: "0",
        round_id: "100",
        quorum_threshold: 3,
        penalty_amount: "500000000",
        beneficiary: "GBENEFICIARY",
        tx_hash: "txsettle1",
        ledger_close_time: "2026-10-01T00:05:00Z",
      },
      {
        event_id: "s2",
        sla_id: "0",
        round_id: "101",
        quorum_threshold: 3,
        penalty_amount: "500000000",
        beneficiary: "GBENEFICIARY",
        tx_hash: "txsettle2",
        ledger_close_time: "2026-10-01T00:06:00Z",
      },
    ],
  });

  const slas = await d1.getProviderSlas("GPROVIDER");
  assert.equal(slas.length, 1);
  assert.equal(slas[0]?.sla_id, "0");

  const page1 = await d1.getSettlementsPage("0", 1);
  assert.equal(page1.rows.length, 1);
  assert.equal(page1.hasMore, true);
  assert.equal(page1.rows[0]?.event_id, "s2");

  const page2 = await d1.getSettlementsPage("0", 1, {
    ledgerCloseTime: page1.rows[0]!.ledger_close_time,
    eventId: page1.rows[0]!.event_id,
  });
  assert.equal(page2.rows.length, 1);
  assert.equal(page2.hasMore, false);
  assert.equal(page2.rows[0]?.event_id, "s1");
});
