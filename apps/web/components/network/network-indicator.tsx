"use client";

import { getConfiguredNetworkPassphrase, labelForNetworkPassphrase } from "@/lib/network";
import { useWallet } from "../wallet/wallet-provider";

export function NetworkIndicator() {
  const { status, connection } = useWallet();
  const configuredPassphrase = getConfiguredNetworkPassphrase();

  if (!configuredPassphrase) {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-down-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-status-down)]"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        Network not configured
      </span>
    );
  }

  const configuredLabel = labelForNetworkPassphrase(configuredPassphrase);
  const mismatched =
    status === "connected" &&
    connection !== null &&
    connection.networkPassphrase !== configuredPassphrase;

  if (mismatched) {
    return (
      <span
        role="status"
        title={`Wallet is on "${connection.network}"; this app is configured for ${configuredLabel}.`}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-pending-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-status-pending)]"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        Wallet network mismatch
      </span>
    );
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-neutral-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-status-neutral)]"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {configuredLabel}
    </span>
  );
}
