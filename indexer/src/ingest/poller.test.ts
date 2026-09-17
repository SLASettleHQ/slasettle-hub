import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { runOnce } from "./poller.js";
import { IndexerDb } from "../db/db.js";
import { loadConfig } from "../config.js";
import type { EventClient } from "../rpc/client.js";
import type { rpc } from "@stellar/stellar-sdk";

const silentLogger = pino({ level: "silent" });

function testConfig() {
  return loadConfig({
    WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
    SLA_VAULT_CONTRACT_ID: "CVAULT",
    START_LEDGER: "1",
  } as unknown as NodeJS.ProcessEnv);
}

test("runOnce with zero events still advances the checkpoint to the latest ledger", async () => {
  const db = new IndexerDb(":memory:");
  const fakeClient: EventClient = {
    getLatestLedger: async () => 500,
    getEvents: async () => ({ events: [], latestLedger: 500, cursor: "" } as unknown as rpc.Api.GetEventsResponse),
  };

  const mayHaveMore = await runOnce({ client: fakeClient, db, logger: silentLogger, config: testConfig() });

  assert.equal(mayHaveMore, false);
  assert.equal(db.getCheckpoint()?.last_ledger, 500);
  db.close();
});

test("runOnce warns and continues when START_LEDGER is deep beyond the retention window", async () => {
  const db = new IndexerDb(":memory:");
  const fakeClient: EventClient = {
    getLatestLedger: async () => 10_000_000, // far beyond START_LEDGER=1
    getEvents: async () => ({ events: [], latestLedger: 10_000_000 } as unknown as rpc.Api.GetEventsResponse),
  };

  // Should not throw — a historical gap is logged, not fatal.
  await runOnce({ client: fakeClient, db, logger: silentLogger, config: testConfig() });
  db.close();
});

test("runOnce resumes from a stored cursor, not a fresh startLedger, on a second call", async () => {
  const db = new IndexerDb(":memory:");
  db.applyBatch({
    lastLedger: 50,
    lastCursor: "0000000050-0000000000",
    watcherRegistrations: [],
    watcherRemovals: [],
    checks: [],
    slas: [],
    settlements: [],
  });

  let calledWith: { kind: string; value: string | number } | undefined;
  const fakeClient: EventClient = {
    getLatestLedger: async () => 100,
    getEvents: async (params) => {
      calledWith =
        params.cursor.kind === "cursor"
          ? { kind: "cursor", value: params.cursor.cursor }
          : { kind: "ledger", value: params.cursor.startLedger };
      return { events: [], latestLedger: 100 } as unknown as rpc.Api.GetEventsResponse;
    },
  };

  await runOnce({ client: fakeClient, db, logger: silentLogger, config: testConfig() });

  assert.equal(calledWith?.kind, "cursor");
  assert.equal(calledWith?.value, "0000000050-0000000000");
  db.close();
});
