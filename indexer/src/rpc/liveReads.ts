import { Contract, rpc, scValToNative, nativeToScVal, TransactionBuilder, Account, Keypair } from "@stellar/stellar-sdk";

/**
 * A read-only, unsigned simulateTransaction call against sla_vault's
 * get_sla — used only to fetch quorum_threshold, the one field the
 * sla_created/settlement_paid events don't carry (see the db schema
 * comment). This never submits anything; simulation alone is enough for a
 * public view function, no auth entries needed since get_sla is public.
 *
 * A dummy source account is used purely because building any transaction,
 * even one that's only ever simulated, requires a source account in this
 * SDK version. Its sequence number is irrelevant, and it never needs to
 * exist on the ledger — simulateTransaction doesn't validate either the
 * way actual submission would. It does, however, need to be a
 * StrKey-valid G... address, or the SDK's own Account constructor rejects
 * it before any network call happens. A freshly generated random keypair's
 * public key is always valid and needs no real funds or secret material,
 * matching the same throwaway-account pattern used for read-only
 * simulation elsewhere in this project (packages/sdk/src/client.ts).
 */
export async function fetchQuorumThreshold(params: {
  server: rpc.Server;
  networkPassphrase: string;
  slaVaultContractId: string;
  slaId: string;
}): Promise<number> {
  const contract = new Contract(params.slaVaultContractId);
  const dummySource = new Account(Keypair.random().publicKey(), "0");

  const slaIdArg = nativeToScVal(BigInt(params.slaId), { type: "u64" });

  const tx = new TransactionBuilder(dummySource, {
    fee: "100",
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(contract.call("get_sla", slaIdArg))
    .setTimeout(30)
    .build();

  const sim = await params.server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`get_sla simulation failed for sla_id ${params.slaId}: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`get_sla simulation for sla_id ${params.slaId} returned no result`);
  }

  const decoded = scValToNative(sim.result.retval) as { quorum_threshold: unknown };
  const threshold = Number(decoded.quorum_threshold);
  if (!Number.isFinite(threshold)) {
    throw new Error(`get_sla for sla_id ${params.slaId} returned a non-numeric quorum_threshold`);
  }
  return threshold;
}
