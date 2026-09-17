/**
 * Cursors are opaque base64-encoded JSON to callers, per the indexer API
 * spec. Internally just a plain object — currently only settlements
 * pagination uses this, keyed on ledger_close_time + event_id so ties
 * at the same timestamp still resolve deterministically.
 */
export interface SettlementsCursor {
  ledgerCloseTime: string;
  eventId: string;
}

export function encodeCursor(cursor: SettlementsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

export function decodeCursor(value: string): SettlementsCursor | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
    if (typeof parsed?.ledgerCloseTime === "string" && typeof parsed?.eventId === "string") {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
