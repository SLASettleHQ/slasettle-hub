import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { buildApp } from "./server.js";
import { IndexerDb } from "../db/db.js";
import { loadConfig } from "../config.js";
import type { rpc } from "@stellar/stellar-sdk";

const silentLogger = pino({ level: "silent" });

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

function testConfig() {
  return loadConfig({
    WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
    SLA_VAULT_CONTRACT_ID: "CVAULT",
  } as unknown as NodeJS.ProcessEnv);
}

async function withServer(
  db: IndexerDb,
  run: (baseUrl: string) => Promise<void>,
  server: rpc.Server = {} as rpc.Server,
): Promise<void> {
  const app = buildApp({ db, server, config: testConfig() }, silentLogger);
  const httpServer = app.listen(0);
  const address = httpServer.address();
  if (address === null || typeof address === "string") throw new Error("expected a bound port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

test("GET /v1/health returns ok with no ledger indexed yet", async () => {
  const db = new IndexerDb(":memory:");
  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/health`);
    assert.equal(status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.last_indexed_ledger, null);
  });
  db.close();
});

test("GET /v1/watchers returns registered watchers, excludes removed ones", async () => {
  const db = new IndexerDb(":memory:");
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [
      { type: "registered", address: "GACTIVE", at: "2026-01-01T00:00:00Z" },
      { type: "registered", address: "GREMOVED", at: "2026-01-01T00:00:00Z" },
      { type: "removed", address: "GREMOVED", at: "2026-01-02T00:00:00Z" },
    ],
    checks: [],
    slas: [],
    settlements: [],
  });

  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/watchers`);
    assert.equal(status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].address, "GACTIVE");
    assert.equal(body.next_cursor, null);
  });
  db.close();
});

test("GET /v1/providers/:address/slas returns only that provider's SLAs, amounts as strings", async () => {
  const db = new IndexerDb(":memory:");
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [],
    checks: [],
    slas: [
      {
        sla_id: "1",
        provider: "GPROV1",
        token: "CTOKEN",
        bond_amount_at_creation: "25000000000",
        quorum_threshold: null,
        beneficiary: "GBEN",
        created_at: "2026-01-01T00:00:00Z",
        tx_hash: "tx1",
      },
      {
        sla_id: "2",
        provider: "GPROV2",
        token: "CTOKEN",
        bond_amount_at_creation: "999999999999999999",
        quorum_threshold: null,
        beneficiary: "GBEN2",
        created_at: "2026-01-01T00:00:00Z",
        tx_hash: "tx2",
      },
    ],
    settlements: [],
  });

  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/providers/GPROV1/slas`);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].sla_id, 1);
    assert.equal(typeof body.data[0].bond_amount_at_creation, "string");
  });
  db.close();
});

test("GET /v1/providers/:address/slas with no matching provider returns an empty array, not an error", async () => {
  const db = new IndexerDb(":memory:");
  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/providers/GNOBODY/slas`);
    assert.equal(status, 200);
    assert.deepEqual(body.data, []);
  });
  db.close();
});

// ---------------------------------------------------------------------------
// /v1/clock, /v1/slas/:slaId/current-round, /v1/slas/:slaId/settlements
// ---------------------------------------------------------------------------

// getLatestLedger's closeTime is a unix-seconds string. 1790671112 is
// 2026-09-29T08:38:32Z, which falls in round 29844518 (= 1790671080 / 60).
const FAKE_LEDGER = { sequence: 4929505, closeTime: "1790671112" };
const FAKE_ROUND = 29844518;

function fakeServer(ledger = FAKE_LEDGER): rpc.Server {
  return { getLatestLedger: async () => ledger } as unknown as rpc.Server;
}

test("GET /v1/clock reports the mocked ledger and the round derived from its close time", async () => {
  const db = new IndexerDb(":memory:");
  await withServer(
    db,
    async (baseUrl) => {
      const { status, body } = await fetchJson(`${baseUrl}/v1/clock`);
      assert.equal(status, 200);
      assert.deepEqual(body, {
        ledger_sequence: 4929505,
        ledger_close_time: "2026-09-29T08:38:32.000Z",
        current_round_id: FAKE_ROUND,
      });
    },
    fakeServer(),
  );
  db.close();
});

