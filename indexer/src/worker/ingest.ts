import { SorobanEventClient, type EventsCursor } from "../rpc/client.js";
import { decodeEvent } from "../rpc/decode.js";
import { classifyEvents } from "../ingest/classify.js";
import { IndexerD1 } from "../db/d1.js";
import type { WorkerEnv } from "./types.js";

const DEFAULT_START_LEDGER = 4963530;
const DEFAULT_LIMIT = 50;

export interface IngestionResult {
  eventsIndexed: number;
  lastLedger: number;
  cursor: string | null;
}

export async function runIngestionStep(env: WorkerEnv): Promise<IngestionResult> {
  const d1 = new IndexerD1(env.DB);
  const client = new SorobanEventClient(env.RPC_URL);

  const contractIds = [
    env.WATCHER_REGISTRY_CONTRACT_ID,
    env.SLA_VAULT_CONTRACT_ID,
  ].filter((id): id is string => typeof id === "string" && id.length > 0);

  if (contractIds.length === 0) {
    throw new Error("No contract IDs configured for ingestion");
  }

  const cp = await d1.getCheckpoint();
  let cursor: EventsCursor;

  if (cp?.last_cursor) {
    cursor = { kind: "cursor", cursor: cp.last_cursor };
  } else if (cp?.last_ledger) {
    cursor = { kind: "ledger", startLedger: cp.last_ledger + 1 };
  } else {
    const startLedger = env.START_LEDGER ? Number(env.START_LEDGER) : DEFAULT_START_LEDGER;
    cursor = { kind: "ledger", startLedger };
  }

  const response = await client.getEvents({
    contractIds,
    cursor,
    limit: DEFAULT_LIMIT,
  });

  const rawEvents = response.events ?? [];
  const decodedEvents = rawEvents.map((raw) => decodeEvent(raw));

  const nullLogger = {
    info: () => {},
    warn: (obj: unknown, msg?: string) => console.warn(msg, obj),
    error: (obj: unknown, msg?: string) => console.error(msg, obj),
    debug: () => {},
    fatal: (obj: unknown, msg?: string) => console.error(msg, obj),
    trace: () => {},
  };

  const batch = classifyEvents(decodedEvents, nullLogger as any);

  const lastLedger = response.latestLedger ?? (cp?.last_ledger ?? DEFAULT_START_LEDGER);
  const lastCursor = response.cursor ?? cp?.last_cursor ?? null;

  await d1.applyBatch({
    lastLedger,
    lastCursor,
    watcherEvents: batch.watcherEvents,
    checks: batch.checks,
    slas: batch.slas,
    settlements: batch.settlements,
  });

  return {
    eventsIndexed: decodedEvents.length,
    lastLedger,
    cursor: lastCursor,
  };
}
