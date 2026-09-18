import { formatTokenAmount } from "@/lib/format";

export function TokenAmount({
  amount,
  decimals,
  symbol,
  className,
}: {
  amount: bigint;
  decimals: number;
  symbol: string;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${className ?? ""}`}>
      {formatTokenAmount(amount, decimals)}{" "}
      <span className="text-[var(--color-fg-muted)]">{symbol}</span>
    </span>
  );
}
