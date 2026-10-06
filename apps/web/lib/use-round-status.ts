"use client";

import { getRoundTally, isRoundSettled, type RoundTally } from "@slasettle/sdk";
import { useCallback } from "react";
import { getClock, getCurrentRound } from "./indexer";
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
  /** Ledger close time the round was computed from. */
  asOf: string | null;
  /** Per-watcher check-ins, from the indexer. */
  watchers: Source<RoundWatcherView[]>;
  /** Live vote tally, read from `watcher_registry` over Soroban RPC. */
  tally: Source<RoundTally>;
  /** Whether the round is settled, read from `sla_vault` over Soroban RPC. */
  settled: Source<boolean>;
}

function unavailable(reason: unknown): { status: "unavailable"; message: string } {
  return { status: "unavailable", message: describeReadError(reason) };
}

/**
 * Loads each part of the round independently so that losing one backend
 * only disables what depends on it: the indexer supplies the round and the
 * watcher check-ins, Soroban RPC supplies the tally and settled flag.
 */
export async function fetchRoundStatus(slaId: bigint): Promise<RoundStatusView> {
  const [clockResult, currentRoundResult] = await Promise.allSettled([getClock(), getCurrentRound(slaId)]);

  // The participation endpoint is computed by the indexer from the same ledger
  // clock, and is the later read, so it wins if the two ever disagree.
  const roundId =
    currentRoundResult.status === "fulfilled"
      ? currentRoundResult.value.roundId
      : clockResult.status === "fulfilled"
        ? clockResult.value.currentRoundId
        : null;

  const asOf =
    clockResult.status === "fulfilled"
      ? clockResult.value.ledgerCloseTime
      : currentRoundResult.status === "fulfilled"
        ? currentRoundResult.value.roundStartedAt
        : null;

  const watchers: Source<RoundWatcherView[]> =
    currentRoundResult.status === "fulfilled"
      ? {
          status: "ok",
          value: [
            ...currentRoundResult.value.checkedIn.map((w) => ({ address: w.watcher, status: w.status })),
            ...currentRoundResult.value.notYetCheckedIn.map((address) => ({
              address,
              status: "pending" as const,
            })),
          ],
        }
      : unavailable(currentRoundResult.reason);

  if (roundId === null) {
    const reason =
      clockResult.status === "rejected"
        ? clockResult.reason
        : new Error("The current round is unknown.");
    const noRound = unavailable(reason);
    return { roundId, asOf, watchers, tally: noRound, settled: noRound };
  }

  const [tallyResult, settledResult] = await Promise.allSettled([
    getRoundTally(slaId, roundId),
    isRoundSettled(slaId, roundId),
  ]);

  return {
    roundId,
    asOf,
    watchers,
    tally:
      tallyResult.status === "fulfilled"
        ? { status: "ok", value: tallyResult.value }
        : unavailable(tallyResult.reason),
    settled:
      settledResult.status === "fulfilled"
        ? { status: "ok", value: settledResult.value }
        : unavailable(settledResult.reason),
  };
}

/**
 * Polls the current round's watcher check-ins, live tally, and settlement
 * state — never derives round_id from the device clock.
 */
export function useRoundStatus(slaId: bigint) {
  const fetcher = useCallback(() => fetchRoundStatus(slaId), [slaId]);
  return usePolling(fetcher, POLL_INTERVAL_MS);
}
