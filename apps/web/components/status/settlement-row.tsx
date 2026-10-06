import { TokenAmount } from "@/components/token-amount";
import { TransactionEvidence } from "./transaction-evidence";

export interface Settlement {
  round: bigint;
  votesUp: number;
  votesDown: number;
  quorumThreshold: number;
  penaltyAmount: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
  transactionHash: string;
}

export function SettlementRow({ settlement, isNew = false }: { settlement: Settlement; isNew?: boolean }) {
  return (
    <li className={`${isNew ? "animate-fade-in-up " : ""}grid gap-2 border-b border-[var(--color-border-subtle)] py-3 last:border-b-0 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4`}>
      <span className="font-mono text-xs text-[var(--color-fg-muted)]">
        Round {settlement.round.toString()}
      </span>
      <span className="text-xs text-[var(--color-fg-secondary)]">
        {settlement.votesUp} up &middot; {settlement.votesDown} down &middot; quorum{" "}
        {settlement.quorumThreshold}
      </span>
      <TokenAmount
        amount={settlement.penaltyAmount}
        decimals={settlement.tokenDecimals}
        symbol={settlement.tokenSymbol}
        className="text-sm"
      />
      <TransactionEvidence transactionHash={settlement.transactionHash} />
    </li>
  );
}
