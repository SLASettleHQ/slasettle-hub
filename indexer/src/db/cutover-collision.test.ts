import { test } from "node:test";
import assert from "node:assert/strict";
import { IndexerDb } from "./db.js";

function freshDb(): IndexerDb {
  return new IndexerDb(":memory:");
}

/**
 * Proves the Phase 5.4 cutover hazard: `slas.sla_id` is the sole primary
 * key, with no column identifying which contract deployment ("blue" v0.1
 * vs. "green" v0.2) a row belongs to. Both the v0.1 and a freshly
 * initialized v0.2 `sla_vault` number their SLAs from 0, so reusing the
 * same D1 for both deployments collides on sla_id, not just coincidentally
 * but deterministically for every SLA both deployments ever create.
 */
test("same-D1 cutover: a v0.2 SLA 0 collides with an existing v0.1 SLA 0 and is silently dropped", () => {
  const db = freshDb();

  // Existing v0.1 production data: SLA 0, created under the old contract pair.
  const v01Sla = {
    sla_id: "0",
    provider: "GV01PROVIDER",
    token: "CV01TOKEN",
    endpoint_hash: "aa".repeat(32),
    bond_amount_at_creation: "1000000",
    quorum_threshold: 2,
    beneficiary: "GV01BENEFICIARY",
    created_at: "2026-01-01T00:00:00Z",
    tx_hash: "v01-tx-hash",
  };
  db.applyBatch({
    lastLedger: 1000,
    lastCursor: "v01-cursor",
    watcherEvents: [],
    checks: [],
    slas: [v01Sla],
    settlements: [],
    lifecycleEvents: [],
  });

  // A newly deployed, freshly initialized v0.2 sla_vault also creates SLA 0 —
  // a different provider, different endpoint commitment, different contract.
  const v02Sla = {
    sla_id: "0",
    provider: "GV02PROVIDER",
    token: "CV02TOKEN",
    endpoint_hash: "bb".repeat(32),
    bond_amount_at_creation: "5000000",
    quorum_threshold: 3,
    beneficiary: "GV02BENEFICIARY",
    created_at: "2026-11-10T00:00:00Z",
    tx_hash: "v02-tx-hash",
  };
  db.applyBatch({
    lastLedger: 2_000_000,
    lastCursor: "v02-cursor",
    watcherEvents: [],
    checks: [],
    slas: [v02Sla],
    settlements: [],
    lifecycleEvents: [],
  });

  const rows = db.raw.prepare("SELECT * FROM slas WHERE sla_id = ?").all("0") as Array<
    Record<string, unknown>
  >;

  // The schema cannot represent both rows: INSERT OR IGNORE means the
  // second insert (v0.2's SLA 0) is dropped entirely because the primary
  // key "0" is already taken by v0.1's SLA 0. Exactly one row exists, and
  // it is the WRONG one for any v0.2 query — the API would report the v0.2
  // provider's SLA 0 as belonging to the v0.1 provider, with the v0.1
  // endpoint commitment and bond amount.
  assert.equal(rows.length, 1, "schema has no way to keep both deployments' SLA 0");
  assert.equal(rows[0]!.provider, v01Sla.provider, "the v0.2 SLA's data never made it into the row");
  assert.notEqual(rows[0]!.provider, v02Sla.provider);

  db.close();
});

/**
 * Even where INSERT OR IGNORE doesn't apply (checks/settlements are keyed
 * by event_id, which differs per deployment), the tables still have no
 * deployment column, so a read filtered only by sla_id mixes v0.1 and v0.2
 * events for the same numeric ID into one result set.
 */
test("same-D1 cutover: checks for a collided sla_id mix both deployments with no way to separate them", () => {
  const db = freshDb();

  db.applyBatch({
    lastLedger: 1000,
    lastCursor: "v01-cursor",
    watcherEvents: [],
    checks: [
      {
        event_id: "v01-check-1",
        sla_id: "0",
        round_id: "500",
        watcher: "GV01WATCHER",
        status: "up",
        endpoint_hash: "aa".repeat(32),
        checked_at: "2026-01-01T00:01:00Z",
      },
    ],
    slas: [],
    settlements: [],
    lifecycleEvents: [],
  });

  db.applyBatch({
    lastLedger: 2_000_000,
    lastCursor: "v02-cursor",
    watcherEvents: [],
    checks: [
      {
        event_id: "v02-check-1",
        sla_id: "0",
        round_id: "500",
        watcher: "GV02WATCHER",
        status: "down",
        endpoint_hash: "bb".repeat(32),
        checked_at: "2026-11-10T00:01:00Z",
      },
    ],
    slas: [],
    settlements: [],
    lifecycleEvents: [],
  });

  const rows = db.raw
    .prepare("SELECT watcher, status, endpoint_hash FROM checks WHERE sla_id = ? AND round_id = ?")
    .all("0", "500") as Array<Record<string, unknown>>;

  // Both rows survive (different event_id), but a plain "checks for SLA 0,
  // round 500" query — exactly what the current tally/current-round logic
  // runs — now returns a mix of an unrelated v0.1 watcher's vote on the old
  // endpoint commitment and a v0.2 watcher's vote on the new one. Nothing
  // in the schema flags this as cross-deployment contamination.
  assert.equal(rows.length, 2, "both deployments' checks land under the same sla_id/round_id");
  const endpointHashes = new Set(rows.map((r) => r.endpoint_hash));
  assert.equal(endpointHashes.size, 2, "two different endpoint commitments are mixed under one key");

  db.close();
});
