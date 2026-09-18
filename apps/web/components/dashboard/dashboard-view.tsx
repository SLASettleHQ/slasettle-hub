"use client";

import { useWallet } from "@/components/wallet/wallet-provider";
import { useProviderSlas } from "@/lib/use-provider-slas";
import { CreateSlaForm } from "./create-sla-form";
import { SlaList } from "./sla-list";

export function DashboardView() {
  const { status, connection, connect } = useWallet();

  return (
    <div className="py-8">
      <h1 className="text-2xl font-semibold text-[var(--color-fg-primary)]">Dashboard</h1>

      {status === "checking" && (
        <p role="status" className="mt-4 text-sm text-[var(--color-fg-muted)]">
          Checking wallet connection&hellip;
        </p>
      )}

      {(status === "unavailable" || (status !== "checking" && !connection)) && (
        <div className="mt-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 text-center">
          <p className="text-sm text-[var(--color-fg-secondary)]">
            {status === "unavailable"
              ? "Freighter isn't installed in this browser. Install it to manage SLAs from this dashboard."
              : "Connect your wallet to create and manage your SLAs."}
          </p>
          {status !== "unavailable" && (
            <button
              type="button"
              onClick={() => void connect()}
              className="mt-4 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
            >
              Connect Wallet
            </button>
          )}
        </div>
      )}

      {status === "connected" && connection && <ConnectedDashboard address={connection.address} />}
    </div>
  );
}

function ConnectedDashboard({ address }: { address: string }) {
  const { slas, loading, error, refresh } = useProviderSlas(address);

  return (
    <div className="mt-6 space-y-8">
      <CreateSlaForm onCreated={refresh} />
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-fg-primary)]">Your SLAs</h2>
        <div className="mt-3">
          <SlaList slas={slas} loading={loading} error={error} onChanged={refresh} />
        </div>
      </section>
    </div>
  );
}
