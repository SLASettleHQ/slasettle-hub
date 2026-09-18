import { SettlementRow, type Settlement } from "./settlement-row";

export function SettlementList({
  settlements,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  settlements: Settlement[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  if (settlements.length === 0) {
    return (
      <p className="py-6 text-sm text-[var(--color-fg-muted)]">
        No settlements have been triggered for this SLA yet.
      </p>
    );
  }

  return (
    <div>
      <ul>
        {settlements.map((settlement) => (
          <SettlementRow key={settlement.round.toString()} settlement={settlement} />
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-3 w-full rounded-md border border-[var(--color-border-default)] py-1.5 text-xs font-medium text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)] disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
