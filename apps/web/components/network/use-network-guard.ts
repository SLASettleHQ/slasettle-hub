"use client";

import { checkWalletNetwork } from "@/lib/network";
import { useWallet } from "../wallet/wallet-provider";

export interface NetworkGuard {
  /** True when a connected wallet may not be used to submit transactions. */
  blocked: boolean;
  /** Plain explanation to show the user while `blocked` is true. */
  message: string | null;
}

/**
 * UI state for write actions. With no wallet connected nothing is blocked
 * here (the existing connect prompts apply). The transaction layer enforces
 * the same rule on its own, so this only drives disabled state and wording.
 */
export function useNetworkGuard(): NetworkGuard {
  const { connection } = useWallet();
  if (!connection) {
    return { blocked: false, message: null };
  }
  const check = checkWalletNetwork(connection.networkPassphrase);
  return check.allowed ? { blocked: false, message: null } : { blocked: true, message: check.message };
}
