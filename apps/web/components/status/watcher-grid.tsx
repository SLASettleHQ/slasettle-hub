import { WatcherStatusRow, type WatcherCheckStatus } from "./watcher-status-row";

export interface WatcherCheckIn {
  address: string;
  status: WatcherCheckStatus;
}

export function WatcherGrid({ watchers }: { watchers: WatcherCheckIn[] }) {
  const checkedIn = watchers.filter((w) => w.status !== "pending").length;

  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-fg-primary)]">
        {checkedIn} of {watchers.length} watchers checked in
      </p>
      <ul className="mt-2 divide-y divide-[var(--color-border-subtle)]">
        {watchers.map((watcher) => (
          <WatcherStatusRow key={watcher.address} address={watcher.address} status={watcher.status} />
        ))}
      </ul>
    </div>
  );
}
