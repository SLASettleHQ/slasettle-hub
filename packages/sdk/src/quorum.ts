import type { RoundTally } from "./types.js";

export interface QuorumStatus {
  votesDown: number;
  quorumThreshold: number;
  /** `votesDown >= quorumThreshold`. Up votes never count toward a Down settlement. */
  reached: boolean;
  /** Further Down votes needed before quorum is reached; 0 once reached. */
  remaining: number;
}

/**
 * Derives quorum from a round tally and the SLA's `quorum_threshold`.
 * `sla_vault` owns the threshold and the watcher registry only counts votes,
 * so there is no contract call for this; it is computed from the two reads.
 */
export function deriveQuorum(tally: RoundTally, quorumThreshold: number): QuorumStatus {
  const reached = tally.votesDown >= quorumThreshold;
  return {
    votesDown: tally.votesDown,
    quorumThreshold,
    reached,
    remaining: reached ? 0 : quorumThreshold - tally.votesDown,
  };
}
