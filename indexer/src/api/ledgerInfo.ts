import type { rpc } from "@stellar/stellar-sdk";

export interface LedgerInfo {
  sequence: number;
  closeTimeMs: number;
}

const UNIX_SECONDS = /^(0|[1-9]\d*)$/;
const MAX_DATE_TIME_MS = 8_640_000_000_000_000;

function invalidLedgerField(field: string, value: unknown): TypeError {
  return new TypeError(`getLatestLedger returned an invalid ${field}: ${String(value)}`);
}

/**
 * The SDK's raw getter uses the same JSON-RPC request path as getLatestLedger,
 * but leaves headerXdr and metadataXdr encoded. This indexer only needs the
 * sequence and closeTime fields, so avoid decoding those large XDR payloads.
 */
export async function getLatestLedgerInfo(server: rpc.Server): Promise<LedgerInfo> {
  const raw = await server._getLatestLedger();
  const sequence = raw?.sequence;

  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence <= 0) {
    throw invalidLedgerField("sequence", sequence);
  }

  const closeTime = raw?.closeTime;
  if (typeof closeTime !== "string" || !UNIX_SECONDS.test(closeTime)) {
    throw invalidLedgerField("closeTime", closeTime);
  }

  const closeTimeSeconds = Number(closeTime);
  if (!Number.isSafeInteger(closeTimeSeconds)) {
    throw invalidLedgerField("closeTime", closeTime);
  }

  const closeTimeMs = closeTimeSeconds * 1000;
  if (!Number.isSafeInteger(closeTimeMs) || closeTimeMs > MAX_DATE_TIME_MS) {
    throw invalidLedgerField("closeTime", closeTime);
  }

  return { sequence, closeTimeMs };
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
