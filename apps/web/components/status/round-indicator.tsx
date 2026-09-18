export function RoundIndicator({
  roundId,
  ledgerCloseTime,
}: {
  roundId: bigint;
  ledgerCloseTime: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-lg font-semibold text-[var(--color-fg-primary)]">
        Round {roundId.toString()}
      </span>
      <span className="text-xs text-[var(--color-fg-muted)]">
        as of {new Date(ledgerCloseTime).toLocaleTimeString()}
      </span>
    </div>
  );
}
