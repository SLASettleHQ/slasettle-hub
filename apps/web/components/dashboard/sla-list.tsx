import { EmptyState, LoadingState, UnavailableState } from "@/components/state-notice";
import type { ProviderSlaFailure, ProviderSlaView } from "@/lib/use-provider-slas";
import { SlaCard } from "./sla-card";

export function SlaList({
  slas,
  failures = [],
  loading,
  error,
  onChanged,
}: {
  slas: ProviderSlaView[];
  failures?: ProviderSlaFailure[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}) {
  // Discovery failed and nothing was ever loaded: this is not "no SLAs".
  if (error && slas.length === 0) {
    return (
      <UnavailableState tone="error" title="Your SLAs could not be listed" message={error}>
        SLA discovery uses the indexer. Contract reads and transactions are separate, so a public status page for
        a known SLA ID still works.
      </UnavailableState>
    );
  }

  if (loading && slas.length === 0 && failures.length === 0) {
    return <LoadingState label="Loading your SLAs" lines={4} />;
  }

  if (slas.length === 0 && failures.length === 0) {
    return (
      <EmptyState title="No SLAs yet">
        This wallet has not created an SLA. Use the form above to create one. It will appear here once the
        transaction is confirmed and indexed.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <UnavailableState tone="error" title="Could not refresh your SLAs" message={error}>
          The list below is from the last successful load.
        </UnavailableState>
      )}
      {failures.length > 0 && (
        <UnavailableState
          tone="error"
          title={`${failures.length} ${failures.length === 1 ? "SLA" : "SLAs"} could not be read`}
          message="The indexer lists these IDs, but their live state could not be read from the contract."
        >
          <ul className="list-disc pl-5">
            {failures.map((failure) => (
              <li key={failure.slaId.toString()}>
                SLA #{failure.slaId.toString()}: {failure.message}
              </li>
            ))}
          </ul>
        </UnavailableState>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {slas.map((sla) => (
          <SlaCard key={sla.slaId.toString()} sla={sla} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}
