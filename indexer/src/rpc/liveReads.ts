import { Contract, rpc, scValToNative, nativeToScVal, TransactionBuilder, Account } from "@stellar/stellar-sdk";

/**
 * A read-only, unsigned simulateTransaction call against sla_vault's
 * get_sla — used only to fetch quorum_threshold, the one field the
 * sla_created/settlement_paid events don't carry (see the db schema
 * comment). This never submits anything; simulation alone is enough for a
 * public view function, no auth entries needed since get_sla is public.
 *
 * A dummy source account is used purely because building any transaction,
 * even one that's only ever simulated, requires a source account in this
 * SDK version. Its sequence number is irrelevant — simulation doesn't
 * validate it the way actual submission would.
 */
export async function fetchQuorumThreshold(params: {
  server: rpc.Server;
  networkPassphrase: string;
  slaVaultContractId: string;
  slaId: string;
}): Promise<number> {
  const contract = new Contract(params.slaVaultContractId);
  const dummySource = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");

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
