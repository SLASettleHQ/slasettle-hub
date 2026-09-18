export function QuorumMeter({
  votesUp,
  votesDown,
  quorumThreshold,
  reached,
}: {
  votesUp: number;
  votesDown: number;
  quorumThreshold: number;
  reached: boolean;
}) {
  const progress = quorumThreshold > 0 ? Math.min(votesDown / quorumThreshold, 1) : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-fg-primary)]">
          {votesUp} up &middot; {votesDown} down &middot; quorum requires {quorumThreshold}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            reached
              ? "bg-[var(--color-status-down-bg)] text-[var(--color-status-down)]"
              : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]"
          }`}
        >
          {reached ? "Quorum reached" : "Quorum not reached"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={votesDown}
        aria-valuemin={0}
        aria-valuemax={quorumThreshold}
        aria-label="Down votes toward quorum"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-raised)]"
      >
        <div
          className="h-full rounded-full bg-[var(--color-status-down)] transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
