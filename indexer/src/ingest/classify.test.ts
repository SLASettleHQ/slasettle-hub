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
    topics: [],
    data: {},
    ...overrides,
  };
}

test("classifies a watcherRegistered event", () => {
  // Real shape confirmed against a live testnet event: `data` is empty,
  // the watcher's address is topic[1].
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.watcherRegistered,
      topics: [EVENT_TYPE_TOPIC.watcherRegistered, "GWATCHER"],
      data: {},
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.watcherEvents.length, 1);
  assert.equal(batch.watcherEvents[0]?.type, "registered");
  assert.equal(batch.watcherEvents[0]?.address, "GWATCHER");
});

test("classifies a checkSubmitted event with lowercase status", () => {
  // Real shape confirmed against a live testnet event: sla_id and watcher
  // are topics, not data fields, and status is a one-element vec wrapping
  // the CheckStatus symbol (e.g. ["Down"]), not a bare string.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
      data: { round_id: 5n, status: ["Down"] },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 1);
  assert.equal(batch.checks[0]?.status, "down");
  assert.equal(batch.checks[0]?.sla_id, "1");
  assert.equal(batch.checks[0]?.watcher, "GWATCHER");
});

test("classifies a slaCreated event with quorum_threshold left null", () => {
  // Real shape confirmed against a live testnet event (tx
  // 258c86d2a0de481d60240dd29cea6de490840bd29f78e550fb97fb4fb8028b7c):
  // sla_id and provider are topics, not data fields.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.slaCreated,
      topics: [EVENT_TYPE_TOPIC.slaCreated, 7n, "GPROV"],
      data: { token: "CTOKEN", bond_amount: 1000n, beneficiary: "GBEN" },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.slas.length, 1);
  assert.equal(batch.slas[0]?.sla_id, "7");
  assert.equal(batch.slas[0]?.provider, "GPROV");
  assert.equal(batch.slas[0]?.token, "CTOKEN");
  assert.equal(batch.slas[0]?.beneficiary, "GBEN");
  assert.equal(batch.slas[0]?.quorum_threshold, null);
  assert.equal(batch.slas[0]?.bond_amount_at_creation, "1000");
});

test("classifies a settlementPaid event with sla_id/round_id read from topics", () => {
  // Real shape confirmed against a live testnet event (tx
  // b1dc301a22f8381ee9705a72e214d212e1f1c81c9b0ac53729506708b286d85e):
  // sla_id and round_id are topics, not data fields.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.settlementPaid,
      topics: [EVENT_TYPE_TOPIC.settlementPaid, 7n, 1n],
      data: { payout: 10_000_000n, beneficiary: "GBEN" },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.settlements.length, 1);
  assert.equal(batch.settlements[0]?.sla_id, "7");
  assert.equal(batch.settlements[0]?.round_id, "1");
  assert.equal(batch.settlements[0]?.penalty_amount, "10000000");
  assert.equal(batch.settlements[0]?.beneficiary, "GBEN");
});

test("watcherEvents preserves the real order of interleaved register/remove events for the same address", () => {
  // classifyEvents must not group by event type before this array reaches
  // the db layer; db.ts applies watcherEvents in exactly the order given
  // here, so if this order is wrong, the final watcher state will be too.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.watcherRegistered,
      topics: [EVENT_TYPE_TOPIC.watcherRegistered, "GWATCHER"],
      data: {},
    }),
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.watcherRemoved,
      topics: [EVENT_TYPE_TOPIC.watcherRemoved, "GWATCHER"],
      data: {},
    }),
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.watcherRegistered,
      topics: [EVENT_TYPE_TOPIC.watcherRegistered, "GWATCHER"],
      data: {},
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.deepEqual(
    batch.watcherEvents.map((w) => w.type),
    ["registered", "removed", "registered"],
  );
});

test("an unrecognized topic is skipped, not thrown, and does not appear in any batch bucket", () => {
  const events = [baseEvent({ topicSymbol: "SomethingUnexpected" })];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 0);
  assert.equal(batch.slas.length, 0);
  assert.equal(batch.settlements.length, 0);
  assert.equal(batch.watcherEvents.length, 0);
});

test("bondToppedUp, slaCancelled, bondWithdrawn are recognized but intentionally not persisted", () => {
  // Real shapes, as observed on live Testnet transactions (see the wire
  // format documented at the top of rpc/decode.ts): sla_id is topics[1], not
  // a key of `data`; bond_topped_up and bond_withdrawn carry { amount };
  // sla_cancelled carries no data at all.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.bondToppedUp,
      topics: [EVENT_TYPE_TOPIC.bondToppedUp, 0n],
      data: { amount: 5_000_000n },
    }),
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.slaCancelled,
      topics: [EVENT_TYPE_TOPIC.slaCancelled, 1n],
      data: {},
    }),
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.bondWithdrawn,
      topics: [EVENT_TYPE_TOPIC.bondWithdrawn, 1n],
      data: { amount: 20_000_000n },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  // No error, and nothing lands anywhere — this is the expected no-op path,
  // not a bug.
  assert.equal(batch.checks.length, 0);
  assert.equal(batch.slas.length, 0);
  assert.equal(batch.settlements.length, 0);
  assert.equal(batch.watcherEvents.length, 0);
});
