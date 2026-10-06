"use client";

import type { SLAConfig } from "@slasettle/sdk";
import { deriveQuorum } from "@slasettle/sdk";
import { LoadingState, UnavailableState } from "@/components/state-notice";
import type { PollingState } from "@/lib/use-polling";
import type { RoundStatusView } from "@/lib/use-round-status";
import { QuorumMeter } from "./quorum-meter";
import { RoundIndicator } from "./round-indicator";
import { TriggerSettlementAction } from "./trigger-settlement-action";
import { WatcherGrid } from "./watcher-grid";

/**
 * The live round: watcher check-ins from the indexer, and the tally and
 * settled flag read from the contracts. Each part reports its own
 * availability, so an indexer outage never hides on-chain data and an RPC
 * outage never hides the watcher list.
 */
export function RoundPanel({
  slaId,
  config,
  tokenDecimals,
  tokenSymbol,
  round,
  onSettled,
}: {
  slaId: bigint;
  config: SLAConfig;
  tokenDecimals: number;
  tokenSymbol: string;
  round: PollingState<RoundStatusView>;
  onSettled: () => void;
}) {
  if (!round.data) {
    return round.error ? (
      <UnavailableState tone="error" title="Current round could not be loaded" message={round.error} />
    ) : (
      <LoadingState label="Loading the current round" />
    );
  }

  const { roundId, asOf, watchers, tally, settled } = round.data;
  const quorum = tally.status === "ok" ? deriveQuorum(tally.value, config.quorumThreshold) : null;

  return (
    <div className="space-y-4">
      {roundId !== null ? (
        <RoundIndicator roundId={roundId} asOf={asOf} />
      ) : (
        <UnavailableState
          title="Current round unknown"
          message={tally.status === "unavailable" ? tally.message : "The current round could not be determined."}
        >
          The round comes from the indexer&apos;s ledger clock. This page does not use your device clock.
        </UnavailableState>
      )}

      {watchers.status === "ok" ? (
        <WatcherGrid watchers={watchers.value} />
      ) : (
        <UnavailableState title="Watcher check-ins unavailable" message={watchers.message}>
          {tally.status === "ok"
            ? "The vote tally below is still read directly from the contract."
            : "Which watchers have voted cannot be shown right now."}
        </UnavailableState>
      )}

      {roundId !== null && tally.status === "unavailable" && (
        <UnavailableState title="Vote tally unavailable" message={tally.message}>
          Quorum cannot be evaluated and settlement is disabled until the tally can be read.
        </UnavailableState>
      )}

      {quorum && tally.status === "ok" && (
        <div className="border-t border-[var(--color-border-subtle)] pt-4">
          <QuorumMeter
            votesUp={tally.value.votesUp}
            votesDown={quorum.votesDown}
            quorumThreshold={quorum.quorumThreshold}
            reached={quorum.reached}
          />
        </div>
      )}

      <div className="border-t border-[var(--color-border-subtle)] pt-4">
        <SettlementStatus
          slaId={slaId}
          config={config}
          tokenDecimals={tokenDecimals}
          tokenSymbol={tokenSymbol}
          roundId={roundId}
          votesDown={quorum?.votesDown ?? null}
          quorumReached={quorum?.reached ?? null}
          settled={settled}
          onSettled={onSettled}
        />
      </div>
    </div>
  );
}

function SettlementStatus({
  slaId,
  config,
  tokenDecimals,
  tokenSymbol,
  roundId,
  votesDown,
  quorumReached,
  settled,
  onSettled,
}: {
  slaId: bigint;
  config: SLAConfig;
  tokenDecimals: number;
  tokenSymbol: string;
  roundId: bigint | null;
  votesDown: number | null;
  quorumReached: boolean | null;
  settled: RoundStatusView["settled"];
  onSettled: () => void;
}) {
  const muted = "text-sm text-[var(--color-fg-muted)]";

  if (settled.status === "unavailable") {
    return (
      <UnavailableState title="Settled state unavailable" message={settled.message}>
        Whether this round has been settled could not be read, so settlement is disabled.
      </UnavailableState>
    );
  }
  if (settled.value) {
    return <p className="text-sm text-[var(--color-fg-secondary)]">This round has already been settled.</p>;
  }
  if (config.status !== "Active") {
    return (
      <p className="text-sm text-[var(--color-fg-secondary)]">
        This SLA is cancelled. Settlement cannot be triggered.
      </p>
    );
  }
  if (roundId === null || votesDown === null || quorumReached === null) {
    return <p className={muted}>Settlement is disabled until the round and its tally can be read.</p>;
  }
  if (!quorumReached) {
    return (
      <p className={muted}>
        Quorum has not been reached for this round, so settlement cannot be triggered.
      </p>
    );
  }
  return (
    <TriggerSettlementAction
      slaId={slaId}
      roundId={roundId}
      votesDown={votesDown}
      quorumThreshold={config.quorumThreshold}
      penaltyPerBreach={config.penaltyPerBreach}
      tokenDecimals={tokenDecimals}
      tokenSymbol={tokenSymbol}
      onSettled={onSettled}
    />
  );
}
