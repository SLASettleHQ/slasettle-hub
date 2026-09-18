import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";

export interface SdkConfig {
  sorobanRpcUrl: string;
  networkPassphrase: string;
  slaVaultContractId: string;
  watcherRegistryContractId: string;
}

export class MissingSdkConfigError extends Error {
  constructor(public readonly missingKeys: string[]) {
    super(
      `Missing required SLASettle configuration: ${missingKeys.join(", ")}. ` +
        "Set these environment variables before using the SDK.",
    );
    this.name = "MissingSdkConfigError";
  }
}

function readConfig(): SdkConfig {
  const env = {
    sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    slaVaultContractId: process.env.NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID,
    watcherRegistryContractId: process.env.NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID,
  };

  const missingKeys = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new MissingSdkConfigError(missingKeys);
  }

  return env as SdkConfig;
}

let cachedConfig: SdkConfig | undefined;
let cachedServer: rpc.Server | undefined;

/** Reads and validates the SLASettle environment configuration. Throws {@link MissingSdkConfigError} if incomplete. */
export function getSdkConfig(): SdkConfig {
  if (!cachedConfig) {
    cachedConfig = readConfig();
  }
  return cachedConfig;
}

/** Returns a shared Soroban RPC server instance configured from the environment. */
export function getRpcServer(): rpc.Server {
  if (!cachedServer) {
    const config = getSdkConfig();
    cachedServer = new rpc.Server(config.sorobanRpcUrl);
  }
  return cachedServer;
}

/** Thrown when a Soroban RPC simulation fails, e.g. the contract call reverted. */
export class SorobanSimulationError extends Error {
  constructor(
    public readonly contractId: string,
    public readonly method: string,
    public readonly rpcMessage: string,
  ) {
    super(`Simulating "${method}" on contract ${contractId} failed: ${rpcMessage}`);
    this.name = "SorobanSimulationError";
  }
}

/**
 * A throwaway, unfunded source account used only to satisfy the transaction
 * envelope shape required to simulate a read-only contract invocation.
 * Soroban RPC's `simulateTransaction` does not submit or validate this
 * account against the ledger, so it does not need to exist or be funded.
 */
function throwawaySourceAccount(): Account {
  return new Account(Keypair.random().publicKey(), "0");
}

/**
 * Simulates a read-only contract invocation through Soroban RPC and returns
 * the decoded result. Does not submit anything to the network.
 */
export async function simulateReadCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  const config = getSdkConfig();
  const server = getRpcServer();
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(throwawaySourceAccount(), {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new SorobanSimulationError(contractId, method, simulation.error);
  }

  if (!simulation.result) {
    throw new SorobanSimulationError(
      contractId,
      method,
      "the simulation returned no result",
    );
  }

  return scValToNative(simulation.result.retval);
}

/**
 * Builds an unsigned transaction that invokes a write method on a contract,
 * with Soroban resource fees and footprint filled in via simulation. The
 * caller's wallet is responsible for signing and submitting it — the SDK
 * never signs transactions.
 */
export async function buildInvokeTx(
  callerAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<Transaction> {
  const config = getSdkConfig();
  const server = getRpcServer();
  const contract = new Contract(contractId);
  const sourceAccount = await server.getAccount(callerAddress);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return server.prepareTransaction(tx);
}
