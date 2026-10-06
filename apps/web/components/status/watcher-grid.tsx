import { EmptyState } from "@/components/state-notice";
import { WatcherStatusRow, type WatcherCheckStatus } from "./watcher-status-row";

export interface WatcherCheckIn {
  address: string;
  status: WatcherCheckStatus;
}

export function WatcherGrid({ watchers }: { watchers: WatcherCheckIn[] }) {
  if (watchers.length === 0) {
    return (
      <EmptyState title="No registered watchers">
        The indexer lists no registered watchers, so no votes can arrive for this round.
      </EmptyState>
    );
  }

  const checkedIn = watchers.filter((w) => w.status !== "pending").length;

  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-fg-primary)]">
        {checkedIn} of {watchers.length} watchers checked in
      </p>
      {checkedIn === 0 && (
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
          No watcher has voted yet in this round.
        </p>
      )}
      <ul className="mt-2 divide-y divide-[var(--color-border-subtle)]">
        {watchers.map((watcher) => (
          <WatcherStatusRow key={watcher.address} address={watcher.address} status={watcher.status} />
        ))}
      </ul>
    </div>
  );
}
