import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./index.js";
import { runIngestionStep } from "./ingest.js";
import { createMockD1 } from "../db/mockD1.js";
import { IndexerD1 } from "../db/d1.js";
import type { WorkerEnv } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTestEnv(): { env: WorkerEnv; d1: IndexerD1; rawDb: Database.Database } {
  const rawDb = new Database(":memory:");
  const schema = readFileSync(join(__dirname, "../../migrations/0001_initial_schema.sql"), "utf-8");
  rawDb.exec(schema);
  const mockD1 = createMockD1(rawDb);
  const d1 = new IndexerD1(mockD1);

  const env: WorkerEnv = {
    DB: mockD1,
    RPC_URL: "https://soroban-testnet.stellar.org",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
    SLA_VAULT_CONTRACT_ID: "CVAULT",
    ROUND_LENGTH_SECONDS: "60",
    ALLOWED_ORIGINS: "https://slasettle-web.vercel.app,http://localhost:3000",
  };

  return { env, d1, rawDb };
}

test("Worker: GET /v1/health returns ok and checkpoint status", async () => {
  const { env, d1 } = createTestEnv();

  // Fresh db
  let res = await worker.fetch(new Request("http://localhost/v1/health"), env, {} as any);
  assert.equal(res.status, 200);
  let body = (await res.json()) as any;
  assert.equal(body.status, "ok");
  assert.equal(body.last_indexed_ledger, null);

  // Indexed db
  await d1.applyBatch({
    lastLedger: 5001234,
    lastCursor: "cur-1",
    watcherEvents: [],
    checks: [],
    slas: [],
    settlements: [],
  });

  res = await worker.fetch(new Request("http://localhost/v1/health"), env, {} as any);
  assert.equal(res.status, 200);
  body = (await res.json()) as any;
  assert.equal(body.status, "ok");
  assert.equal(body.last_indexed_ledger, 5001234);
});

test("Worker: CORS headers allow configured origin and reject other origins", async () => {
  const { env } = createTestEnv();

  // Allowed origin
  const resAllowed = await worker.fetch(
    new Request("http://localhost/v1/health", {
      headers: { Origin: "https://slasettle-web.vercel.app" },
    }),
    env,
    {} as any,
  );
  assert.equal(
    resAllowed.headers.get("Access-Control-Allow-Origin"),
    "https://slasettle-web.vercel.app",
  );

  // Another allowed origin
  const resLocal = await worker.fetch(
    new Request("http://localhost/v1/health", {
      headers: { Origin: "http://localhost:3000" },
    }),
    env,
    {} as any,
  );
  assert.equal(resLocal.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");

  // Disallowed origin
  const resDisallowed = await worker.fetch(
    new Request("http://localhost/v1/health", {
      headers: { Origin: "https://untrusted.example" },
    }),
    env,
    {} as any,
  );
  assert.equal(resDisallowed.headers.get("Access-Control-Allow-Origin"), null);

  // OPTIONS preflight
  const resOptions = await worker.fetch(
    new Request("http://localhost/v1/watchers", {
      method: "OPTIONS",
      headers: { Origin: "https://slasettle-web.vercel.app" },
    }),
    env,
    {} as any,
  );
  assert.equal(resOptions.status, 204);
  assert.equal(
    resOptions.headers.get("Access-Control-Allow-Origin"),
    "https://slasettle-web.vercel.app",
  );
});

test("Worker: GET /v1/watchers returns eligible watchers", async () => {
  const { env, d1 } = createTestEnv();

  await d1.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [
      { type: "registered", address: "GWATCHER1", at: "2026-10-01T00:00:00Z" },
      { type: "registered", address: "GWATCHER2", at: "2026-10-01T00:01:00Z" },
    ],
    checks: [],
    slas: [],
    settlements: [],
  });

  const res = await worker.fetch(new Request("http://localhost/v1/watchers"), env, {} as any);
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].address, "GWATCHER1");
  assert.equal(body.data[1].address, "GWATCHER2");
  assert.equal(body.next_cursor, null);
});

test("Worker: GET /v1/providers/:address/slas returns provider slas", async () => {
  const { env, d1 } = createTestEnv();

  await d1.applyBatch({
    lastLedger: 1,
    lastCursor: null,
    watcherEvents: [],
    checks: [],
    slas: [
      {
        sla_id: "0",
        provider: "GPROVIDER1",
        token: "GTOKEN",
        bond_amount_at_creation: "1000",
        quorum_threshold: 3,
        beneficiary: "GBENEFICIARY",
        created_at: "2026-10-01T00:00:00Z",
        tx_hash: "tx0",
      },
    ],
    settlements: [],
  });

  const res = await worker.fetch(
    new Request("http://localhost/v1/providers/GPROVIDER1/slas"),
    env,
    {} as any,
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].sla_id, 0);
  assert.equal(body.data[0].token, "GTOKEN");
});

test("Worker: GET /v1/slas/:slaId/settlements validates limit parameter", async () => {
  const { env } = createTestEnv();

  // Negative limit
  let res = await worker.fetch(
    new Request("http://localhost/v1/slas/0/settlements?limit=-5"),
    env,
    {} as any,
  );
  assert.equal(res.status, 400);
  let body = (await res.json()) as any;
  assert.equal(body.error, "invalid_limit");

  // Non-integer limit
  res = await worker.fetch(
    new Request("http://localhost/v1/slas/0/settlements?limit=12.5"),
    env,
    {} as any,
  );
  assert.equal(res.status, 400);
  body = (await res.json()) as any;
  assert.equal(body.error, "invalid_limit");
});

test("Worker: failed ingestion does not incorrectly advance checkpoint", async () => {
  const { env, d1 } = createTestEnv();
  const badEnv: WorkerEnv = { ...env, RPC_URL: "http://127.0.0.1:9" };

  await assert.rejects(async () => {
    await runIngestionStep(badEnv);
  });

  const cp = await d1.getCheckpoint();
  assert.equal(cp, undefined);
});

test("Worker: HEAD /v1/health returns 200 with null body", async () => {
  const { env } = createTestEnv();
  const res = await worker.fetch(
    new Request("http://localhost/v1/health", { method: "HEAD" }),
    env,
    {} as any,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body, null);
});