test("GET /v1/clock advances the round exactly at the boundary, using floor division", async () => {
  const db = new IndexerDb(":memory:");
  for (const [closeTime, round] of [
    ["1790671139", FAKE_ROUND], // one second before the boundary
    ["1790671140", FAKE_ROUND + 1], // exactly on the boundary
  ] as const) {
    await withServer(
      db,
      async (baseUrl) => {
        const { body } = await fetchJson(`${baseUrl}/v1/clock`);
        assert.equal(body.current_round_id, round);
      },
      fakeServer({ sequence: 1, closeTime }),
    );
  }
  db.close();
});

test("GET /v1/slas/:slaId/current-round splits registered watchers into checked in and not yet", async () => {
  const db = new IndexerDb(":memory:");
  db.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [
      { type: "registered", address: "GA", at: "2026-01-01T00:00:00Z" },
      { type: "registered", address: "GB", at: "2026-01-01T00:00:00Z" },
      { type: "registered", address: "GC", at: "2026-01-01T00:00:00Z" },
      { type: "registered", address: "GGONE", at: "2026-01-01T00:00:00Z" },
      { type: "removed", address: "GGONE", at: "2026-01-02T00:00:00Z" },
    ],
    checks: [
      { event_id: "e1", sla_id: "0", round_id: String(FAKE_ROUND), watcher: "GA", status: "down", checked_at: "2026-09-29T08:38:10Z" },
      { event_id: "e2", sla_id: "0", round_id: String(FAKE_ROUND), watcher: "GB", status: "up", checked_at: "2026-09-29T08:38:20Z" },
      // Another round, and another SLA: neither may appear.
      { event_id: "e3", sla_id: "0", round_id: String(FAKE_ROUND - 1), watcher: "GC", status: "down", checked_at: "2026-09-29T08:37:10Z" },
      { event_id: "e4", sla_id: "1", round_id: String(FAKE_ROUND), watcher: "GC", status: "down", checked_at: "2026-09-29T08:38:10Z" },
    ],
    slas: [],
    settlements: [],
  });
  await withServer(
    db,
    async (baseUrl) => {
      const { status, body } = await fetchJson(`${baseUrl}/v1/slas/0/current-round`);
      assert.equal(status, 200);
      assert.equal(body.round_id, FAKE_ROUND);
      assert.equal(body.round_started_at, "2026-09-29T08:38:00.000Z");
      assert.deepEqual(body.checked_in, [
        { watcher: "GA", status: "down", checked_at: "2026-09-29T08:38:10Z" },
        { watcher: "GB", status: "up", checked_at: "2026-09-29T08:38:20Z" },
      ]);
      assert.deepEqual(body.not_yet_checked_in, ["GC"]);
      assert.deepEqual(Object.keys(body).sort(), ["checked_in", "not_yet_checked_in", "round_id", "round_started_at"]);
    },
    fakeServer(),
  );
  db.close();
});

function settlementFixtureDb(count = 1): IndexerDb {
  const db = new IndexerDb(":memory:");
  const settlements = [];
  const checks = [];
  for (let i = 1; i <= count; i++) {
    settlements.push({
      event_id: `s${i}`,
      sla_id: "0",
      round_id: String(i),
      quorum_threshold: 3,
      penalty_amount: "10000000",
      beneficiary: "GBEN",
      tx_hash: `abc${i}`,
      ledger_close_time: `2026-09-27T23:4${i}:00Z`,
    });
  }
  // Round 1: 3 down + 1 up. A vote for another round and another SLA must not count.
  for (const [n, w, st] of [[1, "GA", "down"], [2, "GB", "down"], [3, "GC", "down"], [4, "GD", "up"]] as const) {
    checks.push({ event_id: `c${n}`, sla_id: "0", round_id: "1", watcher: w, status: st, checked_at: "2026-09-27T23:40:00Z" });
  }
  checks.push({ event_id: "c5", sla_id: "0", round_id: "2", watcher: "GA", status: "down", checked_at: "2026-09-27T23:41:00Z" });
  checks.push({ event_id: "c6", sla_id: "9", round_id: "1", watcher: "GA", status: "down", checked_at: "2026-09-27T23:40:00Z" });
  db.applyBatch({ lastLedger: 1, lastCursor: null, watcherEvents: [], checks, slas: [], settlements });
  return db;
}

