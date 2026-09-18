/**
 * Mirrors the `sla_vault` contract's SLA configuration struct, as returned
 * by `get_sla` and consumed by `create_sla`. All monetary and integer
 * amounts are kept as `bigint` — never convert these to `number`.
 */
export interface SLAConfig {
  provider: string;
  token: string;
  bondAmount: bigint;
  /**
   * Display-only in v1. Not enforced as a monthly aggregate uptime
   * calculation — settlement is determined per round, not by this target.
   */
  uptimeTargetBps: number;
  quorumThreshold: number;
  penaltyPerBreach: bigint;
  beneficiary: string;
}

/**
 * Mirrors the `watcher_registry` contract's per-round vote tally, as
 * returned by `get_round_tally`. Raw vote counts only — quorum evaluation
 * belongs to `sla_vault`, not this struct.
 */
export interface RoundTally {
  votesUp: number;
  votesDown: number;
}
