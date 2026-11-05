export function RoundIndicator({
  roundId,
  asOf,
  asOfSource,
}: {
  roundId: bigint;
  asOf: string | null;
  asOfSource: "ledger" | "round-start" | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-mono text-lg font-semibold text-[var(--color-fg-primary)]">
        Round {roundId.toString()}
      </span>
      {asOf && (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {asOfSource === "round-start" ? "round started" : "ledger time"} {new Date(asOf).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
