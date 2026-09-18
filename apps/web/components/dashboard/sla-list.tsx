import type { ProviderSlaView } from "@/lib/use-provider-slas";
import { SlaCard } from "./sla-card";

export function SlaList({
  slas,
  loading,
  error,
  onChanged,
}: {
  slas: ProviderSlaView[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-[var(--color-status-down)] bg-[var(--color-status-down-bg)] p-4 text-sm text-[var(--color-status-down)]">
        Could not load your SLAs: {error}
      </p>
    );
  }

  if (loading && slas.length === 0) {
    return (
      <p role="status" className="text-sm text-[var(--color-fg-muted)]">
        Loading your SLAs&hellip;
      </p>
    );
  }

  if (slas.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-fg-muted)]">
        You haven&apos;t created any SLAs yet. Use the form above to create your first one.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {slas.map((sla) => (
        <SlaCard key={sla.slaId.toString()} sla={sla} onChanged={onChanged} />
      ))}
    </div>
  );
}
