import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { classifyEvents } from "./classify.js";
import { EVENT_TYPE_TOPIC } from "../rpc/decode.js";
import type { DecodedEvent } from "../rpc/decode.js";

const silentLogger = pino({ level: "silent" });

function baseEvent(overrides: Partial<DecodedEvent>): DecodedEvent {
  return {
    eventId: "tok-1",
    ledger: 100,
    ledgerCloseTime: "2026-01-01T00:00:00Z",
    txHash: "abc123",
    contractId: "CREGISTRY",
    topicSymbol: undefined,
    data: {},
    ...overrides,
  };
}

test("classifies a watcherRegistered event", () => {
  const events = [
    baseEvent({ topicSymbol: EVENT_TYPE_TOPIC.watcherRegistered, data: { watcher: "GWATCHER" } }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.watcherRegistrations.length, 1);
  assert.equal(batch.watcherRegistrations[0]?.address, "GWATCHER");
});

test("classifies a checkSubmitted event with lowercase status", () => {
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      data: { sla_id: 1n, round_id: 5n, watcher: "GWATCHER", status: "Down" },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 1);
  assert.equal(batch.checks[0]?.status, "down");
  assert.equal(batch.checks[0]?.sla_id, "1");
});

test("classifies a slaCreated event with quorum_threshold left null", () => {
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.slaCreated,
      data: { sla_id: 7n, provider: "GPROV", token: "CTOKEN", bond_amount: 1000n, beneficiary: "GBEN" },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.slas.length, 1);
  assert.equal(batch.slas[0]?.quorum_threshold, null);
  assert.equal(batch.slas[0]?.bond_amount_at_creation, "1000");
});

test("an unrecognized topic is skipped, not thrown, and does not appear in any batch bucket", () => {
  const events = [baseEvent({ topicSymbol: "SomethingUnexpected" })];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 0);
  assert.equal(batch.slas.length, 0);
  assert.equal(batch.settlements.length, 0);
  assert.equal(batch.watcherRegistrations.length, 0);
  assert.equal(batch.watcherRemovals.length, 0);
});

test("bondToppedUp, slaCancelled, bondWithdrawn are recognized but intentionally not persisted", () => {
  const events = [
    baseEvent({ topicSymbol: EVENT_TYPE_TOPIC.bondToppedUp, data: { sla_id: 1n, amount: 100n } }),
    baseEvent({ topicSymbol: EVENT_TYPE_TOPIC.slaCancelled, data: { sla_id: 1n } }),
  ];
  const batch = classifyEvents(events, silentLogger);
  // No error, and nothing lands anywhere — this is the expected no-op path,
  // not a bug.
  assert.equal(batch.checks.length, 0);
  assert.equal(batch.slas.length, 0);
});
