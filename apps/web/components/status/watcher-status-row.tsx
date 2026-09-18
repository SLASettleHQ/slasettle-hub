import { truncateAddress } from "@/lib/format";

export type WatcherCheckStatus = "up" | "down" | "pending";

const STATUS_LABEL: Record<WatcherCheckStatus, string> = {
  up: "Up",
  down: "Down",
  pending: "Pending",
};

const STATUS_CLASSES: Record<WatcherCheckStatus, string> = {
  up: "bg-[var(--color-status-up-bg)] text-[var(--color-status-up)]",
  down: "bg-[var(--color-status-down-bg)] text-[var(--color-status-down)]",
  pending: "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]",
};

export function WatcherStatusRow({
  address,
  status,
}: {
  address: string;
  status: WatcherCheckStatus;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="font-mono text-sm text-[var(--color-fg-secondary)]" title={address}>
        {truncateAddress(address)}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
    </li>
  );
}
