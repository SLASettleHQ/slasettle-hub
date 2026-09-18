"use client";

import { useEffect, useRef, useState } from "react";
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
  const previousAmount = useRef(amount);
  const [justChanged, setJustChanged] = useState(false);

  // Flash only on a real balance change observed after mount (e.g. a top-up
  // or settlement) — never on the initial render.
  useEffect(() => {
    if (previousAmount.current === amount) return;
    previousAmount.current = amount;
    setJustChanged(true);
    const timeout = setTimeout(() => setJustChanged(false), 900);
    return () => clearTimeout(timeout);
  }, [amount]);

  return (
    <span
      className={`rounded font-mono tabular-nums ${justChanged ? "animate-flash" : ""} ${className ?? ""}`}
      style={justChanged ? ({ "--flash-color": "var(--color-accent)" } as React.CSSProperties) : undefined}
    >
      {formatTokenAmount(amount, decimals)}{" "}
      <span className="text-[var(--color-fg-muted)]">{symbol}</span>
    </span>
  );
}
