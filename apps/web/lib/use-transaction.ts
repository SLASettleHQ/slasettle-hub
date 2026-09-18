"use client";

import { rpc, type Transaction } from "@stellar/stellar-sdk";
import { useCallback, useState } from "react";
import {
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
  | { status: "confirmed"; hash: string }
  | { status: "failed"; hash?: string; message: string };

/**
 * Drives a build -> sign -> submit -> poll flow for a single write
 * transaction, exposing every stage section 19/22 require the UI to show:
 * signing, submission, and confirmation (or a clear failure with whatever
 * transaction reference exists).
 */
export function useTransaction() {
  const [state, setState] = useState<TransactionState>({ status: "idle" });

  const run = useCallback(
    async (
      buildUnsignedTx: () => Promise<Transaction>,
      wallet: WalletConnection,
    ): Promise<SubmittedTransaction | undefined> => {
      setState({ status: "building" });
      try {
        const unsignedTx = await buildUnsignedTx();

        setState({ status: "signing" });
        const signedTx = await signTransaction(unsignedTx, wallet);

        setState({ status: "submitting" });
        const result = await submitTransaction(signedTx);

        if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          setState({ status: "confirmed", hash: result.hash });
        } else {
          setState({
            status: "failed",
            hash: result.hash,
            message:
              result.status === rpc.Api.GetTransactionStatus.NOT_FOUND
                ? "The transaction was submitted but its final status could not be confirmed yet. Check the transaction hash on an explorer."
                : "The transaction was included but failed on-chain.",
          });
        }
        return result;
      } catch (err) {
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
