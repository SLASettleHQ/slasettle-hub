"use client";

import { getRoundTally, isRoundSettled, type RoundTally } from "@slasettle/sdk";
import { useCallback } from "react";
import { getClock, getCurrentRound, type CurrentRound } from "./indexer";
import { usePolling } from "./use-polling";
import { describeReadError } from "./read-error";
import type { WatcherCheckStatus } from "@/components/status/watcher-status-row";

const POLL_INTERVAL_MS = 10_000;

export interface RoundWatcherView {
  address: string;
  status: WatcherCheckStatus;
}

/** A value that either loaded or is unavailable, never a stand-in for either. */
export type Source<T> = { status: "ok"; value: T } | { status: "unavailable"; message: string };

export interface RoundStatusView {
  /** From the indexer's ledger-derived clock, never the device clock. Null if no source could supply it. */
  roundId: bigint | null;
  /** Timestamp for roundId, selected from a source that identifies that same round. */
  asOf: string | null;
  /** Identifies whether asOf is the ledger close time or the round's start time. */
  asOfSource: "ledger" | "round-start" | null;
  /** Per-watcher check-ins, from the indexer. */
  watchers: Source<RoundWatcherView[]>;
  /** True only when watcher rows and round identity came with a coherent ledger snapshot. */
  participationVerified: boolean;
  /** Live vote tally, read from `watcher_registry` over Soroban RPC. */
  tally: Source<RoundTally>;
  /** Whether the round is settled, read from `sla_vault` over Soroban RPC. */
  settled: Source<boolean>;
  /** Required current-round and live reads succeeded; the poller and contract still enforce freshness and safety. */
  settlementReady: boolean;
}

function unavailable(reason: unknown): { status: "unavailable"; message: string } {
  return { status: "unavailable", message: describeReadError(reason) };
}

/**
 * Loads each part of the round independently so that losing one backend
 * only disables what depends on it: the indexer supplies the round and the
 * watcher check-ins, Soroban RPC supplies the tally and settled flag.
 */
export async function fetchRoundStatus(
  slaId: bigint,
  endpointHash: Uint8Array,
): Promise<RoundStatusView> {
  const [currentRoundResult] = await Promise.allSettled([getCurrentRound(slaId)]);
  const currentRound = currentRoundResult.status === "fulfilled" ? currentRoundResult.value : null;
  const currentRoundError =
    currentRoundResult.status === "rejected"
      ? currentRoundResult.reason
      : new Error("The current-round ledger snapshot is unavailable.");
  const needsClockFallback =
    currentRound === null || currentRound.ledgerSnapshot.status === "legacy";
  let clock: Awaited<ReturnType<typeof getClock>> | null = null;
  let clockError: unknown = null;
  if (needsClockFallback) {
    try {
      clock = await getClock();
    } catch (err) {
      clockError = err;
    }
  }

  let roundId: bigint | null = null;
  let asOf: string | null = null;
  let asOfSource: RoundStatusView["asOfSource"] = null;
  let participationVerified = false;
  let watchers: Source<RoundWatcherView[]>;

  const currentRoundWatchers = (value: CurrentRound): RoundWatcherView[] => [
    ...value.checkedIn.map((w) => ({ address: w.watcher, status: w.status })),
    ...value.notYetCheckedIn.map((address) => ({ address, status: "pending" as const })),
  ];

  if (currentRound?.ledgerSnapshot.status === "verified") {
    // Round identity and its timestamp come from the same latest-ledger
    // snapshot. Do not make a second indexer request on this successful path.
    roundId = currentRound.roundId;
    asOf = currentRound.ledgerSnapshot.closeTime;
    asOfSource = "ledger";
    watchers = { status: "ok", value: currentRoundWatchers(currentRound) };
    participationVerified = true;
  } else if (currentRound !== null) {
    // A pre-upgrade GREEN response remains useful for display. Its round may
    // be paired with /clock for read-only status, but its participation is
    // explicitly degraded and cannot authorize settlement.
    if (clock !== null) {
      roundId = clock.currentRoundId;
      asOf = clock.ledgerCloseTime;
      asOfSource = "ledger";
      watchers =
        clock.currentRoundId === currentRound.roundId
          ? { status: "ok", value: currentRoundWatchers(currentRound) }
          : {
              status: "unavailable",
              message: "Watcher check-ins belong to a different round than the latest network clock.",
            };
    } else {
      roundId = currentRound.roundId;
      asOf = currentRound.roundStartedAt;
      asOfSource = "round-start";
      watchers = { status: "ok", value: currentRoundWatchers(currentRound) };
    }
  } else if (clock !== null) {
    // Clock-only fallback is useful for the round label and live read-only
    // tally, while participation and settlement remain unavailable.
    roundId = clock.currentRoundId;
    asOf = clock.ledgerCloseTime;
    asOfSource = "ledger";
    watchers = unavailable(currentRoundError);
  } else {
    watchers = unavailable(currentRoundError);
  }

  if (roundId === null) {
    const reason = clockError ?? currentRoundError;
    const noRound = unavailable(reason);
    return {
      roundId,
      asOf,
      asOfSource,
      watchers,
      participationVerified,
      tally: noRound,
      settled: noRound,
      settlementReady: false,
    };
  }

  const [tallyResult, settledResult] = await Promise.allSettled([
    getRoundTally(slaId, roundId, endpointHash),
    isRoundSettled(slaId, roundId),
  ]);

  return {
    roundId,
    asOf,
    asOfSource,
    watchers,
    participationVerified,
    tally:
      tallyResult.status === "fulfilled"
        ? { status: "ok", value: tallyResult.value }
        : unavailable(tallyResult.reason),
    settled:
      settledResult.status === "fulfilled"
        ? { status: "ok", value: settledResult.value }
        : unavailable(settledResult.reason),
    settlementReady:
      participationVerified &&
      watchers.status === "ok" &&
      tallyResult.status === "fulfilled" &&
      settledResult.status === "fulfilled",
  };
}

/**
 * Polls the current round's watcher check-ins, live tally, and settlement
 * state — never derives round_id from the device clock.
 */
export function useRoundStatus(slaId: bigint, endpointHash: Uint8Array | null) {
  const fetcher = useCallback(() => {
    if (endpointHash === null) {
      return Promise.reject(new Error("The SLA endpoint commitment has not loaded yet."));
    }
    return fetchRoundStatus(slaId, endpointHash);
  }, [endpointHash, slaId]);
  return usePolling(fetcher, POLL_INTERVAL_MS, endpointHash !== null);
}
