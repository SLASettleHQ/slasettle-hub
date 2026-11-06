import assert from "node:assert/strict";
import test from "node:test";
import type { rpc } from "@stellar/stellar-sdk";
import { currentRoundId, getLatestLedgerInfo } from "./ledgerInfo.js";

const RAW_FIXTURE = {
  id: "fixture-ledger-id",
  protocolVersion: "23",
  sequence: 5_567_626,
  closeTime: "1793861770",
  headerXdr: "opaque-header-xdr",
  metadataXdr: "opaque-metadata-xdr",
};

function serverWithRaw(raw: unknown): rpc.Server {
  return { _getLatestLedger: async () => raw } as unknown as rpc.Server;
}

test("getLatestLedgerInfo returns sequence and milliseconds from the raw SDK response", async () => {
  let calls = 0;
  const server = {
    _getLatestLedger: async () => {
      calls++;
      return RAW_FIXTURE;
    },
  } as unknown as rpc.Server;

  assert.deepEqual(await getLatestLedgerInfo(server), {
    sequence: 5_567_626,
    closeTimeMs: 1_793_861_770_000,
  });
  assert.equal(calls, 1);
});

test("raw response preserves the sequence and close time used by the decoded SDK response", async () => {
  const decodedSdkResponse = {
    ...RAW_FIXTURE,
    headerXdr: {} as never,
    metadataXdr: {} as never,
  } satisfies rpc.Api.GetLatestLedgerResponse;
  let decodedCalls = 0;
  const server = {
    _getLatestLedger: async () => RAW_FIXTURE,
    getLatestLedger: async () => {
      decodedCalls++;
      return decodedSdkResponse;
    },
  } as unknown as rpc.Server;

  const expected = {
    sequence: decodedSdkResponse.sequence,
    closeTimeMs: Number(decodedSdkResponse.closeTime) * 1000,
  };
  assert.deepEqual(await getLatestLedgerInfo(server), expected);
  assert.equal(decodedCalls, 0);
});

test("getLatestLedgerInfo rejects invalid sequence values", async () => {
  const invalidSequences = [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "1",
    undefined,
  ];
  for (const sequence of invalidSequences) {
    await assert.rejects(
      getLatestLedgerInfo(serverWithRaw({ ...RAW_FIXTURE, sequence })),
      /invalid sequence/,
      `sequence=${String(sequence)}`,
    );
  }
});

test("getLatestLedgerInfo rejects malformed, negative, missing, and unsafe close times", async () => {
  for (const closeTime of [
    undefined,
    null,
    "",
    " ",
    "-1",
    "1.5",
    "1e3",
    "Infinity",
    "9007199254740992",
    "9007199254741",
    "8640000000001",
    1,
  ]) {
    await assert.rejects(
      getLatestLedgerInfo(serverWithRaw({ ...RAW_FIXTURE, closeTime })),
      /invalid closeTime/,
      `closeTime=${String(closeTime)}`,
    );
  }
});

test("getLatestLedgerInfo accepts the Unix epoch and rejects millisecond overflow past Date range", async () => {
  assert.deepEqual(
    await getLatestLedgerInfo(serverWithRaw({ ...RAW_FIXTURE, closeTime: "0" })),
    { sequence: RAW_FIXTURE.sequence, closeTimeMs: 0 },
  );
  assert.deepEqual(
    await getLatestLedgerInfo(serverWithRaw({ ...RAW_FIXTURE, closeTime: "8640000000000" })),
    { sequence: RAW_FIXTURE.sequence, closeTimeMs: 8_640_000_000_000_000 },
  );
});

test("getLatestLedgerInfo propagates RPC rejection unchanged", async () => {
  const cause = new Error("RPC unavailable");
  const server = {
    _getLatestLedger: async () => {
      throw cause;
    },
  } as unknown as rpc.Server;

  await assert.rejects(getLatestLedgerInfo(server), (error) => error === cause);
});

test("currentRoundId preserves floor-based round boundaries", () => {
  const beforeBoundary = { sequence: 1, closeTimeMs: 59_000 };
  const atBoundary = { sequence: 2, closeTimeMs: 60_000 };

  assert.equal(currentRoundId(beforeBoundary, 60), 0);
  assert.equal(currentRoundId(atBoundary, 60), 1);
});
