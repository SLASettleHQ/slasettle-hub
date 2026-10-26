import type { rpc } from "@stellar/stellar-sdk";

export interface LedgerInfo {
  sequence: number;
  closeTimeMs: number;
}

/**
 * getLatestLedger's response field is `closeTime` — confirmed against the
 * real installed SDK types (GetLatestLedgerResponse.closeTime: string).
 * The earlier version of this function guessed `ledgerCloseTime` and
 * flagged that guess as needing verification; this is that verification.
 */
export async function getLatestLedgerInfo(server: rpc.Server): Promise<LedgerInfo> {
  const raw = await server.getLatestLedger();
  const closeTimeSeconds = Number(raw.closeTime);

  if (!Number.isFinite(closeTimeSeconds)) {
    throw new Error(
      `getLatestLedger returned a non-numeric closeTime: ${String(raw.closeTime)}`,
    );
  }

  return { sequence: raw.sequence, closeTimeMs: closeTimeSeconds * 1000 };
}

/**
 * Computes the round_id for a ledger close time, by the same formula
 * watcher_registry's own `get_current_round` uses on-chain: `ledger
 * timestamp (seconds) / ROUND_LENGTH_SECONDS` (floor division) — see
 * slasettle-vault contracts/watcher_registry/src/lib.rs's `current_round`.
 * Deliberately NOT a live RPC call to the contract's own
 * `get_current_round` — the formula is deterministic and this indexer
 * already has the latest ledger's close time from `getLatestLedgerInfo`,
 * so recomputing it locally avoids an extra RPC round trip per API request
 * for a value that's guaranteed to match.
 */
export function currentRoundId(ledger: LedgerInfo, roundLengthSeconds: number): number {
  return Math.floor(ledger.closeTimeMs / 1000 / roundLengthSeconds);
}
