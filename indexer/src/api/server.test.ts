import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { buildApp } from "./server.js";
import { IndexerDb } from "../db/db.js";
import { loadConfig } from "../config.js";
import type { rpc } from "@stellar/stellar-sdk";

const silentLogger = pino({ level: "silent" });

function testConfig() {
  return loadConfig({
    WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
    SLA_VAULT_CONTRACT_ID: "CVAULT",
  } as unknown as NodeJS.ProcessEnv);
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const db = new IndexerDb(":memory:");
  const app = buildApp({ db, server: {} as rpc.Server, config: testConfig() }, silentLogger);
  const server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("expected a bound port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

/**
 * A real browser withholds the response body from application code and
 * logs the "blocked by CORS policy" console error whenever
 * Access-Control-Allow-Origin is absent from a cross-origin response —
 * this is the exact condition that produced the dashboard's original
 * "Failed to fetch". These tests assert on that header directly, since
 * that's the one thing a browser actually checks.
 */
test("responses to the local frontend's origin carry Access-Control-Allow-Origin", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/watchers`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
  });
});

test("Access-Control-Allow-Origin is the fixed local origin, never a wildcard or a reflection of the requester's Origin", async () => {
  // A plain-string `origin` in the `cors` config sends this exact value on
  // every response regardless of the incoming Origin header (confirmed
  // against the cors@2.8.6 source) — it does not dynamically reflect
  // whatever Origin a caller sends, which would defeat the allowlist. A
  // browser at http://evil.example still gets blocked here because the
  // header value it receives ("http://localhost:3000") doesn't match its
  // own origin.
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/watchers`, {
      headers: { Origin: "http://evil.example" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.notEqual(res.headers.get("access-control-allow-origin"), "*");
  });
});
