"use client";

import { rpc, type Transaction } from "@stellar/stellar-sdk";
import { useCallback, useState } from "react";
import { checkWalletNetwork } from "./network";
import {
  isUserRejection,
  signTransaction,
  submitTransaction,
  type SubmittedTransaction,
  type WalletConnection,
} from "./wallet";

export type TransactionState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "signing" }
  | { status: "submitting" }
  /** Accepted by the network, not yet in a ledger. Not a success. */
  | { status: "pending"; hash: string }
  | { status: "confirmed"; hash: string }
  /** Submitted, but polling ended without a final result. The outcome is unknown. */
  | { status: "unconfirmed"; hash: string; message: string }
  /** The user declined in their wallet. Nothing was submitted. */
  | { status: "rejected"; message: string }
  | { status: "failed"; hash?: string; message: string };

/** True while a transaction is between "user clicked" and a terminal state. */
export function isTransactionBusy(state: TransactionState): boolean {
  return (
    state.status === "building" ||
    state.status === "signing" ||
    state.status === "submitting" ||
    state.status === "pending"
  );
}

/**
 * Drives a build -> sign -> submit -> poll flow for a single write
 * transaction, exposing every stage the UI needs to show: signing,
 * submission, pending confirmation, and a confirmed, failed, rejected or
 * unconfirmed result, each with whatever transaction reference exists.
 */
export function useTransaction() {
  const [state, setState] = useState<TransactionState>({ status: "idle" });

  const run = useCallback(
    async (
      buildUnsignedTx: () => Promise<Transaction>,
      wallet: WalletConnection,
    ): Promise<SubmittedTransaction | undefined> => {
      // Every write path goes through this function, so this is the one place
      // that stops a mismatched wallet before anything is built or signed.
      const networkCheck = checkWalletNetwork(wallet.networkPassphrase);
      if (!networkCheck.allowed) {
        setState({ status: "failed", message: networkCheck.message });
        return undefined;
      }

      setState({ status: "building" });
      try {
        const unsignedTx = await buildUnsignedTx();

        setState({ status: "signing" });
        const signedTx = await signTransaction(unsignedTx, wallet);

        setState({ status: "submitting" });
        const result = await submitTransaction(signedTx, {
          onSubmitted: (hash) => setState({ status: "pending", hash }),
        });

        if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setState({ status: "confirmed", hash: result.hash });
        } else if (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          setState({
            status: "unconfirmed",
            hash: result.hash,
            message:
              "The transaction was submitted but its final status could not be confirmed yet. Check the transaction hash on an explorer before retrying.",
          });
        } else {
          setState({
            status: "failed",
            hash: result.hash,
            message: "The transaction was included but failed on-chain.",
          });
        }
        return result;
      } catch (err) {
        if (isUserRejection(err)) {
          setState({
            status: "rejected",
            message: "You declined the request in your wallet. Nothing was submitted.",
          });
          return undefined;
        }
        // Anything thrown here already carries a deliberate, specific
        // message — from WalletError, from a form's own validation inside
        // buildUnsignedTx, or from the SDK/RPC layer — so surface it
        // directly rather than masking it with a generic fallback.
        setState({
          status: "failed",
          message:
            err instanceof Error
              ? err.message
              : "The transaction could not be completed. Check your wallet and try again.",
        });
        return undefined;
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}
