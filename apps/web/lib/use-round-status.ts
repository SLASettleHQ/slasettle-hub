"use client";

import { getRoundTally, isRoundSettled } from "@slasettle/sdk";
import { useEffect, useState } from "react";
import { getClock, getCurrentRound } from "./indexer";
import type { WatcherCheckStatus } from "@/components/status/watcher-status-row";

const POLL_INTERVAL_MS = 10_000;

export interface RoundWatcherView {
  address: string;
  status: WatcherCheckStatus;
}

export interface RoundStatusView {
  roundId: bigint;
  ledgerCloseTime: string;
  watchers: RoundWatcherView[];
  votesUp: number;
  votesDown: number;
  settled: boolean;
}

interface State {
  data: RoundStatusView | null;
  loading: boolean;
  error: string | null;
}

async function fetchRoundStatus(slaId: bigint): Promise<RoundStatusView> {
  // The clock is the only authoritative source for the current round_id —
  // never derived from the browser's own clock.
  const clock = await getClock();
  const roundId = clock.currentRoundId;

  const [currentRound, tally, settled] = await Promise.all([
    getCurrentRound(slaId),
    getRoundTally(slaId, roundId),
    isRoundSettled(slaId, roundId),
  ]);

  const watchers: RoundWatcherView[] = [
    ...currentRound.checkedIn.map((w) => ({ address: w.watcher, status: w.status })),
    ...currentRound.notYetCheckedIn.map((address) => ({
      address,
      status: "pending" as const,
    })),
  ];

  return {
    roundId,
    ledgerCloseTime: clock.ledgerCloseTime,
    watchers,
    votesUp: tally.votesUp,
    votesDown: tally.votesDown,
    settled,
  };
}

/**
 * Polls the current round's watcher check-ins, live tally, and settlement
 * state at a fixed interval — never derives round_id from the device clock.
 */
export function useRoundStatus(slaId: bigint) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchRoundStatus(slaId);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            data: prev.data,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load round status.",
          }));
        }
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slaId]);

  return state;
}
