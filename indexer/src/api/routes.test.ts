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

async function withServer(db: IndexerDb, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = buildApp({ db, server: {} as rpc.Server, config: testConfig() }, silentLogger);
  const server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("expected a bound port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
    watcherRegistrations: [
      { address: "GACTIVE", registeredAt: "2026-01-01T00:00:00Z" },
      { address: "GREMOVED", registeredAt: "2026-01-01T00:00:00Z" },
    ],
    watcherRemovals: [{ address: "GREMOVED", removedAt: "2026-01-02T00:00:00Z" }],
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
    watcherRegistrations: [],
    watcherRemovals: [],
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
