"use client";

import { TokenAmount } from "@/components/token-amount";
import { truncateAddress } from "@/lib/format";
import { useRoundStatus } from "@/lib/use-round-status";
import { useSettlementHistory } from "@/lib/use-settlement-history";
import { useSlaConfig } from "@/lib/use-sla-config";
import { QuorumMeter } from "./quorum-meter";
import { RoundIndicator } from "./round-indicator";
import { SettlementList } from "./settlement-list";
import { TriggerSettlementAction } from "./trigger-settlement-action";
import { WatcherGrid } from "./watcher-grid";

export function StatusView({ slaId }: { slaId: bigint }) {
  const slaConfig = useSlaConfig(slaId);
  const roundStatus = useRoundStatus(slaId);
  const settlements = useSettlementHistory(slaId);

  if (slaConfig.loading) {
    return (
      <p role="status" className="py-12 text-sm text-[var(--color-fg-muted)]">
        Loading SLA #{slaId.toString()}&hellip;
      </p>
    );
  }

  if (slaConfig.error || !slaConfig.data) {
    return (
      <p role="alert" className="py-12 text-sm text-[var(--color-status-down)]">
        Could not load SLA #{slaId.toString()}: {slaConfig.error ?? "not found"}. Check that the SLA
        ID is correct and the contract is deployed on the configured network.
      </p>
    );
  }

  const { config, bondBalance, tokenDecimals, tokenSymbol } = slaConfig.data;
  const quorumReached = roundStatus.data ? roundStatus.data.votesDown >= config.quorumThreshold : false;
  const canTrigger =
    config.status === "Active" && roundStatus.data !== null && quorumReached && !roundStatus.data.settled;

  return (
    <div className="space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold text-[var(--color-fg-primary)]">
          SLA #{slaId.toString()}
        </h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            config.status === "Active"
              ? "bg-[var(--color-status-up-bg)] text-[var(--color-status-up)]"
              : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]"
          }`}
        >
          {config.status}
        </span>
      </div>

      <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
          Configuration
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Provider</dt>
            <dd className="mt-0.5 font-mono" title={config.provider}>
              {truncateAddress(config.provider)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Beneficiary</dt>
            <dd className="mt-0.5 font-mono" title={config.beneficiary}>
              {truncateAddress(config.beneficiary)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Token</dt>
            <dd className="mt-0.5 font-mono" title={config.token}>
              {truncateAddress(config.token)} ({tokenSymbol})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Bond balance</dt>
            <dd className="mt-0.5">
              <TokenAmount amount={bondBalance} decimals={tokenDecimals} symbol={tokenSymbol} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Penalty per breach</dt>
            <dd className="mt-0.5">
              <TokenAmount amount={config.penaltyPerBreach} decimals={tokenDecimals} symbol={tokenSymbol} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Quorum threshold</dt>
            <dd className="mt-0.5 font-mono">{config.quorumThreshold} Down votes</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-[var(--color-fg-muted)]">
          Uptime target ({(config.uptimeTargetBps / 100).toFixed(2)}%) is display-only in v1 — it is not
          computed as a monthly aggregate or enforced. Settlement fires per round when watchers reach
          quorum on Down.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        {roundStatus.data ? (
          <RoundIndicator roundId={roundStatus.data.roundId} ledgerCloseTime={roundStatus.data.ledgerCloseTime} />
        ) : roundStatus.error ? (
          <p role="alert" className="text-sm text-[var(--color-status-down)]">
            Could not load round status: {roundStatus.error}
          </p>
        ) : (
          <p role="status" className="text-sm text-[var(--color-fg-muted)]">
            Loading current round&hellip;
          </p>
        )}

        {roundStatus.data && (
          <>
            <div className="mt-4">
              <WatcherGrid watchers={roundStatus.data.watchers} />
            </div>
            <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
              <QuorumMeter
                votesUp={roundStatus.data.votesUp}
                votesDown={roundStatus.data.votesDown}
                quorumThreshold={config.quorumThreshold}
                reached={quorumReached}
              />
            </div>
            <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
              {roundStatus.data.settled ? (
                <p className="text-sm text-[var(--color-fg-secondary)]">
                  This round has already been settled.
                </p>
              ) : config.status !== "Active" ? (
                <p className="text-sm text-[var(--color-fg-secondary)]">
                  This SLA is cancelled — settlement cannot be triggered.
                </p>
              ) : canTrigger ? (
                <TriggerSettlementAction
                  slaId={slaId}
                  roundId={roundStatus.data.roundId}
                  onSettled={slaConfig.refresh}
                />
              ) : (
                <p className="text-sm text-[var(--color-fg-muted)]">
                  Quorum not yet reached &mdash; settlement cannot be triggered for this round.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
          Settlement history
        </h2>
        <div className="mt-3">
          {settlements.error ? (
            <p role="alert" className="text-sm text-[var(--color-status-down)]">
              Could not load settlement history: {settlements.error}
            </p>
          ) : settlements.loading ? (
            <p role="status" className="text-sm text-[var(--color-fg-muted)]">
              Loading settlement history&hellip;
            </p>
          ) : (
            <SettlementList
              settlements={settlements.settlements.map((s) => ({
                round: s.roundId,
                votesUp: s.votesUp,
                votesDown: s.votesDown,
                quorumThreshold: s.quorumThreshold,
                penaltyAmount: s.penaltyAmount,
                tokenDecimals,
                tokenSymbol,
                transactionHash: s.txHash,
                explorerUrl: s.explorerUrl,
              }))}
              hasMore={settlements.nextCursor !== null}
              loadingMore={settlements.loadingMore}
              onLoadMore={() => void settlements.loadMore()}
            />
          )}
        </div>
      </section>
    </div>
  );
}
