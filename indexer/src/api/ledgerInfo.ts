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
