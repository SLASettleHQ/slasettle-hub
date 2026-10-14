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

const ENDPOINT_HASH_BYTES = new Uint8Array(32).fill(0xab);
const ENDPOINT_HASH_HEX = "ab".repeat(32);

test("classifies a checkSubmitted event with lowercase status", () => {
  // v0.2 shape (see decode.ts): sla_id and watcher are topics, not data
  // fields; status is a one-element vec wrapping the CheckStatus symbol
  // (e.g. ["Down"]), not a bare string; endpoint_hash is a new v0.2 data
  // field.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
      data: { round_id: 5n, endpoint_hash: ENDPOINT_HASH_BYTES, status: ["Down"] },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 1);
  assert.equal(batch.checks[0]?.status, "down");
  assert.equal(batch.checks[0]?.sla_id, "1");
  assert.equal(batch.checks[0]?.watcher, "GWATCHER");
  assert.equal(batch.checks[0]?.endpoint_hash, ENDPOINT_HASH_HEX);
});

test("checkSubmitted status decoding: explicit Up and Down", () => {
  for (const [symbol, want] of [["Up", "up"], ["Down", "down"]] as const) {
    const events = [
      baseEvent({
        topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
        topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
        data: { round_id: 5n, endpoint_hash: ENDPOINT_HASH_BYTES, status: [symbol] },
      }),
    ];
    const batch = classifyEvents(events, silentLogger);
    assert.equal(batch.checks.length, 1, symbol);
    assert.equal(batch.checks[0]?.status, want, symbol);
  }
});

test("checkSubmitted status decoding: an unrecognized string is quarantined, never defaulted to up", () => {
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
      data: { round_id: 5n, endpoint_hash: ENDPOINT_HASH_BYTES, status: ["Sideways"] },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 0, "an unrecognized status must never be persisted as up or down");
});

test("checkSubmitted status decoding: undefined/missing status is quarantined", () => {
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
      data: { round_id: 5n, endpoint_hash: ENDPOINT_HASH_BYTES },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.checks.length, 0);
});

test("checkSubmitted status decoding: an unexpected shape (bare string, not vec-wrapped) is quarantined", () => {
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.checkSubmitted,
      topics: [EVENT_TYPE_TOPIC.checkSubmitted, 1n, "GWATCHER"],
      data: { round_id: 5n, endpoint_hash: ENDPOINT_HASH_BYTES, status: "Up" },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  // "Up" (a bare string, not ["Up"]) does not match the real on-chain
  // encoding and must not be silently accepted just because it happens to
  // equal a valid variant name.
  assert.equal(batch.checks.length, 0);
});

test("classifies a slaCreated event with the v0.2 fields: endpoint_hash and quorum_threshold straight from the event", () => {
  // v0.2 shape (see decode.ts): sla_id and provider are topics, not data
  // fields; endpoint_hash, uptime_target_bps, quorum_threshold, and
  // penalty_per_breach are new v0.2 data fields — quorum_threshold no
  // longer needs the lazy live get_sla fallback for new rows.
  const events = [
    baseEvent({
      topicSymbol: EVENT_TYPE_TOPIC.slaCreated,
      topics: [EVENT_TYPE_TOPIC.slaCreated, 7n, "GPROV"],
      data: {
        token: "CTOKEN",
        endpoint_hash: ENDPOINT_HASH_BYTES,
        bond_amount: 1000n,
        uptime_target_bps: 9990,
        quorum_threshold: 3,
        penalty_per_breach: 50n,
        beneficiary: "GBEN",
      },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  assert.equal(batch.slas.length, 1);
  assert.equal(batch.slas[0]?.sla_id, "7");
  assert.equal(batch.slas[0]?.provider, "GPROV");
  assert.equal(batch.slas[0]?.token, "CTOKEN");
  assert.equal(batch.slas[0]?.endpoint_hash, ENDPOINT_HASH_HEX);
  assert.equal(batch.slas[0]?.beneficiary, "GBEN");
  assert.equal(batch.slas[0]?.quorum_threshold, 3);
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

test("bondToppedUp, slaCancelled, bondWithdrawn are persisted as lifecycle events", () => {
  // Real shapes, as observed on live Testnet transactions (see the wire
  // format documented at the top of rpc/decode.ts): sla_id is topics[1], not
  // a key of `data`; bond_topped_up and bond_withdrawn carry { amount };
  // sla_cancelled carries no data at all.
  const events = [
    baseEvent({
      eventId: "lifecycle-1",
      topicSymbol: EVENT_TYPE_TOPIC.bondToppedUp,
      topics: [EVENT_TYPE_TOPIC.bondToppedUp, 0n],
      data: { amount: 5_000_000n },
    }),
    baseEvent({
      eventId: "lifecycle-2",
      topicSymbol: EVENT_TYPE_TOPIC.slaCancelled,
      topics: [EVENT_TYPE_TOPIC.slaCancelled, 1n],
      data: {},
    }),
    baseEvent({
      eventId: "lifecycle-3",
      topicSymbol: EVENT_TYPE_TOPIC.bondWithdrawn,
      topics: [EVENT_TYPE_TOPIC.bondWithdrawn, 1n],
      data: { amount: 20_000_000n },
    }),
  ];
  const batch = classifyEvents(events, silentLogger);
  // Nothing lands in the per-event-type tables — lifecycle events have
  // their own table.
  assert.equal(batch.checks.length, 0);
  assert.equal(batch.slas.length, 0);
  assert.equal(batch.settlements.length, 0);
  assert.equal(batch.watcherEvents.length, 0);

  assert.equal(batch.lifecycleEvents.length, 3);
  assert.deepEqual(batch.lifecycleEvents[0], {
    event_id: "lifecycle-1",
    sla_id: "0",
    event_type: "bond_topped_up",
    amount: "5000000",
    tx_hash: "abc123",
    ledger_close_time: "2026-01-01T00:00:00Z",
  });
  assert.deepEqual(batch.lifecycleEvents[1], {
    event_id: "lifecycle-2",
    sla_id: "1",
    event_type: "sla_cancelled",
    amount: null,
    tx_hash: "abc123",
    ledger_close_time: "2026-01-01T00:00:00Z",
  });
  assert.deepEqual(batch.lifecycleEvents[2], {
    event_id: "lifecycle-3",
    sla_id: "1",
    event_type: "bond_withdrawn",
    amount: "20000000",
    tx_hash: "abc123",
    ledger_close_time: "2026-01-01T00:00:00Z",
  });
});
