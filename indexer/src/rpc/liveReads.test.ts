import { test } from "node:test";
import assert from "node:assert/strict";
import { xdr, nativeToScVal, type rpc } from "@stellar/stellar-sdk";
import { fetchQuorumThreshold } from "./liveReads.js";

/**
 * Regression test for a real bug: fetchQuorumThreshold used to build its
 * throwaway simulation source account from a hardcoded string
 * ("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF") that fails
 * @stellar/stellar-sdk's own StrKey checksum validation inside the
 * `Account` constructor — so the function threw "accountId is invalid"
 * before ever reaching the network, on every call. This was observed live
 * as a real 500 from GET /v1/slas/:slaId/settlements whenever a
 * settlement row's cached quorum_threshold was null (see
 * evidence/phase-23-verification-2026-09-29.md).
 *
 * This test never touches a live RPC endpoint: `params.server` is a stub
 * whose simulateTransaction returns a hand-built, structurally realistic
 * get_sla simulation result (a struct decodes as an ScMap of Symbol keys
 * to values, the same shape scValToNative expects for any
 * #[contracttype] struct — see SLAConfig's real fields in
 * contracts/sla_vault/src/storage.rs). Against the old hardcoded-string
 * implementation, this test fails immediately with "accountId is
 * invalid" — the Account constructor throws before the stub
 * simulateTransaction is ever called. Against the fixed implementation,
 * it reaches the stub, decodes the simulated result, and returns the
 * real quorum_threshold.
 */
function fakeGetSlaSimulation(quorumThreshold: number): rpc.Api.SimulateTransactionSuccessResponse {
  const retval = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("provider"),
      val: nativeToScVal("GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB", { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("quorum_threshold"),
      val: nativeToScVal(quorumThreshold, { type: "u32" }),
    }),
  ]);

  return {
    latestLedger: 1,
    transactionData: new xdr.SorobanTransactionData({
      resources: new xdr.SorobanResources({
        footprint: new xdr.LedgerFootprint({ readOnly: [], readWrite: [] }),
        instructions: 0,
        diskReadBytes: 0,
        writeBytes: 0,
      }),
      resourceFee: xdr.Int64.fromString("0"),
      ext: xdr.ExtensionPoint.v0(),
    }),
    minResourceFee: "0",
    cost: { cpuInsns: "0", memBytes: "0" },
    result: { auth: [], retval },
  } as unknown as rpc.Api.SimulateTransactionSuccessResponse;
}

test("fetchQuorumThreshold builds a valid throwaway source account and decodes a real quorum_threshold", async () => {
  let simulateCalled = false;
  const server = {
    simulateTransaction: async () => {
      simulateCalled = true;
      return fakeGetSlaSimulation(3);
    },
  } as unknown as rpc.Server;

  const threshold = await fetchQuorumThreshold({
    server,
    networkPassphrase: "Test SDF Network ; September 2015",
    slaVaultContractId: "CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN",
    slaId: "0",
  });

  // Proves the function actually reached the simulated RPC path, not just
  // that it returned some value — the old bug threw before this point.
  assert.equal(simulateCalled, true, "simulateTransaction was never reached");
  assert.equal(threshold, 3);
});
