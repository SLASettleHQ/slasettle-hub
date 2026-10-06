import { useState } from "react";
import { EmptyState } from "@/components/state-notice";
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
  // Settlements are triggered in increasing round order, so a row newer than
  // anything present when the list first rendered was received afterwards.
  // Older pages fetched by "Load more" are lower rounds and are not animated.
  const [newestInitialRound] = useState<bigint | null>(() =>
    settlements.reduce<bigint | null>((max, s) => (max === null || s.round > max ? s.round : max), null),
  );

  if (settlements.length === 0) {
    return (
      <EmptyState title="No settlements yet">
        No settlement has been triggered for this SLA. A settlement appears here after a round reaches quorum
        and someone triggers it.
      </EmptyState>
    );
  }

  return (
    <div>
      <ul>
        {settlements.map((settlement) => (
          <SettlementRow
            key={settlement.round.toString()}
            settlement={settlement}
            isNew={newestInitialRound !== null && settlement.round > newestInitialRound}
          />
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
