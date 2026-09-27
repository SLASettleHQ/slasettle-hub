import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { buildApp } from "./server.js";
import { IndexerDb } from "../db/db.js";
import { loadConfig } from "../config.js";
import type { rpc } from "@stellar/stellar-sdk";

const silentLogger = pino({ level: "silent" });

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
    SLA_VAULT_CONTRACT_ID: "CVAULT",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv);
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  configOverrides: Record<string, string> = {},
): Promise<void> {
  const db = new IndexerDb(":memory:");
  const app = buildApp({ db, server: {} as rpc.Server, config: testConfig(configOverrides) }, silentLogger);
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
 * Access-Control-Allow-Origin is absent from a cross-origin response, the
 * exact condition that produced the dashboard's original "Failed to
 * fetch". These tests assert on that header directly, since that's the
 * one thing a browser actually checks.
 *
 * ALLOWED_ORIGINS is an array (see config.ts), which puts the `cors`
 * package on its "reflect origin" code path (confirmed against the
 * cors@2.8.6 source): a matching Origin gets reflected back exactly, and a
 * non-matching Origin gets no Access-Control-Allow-Origin header at all,
 * not a false string and not a wildcard.
 */
test("responds with the default local dev origin's Access-Control-Allow-Origin (no ALLOWED_ORIGINS override)", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/v1/watchers`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3000");
  });
});

test("a configured allowed origin gets Access-Control-Allow-Origin reflecting exactly that origin", async () => {
  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/watchers`, {
        headers: { Origin: "https://app.example.test" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), "https://app.example.test");
    },
    { ALLOWED_ORIGINS: "https://app.example.test" },
  );
});

test("multiple configured origins are each individually allowed", async () => {
  await withServer(
    async (baseUrl) => {
      const first = await fetch(`${baseUrl}/v1/watchers`, {
        headers: { Origin: "https://one.example.test" },
      });
      const second = await fetch(`${baseUrl}/v1/watchers`, {
        headers: { Origin: "https://two.example.test" },
      });
      assert.equal(first.headers.get("access-control-allow-origin"), "https://one.example.test");
      assert.equal(second.headers.get("access-control-allow-origin"), "https://two.example.test");
    },
    { ALLOWED_ORIGINS: "https://one.example.test,https://two.example.test" },
  );
});

test("an origin not on the allowlist gets no Access-Control-Allow-Origin header, and never a wildcard", async () => {
  await withServer(
    async (baseUrl) => {
      const res = await fetch(`${baseUrl}/v1/watchers`, {
        headers: { Origin: "https://evil.example" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    },
    { ALLOWED_ORIGINS: "https://app.example.test" },
  );
});
