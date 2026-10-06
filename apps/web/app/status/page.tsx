import type { Metadata } from "next";
import Link from "next/link";
import { SlaLookupForm } from "@/components/landing/sla-lookup-form";

export const metadata: Metadata = {
  title: "SLA status | SLASettle",
  description: "Look up the public on-chain status of an SLA by its ID. No wallet is needed.",
};

export default function StatusIndexPage() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <h1 className="text-2xl font-semibold text-[var(--color-fg-primary)]">SLA status</h1>
      <p className="mt-3 text-[var(--color-fg-secondary)]">
        Enter an SLA ID to see its bond, configuration, the current round, watcher check-ins and settlement
        history. Everything on a status page is public, and no wallet is needed to view it.
      </p>
      <div className="mt-6">
        <SlaLookupForm />
      </div>
      <p className="mt-6 text-sm text-[var(--color-fg-muted)]">
        Provider with a wallet? Your SLA IDs are listed on the{" "}
        <Link href="/dashboard" className="text-[var(--color-accent)] underline underline-offset-2">
          dashboard
        </Link>
        .
      </p>
    </div>
  );
}
