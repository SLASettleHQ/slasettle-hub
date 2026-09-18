import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";
import {
  TransactionBuilder,
  rpc,
  type FeeBumpTransaction,
  type Transaction,
} from "@stellar/stellar-sdk";
import { getRpcServer, getSdkConfig } from "@slasettle/sdk";

export interface WalletConnection {
  address: string;
  network: string;
  networkPassphrase: string;
}

/** Thrown when Freighter is unavailable, refuses access, or reports an error. */
export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

function throwIfFreighterError(error: { code: number; message: string } | undefined): void {
  if (error) {
    throw new WalletError(error.message, error.code);
  }
}

/** Whether the Freighter browser extension is installed and reachable. */
export async function isFreighterAvailable(): Promise<boolean> {
  try {
    const result = await isConnected();
    return !result.error && result.isConnected;
  } catch {
    return false;
  }
}

/**
 * Silently reconnects to a previously authorized Freighter account, without
 * prompting the user. Returns `null` if Freighter is unavailable or no
 * account was previously authorized for this site.
 */
export async function getActiveWallet(): Promise<WalletConnection | null> {
  const addressResult = await getAddress();
  if (addressResult.error || !addressResult.address) {
    return null;
  }

  const networkResult = await getNetworkDetails();
  throwIfFreighterError(networkResult.error);

  return {
    address: addressResult.address,
    network: networkResult.network,
    networkPassphrase: networkResult.networkPassphrase,
  };
}

/** Prompts the user to grant this site access to their Freighter account. */
export async function connectWallet(): Promise<WalletConnection> {
  const accessResult = await requestAccess();
  throwIfFreighterError(accessResult.error);

  const networkResult = await getNetworkDetails();
  throwIfFreighterError(networkResult.error);

  return {
    address: accessResult.address,
    network: networkResult.network,
    networkPassphrase: networkResult.networkPassphrase,
  };
}

/**
 * Requests a signature for an unsigned transaction built by the SDK. The
 * SDK never signs transactions itself — this is the only place a signature
 * is requested, and it always goes through Freighter. Rejects with
 * {@link WalletError} if the user declines or Freighter reports an error.
 */
export async function signTransaction(
  unsignedTx: Transaction,
  wallet: WalletConnection,
): Promise<Transaction | FeeBumpTransaction> {
  const result = await freighterSignTransaction(unsignedTx.toXDR(), {
    networkPassphrase: wallet.networkPassphrase,
    address: wallet.address,
  });
  throwIfFreighterError(result.error);

  return TransactionBuilder.fromXDR(result.signedTxXdr, wallet.networkPassphrase);
}

export interface SubmittedTransaction {
  hash: string;
  status: rpc.Api.GetTransactionStatus;
  response: rpc.Api.GetTransactionResponse;
}

/**
 * Submits a signed transaction to the network configured via
 * NEXT_PUBLIC_SOROBAN_RPC_URL, then polls until a definitive success or
 * failure status is reached (or polling attempts are exhausted).
 */
export async function submitTransaction(
  signedTx: Transaction | FeeBumpTransaction,
): Promise<SubmittedTransaction> {
  getSdkConfig();
  const server = getRpcServer();

  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new WalletError(
      `The network rejected the transaction before it could be included: ${sendResult.hash}`,
    );
  }

  const response = await server.pollTransaction(sendResult.hash, {
    attempts: 30,
    sleepStrategy: rpc.LinearSleepStrategy,
  });

  return { hash: sendResult.hash, status: response.status, response };
}

/**
 * Convenience wrapper that signs an unsigned transaction from the SDK and
 * submits it, returning once a definitive on-chain status is known.
 */
export async function signAndSubmit(
  unsignedTx: Transaction,
  wallet: WalletConnection,
): Promise<SubmittedTransaction> {
  const signed = await signTransaction(unsignedTx, wallet);
  return submitTransaction(signed);
}
