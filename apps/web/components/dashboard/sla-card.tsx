import Link from "next/link";
import { TokenAmount } from "@/components/token-amount";
import { truncateAddress } from "@/lib/format";
import type { ProviderSlaView } from "@/lib/use-provider-slas";
import { CancelSlaAction } from "./cancel-sla-action";
import { TopUpBondForm } from "./top-up-bond-form";
import { WithdrawBondAction } from "./withdraw-bond-action";

export function SlaCard({ sla, onChanged }: { sla: ProviderSlaView; onChanged: () => void }) {
  const { slaId, config, bondBalance, tokenDecimals, tokenSymbol } = sla;

  return (
    <div className="animate-fade-in-up rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/status/${slaId}`}
          className="font-mono text-sm font-semibold text-[var(--color-fg-primary)] hover:underline"
        >
          SLA #{slaId.toString()}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            config.status === "Active"
              ? "bg-[var(--color-status-up-bg)] text-[var(--color-status-up)]"
              : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]"
          }`}
        >
          {config.status}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[var(--color-fg-muted)]">Bond balance</dt>
          <dd className="mt-0.5">
            <TokenAmount amount={bondBalance} decimals={tokenDecimals} symbol={tokenSymbol} />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Penalty per breach</dt>
          <dd className="mt-0.5">
            <TokenAmount amount={config.penaltyPerBreach} decimals={tokenDecimals} symbol={tokenSymbol} />
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Quorum threshold</dt>
          <dd className="mt-0.5 font-mono">{config.quorumThreshold} Down votes</dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Uptime target (display only)</dt>
          <dd className="mt-0.5 font-mono">{(config.uptimeTargetBps / 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Beneficiary</dt>
          <dd className="mt-0.5 font-mono" title={config.beneficiary}>
            {truncateAddress(config.beneficiary)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Token</dt>
          <dd className="mt-0.5 font-mono" title={config.token}>
            {truncateAddress(config.token)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
        {config.status === "Active" ? (
          <div className="flex flex-col gap-3">
            <TopUpBondForm
              slaId={slaId}
              tokenDecimals={tokenDecimals}
              tokenSymbol={tokenSymbol}
              onSuccess={onChanged}
            />
            <CancelSlaAction slaId={slaId} onSuccess={onChanged} />
          </div>
        ) : (
          <WithdrawBondAction slaId={slaId} onSuccess={onChanged} />
        )}
      </div>
    </div>
  );
}