test("GET /v1/slas/:slaId/settlements returns the row with aggregated votes, quorum, amount string and explorer URL", async () => {
  const db = settlementFixtureDb(1);
  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/slas/0/settlements`);
    assert.equal(status, 200);
    assert.equal(body.next_cursor, null);
    assert.deepEqual(body.data, [
      {
        round_id: 1,
        votes_up: 1,
        votes_down: 3,
        quorum_threshold: 3,
        penalty_amount: "10000000",
        beneficiary: "GBEN",
        tx_hash: "abc1",
        ledger_close_time: "2026-09-27T23:41:00Z",
        explorer_url: "https://stellar.expert/explorer/testnet/tx/abc1",
      },
    ]);
  });
  db.close();
});

test("GET /v1/slas/:slaId/settlements for an SLA with no settlements returns an empty page", async () => {
  const db = settlementFixtureDb(1);
  await withServer(db, async (baseUrl) => {
    const { status, body } = await fetchJson(`${baseUrl}/v1/slas/12345/settlements`);
    assert.equal(status, 200);
    assert.deepEqual(body, { data: [], next_cursor: null });
  });
  db.close();
});

test("GET /v1/slas/:slaId/settlements paginates newest first with an opaque cursor and no overlap", async () => {
  const db = settlementFixtureDb(3);
  await withServer(db, async (baseUrl) => {
    const first = await fetchJson(`${baseUrl}/v1/slas/0/settlements?limit=2`);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.data.map((r: any) => r.round_id), [3, 2]);
    assert.equal(typeof first.body.next_cursor, "string");

    const second = await fetchJson(
      `${baseUrl}/v1/slas/0/settlements?limit=2&before=${encodeURIComponent(first.body.next_cursor)}`,
    );
    assert.deepEqual(second.body.data.map((r: any) => r.round_id), [1]);
    assert.equal(second.body.next_cursor, null);
  });
  db.close();
});

test("GET /v1/slas/:slaId/settlements limit handling: default, zero, non-numeric, positive and the cap of 100", async () => {
  const db = settlementFixtureDb(3);
  await withServer(db, async (baseUrl) => {
    const rounds = async (query: string) =>
      (await fetchJson(`${baseUrl}/v1/slas/0/settlements${query}`)).body.data.length;
    assert.equal(await rounds(""), 3); // default 20
    assert.equal(await rounds("?limit=0"), 3); // zero falls back to 20
    assert.equal(await rounds("?limit=abc"), 3); // non-numeric falls back to 20
    assert.equal(await rounds("?limit=1"), 1);
    assert.equal(await rounds("?limit=100000"), 3); // capped at 100, only 3 rows exist
  });

  // The cap itself: 101 rows in, at most 100 out.
  const big = settlementFixtureDb(1);
  const many = [];
  for (let i = 0; i < 101; i++) {
    many.push({
      event_id: `m${String(i).padStart(3, "0")}`, sla_id: "7", round_id: String(i), quorum_threshold: 3,
      penalty_amount: "1", beneficiary: "GBEN", tx_hash: `t${i}`, ledger_close_time: "2026-09-27T23:40:00Z",
    });
  }
  big.applyBatch({ lastLedger: 2, lastCursor: null, watcherEvents: [], checks: [], slas: [], settlements: many });
  await withServer(big, async (baseUrl) => {
    const { body } = await fetchJson(`${baseUrl}/v1/slas/7/settlements?limit=1000`);
    assert.equal(body.data.length, 100);
    assert.equal(typeof body.next_cursor, "string");
  });
  big.close();
  db.close();
});

test("GET /v1/slas/:slaId/settlements rejects a negative limit with 400 and never queries the database", async () => {
  const db = settlementFixtureDb(1);
  const prepared: string[] = [];
  const realPrepare = db.raw.prepare.bind(db.raw);
  (db.raw as any).prepare = (sql: string) => {
    prepared.push(sql);
    return realPrepare(sql);
  };
  await withServer(db, async (baseUrl) => {
    for (const query of ["?limit=-5", "?limit=-1", "?limit=-0.5"]) {
      const { status, body } = await fetchJson(`${baseUrl}/v1/slas/0/settlements${query}`);
      assert.equal(status, 400, query);
      assert.deepEqual(body, { error: "invalid_limit", message: "limit must not be negative" }, query);
    }
    assert.deepEqual(prepared, [], "no SQL statement may be prepared for an invalid limit");

    // A valid request afterwards still works and does query.
    const ok = await fetchJson(`${baseUrl}/v1/slas/0/settlements?limit=1`);
    assert.equal(ok.status, 200);
    assert.ok(prepared.length > 0);
  });
  db.close();
});
