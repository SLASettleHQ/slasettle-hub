/**
 * Mirrors the `sla_vault` contract's `SLAStatus` enum
 * (SLASettle-contract-spec.md). `Active` is the only state that permits
 * `top_up_bond` / `trigger_settlement`; `withdraw_remaining_bond` requires
 * `Cancelled`.
 */
export const SLA_STATUS_VARIANTS = ["Active", "Cancelled"] as const;
export type SLAStatus = (typeof SLA_STATUS_VARIANTS)[number];

/**
 * Mirrors the `watcher_registry` contract's `CheckStatus` enum
 * (SLASettle-contract-spec.md). This is the type of `submit_check`'s
 * `status` argument on-chain; the frontend never calls `submit_check`
 * itself (that's the watcher daemon's job), so this shows up in the SDK
 * only as a documented shared concept, not as a value any read function
 * returns directly — per-watcher check status for display comes from the
 * indexer's current-round endpoint instead (see lib/indexer.ts).
 */
export const CHECK_STATUS_VARIANTS = ["Up", "Down"] as const;
export type CheckStatus = (typeof CHECK_STATUS_VARIANTS)[number];

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
  status: SLAStatus;
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
