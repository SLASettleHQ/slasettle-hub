"use client";

import { LoadingState, UnavailableState } from "@/components/state-notice";
import { TokenAmount } from "@/components/token-amount";
import { formatBps, truncateAddress } from "@/lib/format";
import { useRoundStatus } from "@/lib/use-round-status";
import { useSettlementHistory } from "@/lib/use-settlement-history";
import { useSlaConfig } from "@/lib/use-sla-config";
import { RoundPanel } from "./round-panel";
import { SettlementList } from "./settlement-list";

const sectionClass =
  "animate-fade-in-up rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5";
const sectionHeadingClass = "text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]";

export function StatusView({ slaId }: { slaId: bigint }) {
  const slaConfig = useSlaConfig(slaId);
  const roundStatus = useRoundStatus(slaId);
  const settlements = useSettlementHistory(slaId);

  if (slaConfig.loading) {
    return (
      <div className="py-8">
        <LoadingState label={`Loading SLA #${slaId.toString()}`} lines={5} />
      </div>
    );
  }

  if (slaConfig.error || !slaConfig.data) {
    return (
      <div className="py-8">
        <UnavailableState
          tone="error"
          title={`SLA #${slaId.toString()} could not be loaded`}
          message={slaConfig.error ?? "No data was returned."}
        >
          Check that the SLA ID is correct and that the contracts are deployed on the configured network.
        </UnavailableState>
      </div>
    );
  }

  const { config, bondBalance, tokenDecimals, tokenSymbol } = slaConfig.data;

  function handleSettled() {
    // A confirmed settlement changes the bond, the round's settled flag and
    // the history, so all three are re-read from their own sources.
    slaConfig.refresh();
    roundStatus.refresh();
    void settlements.reload();
  }

  return (
    <div className="space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold text-[var(--color-fg-primary)]">
          SLA #{slaId.toString()}
        </h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300 ${
            config.status === "Active"
              ? "bg-[var(--color-status-up-bg)] text-[var(--color-status-up)]"
              : "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]"
          }`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {config.status}
        </span>
      </div>

      <section className={sectionClass} aria-labelledby="config-heading">
        <h2 id="config-heading" className={sectionHeadingClass}>
          Configuration
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm min-[480px]:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Provider</dt>
            <dd className="mt-0.5 break-all font-mono" title={config.provider}>
              {truncateAddress(config.provider)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-fg-muted)]">Beneficiary</dt>
            <dd className="mt-0.5 break-all font-mono" title={config.beneficiary}>
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
            <dt className="text-xs text-[var(--color-fg-muted)]">Bond balance (live from the contract)</dt>
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
          Uptime target: {formatBps(config.uptimeTargetBps)}. In v1 this is display information only. The
          contracts do not calculate monthly uptime against it. Settlement is decided per round by watcher
          votes, and every SLA uses the same shared watcher set.
        </p>
      </section>

      <section className={sectionClass} aria-labelledby="round-heading">
        <h2 id="round-heading" className={`${sectionHeadingClass} mb-3`}>
          Current round
        </h2>
        <RoundPanel
          slaId={slaId}
          config={config}
          tokenDecimals={tokenDecimals}
          tokenSymbol={tokenSymbol}
          round={roundStatus}
          onSettled={handleSettled}
        />
      </section>

      <section className={sectionClass} aria-labelledby="history-heading">
        <h2 id="history-heading" className={sectionHeadingClass}>
          Settlement history
        </h2>
        <div className="mt-3">
          {settlements.loading ? (
            <LoadingState label="Loading settlement history" />
          ) : settlements.error && settlements.settlements.length === 0 ? (
            <UnavailableState title="Settlement history unavailable" message={settlements.error}>
              The current configuration, bond and vote tally above are read from the contracts and are not
              affected.
            </UnavailableState>
          ) : (
            <>
              {settlements.error && (
                <div className="mb-3">
                  <UnavailableState title="Could not refresh settlement history" message={settlements.error} />
                </div>
              )}
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
                }))}
                hasMore={settlements.nextCursor !== null}
                loadingMore={settlements.loadingMore}
                onLoadMore={() => void settlements.loadMore()}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
