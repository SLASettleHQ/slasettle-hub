import type { Logger } from "pino";
import type { EventClient, EventsCursor } from "../rpc/client.js";
import { decodeEvent } from "../rpc/decode.js";
import { classifyEvents } from "./classify.js";
import type { IndexerDb } from "../db/db.js";
import type { Config } from "../config.js";

export interface PollerDeps {
  client: EventClient;
  db: IndexerDb;
  logger: Logger;
  config: Config;
}

const RETENTION_LEDGERS_APPROX = 120_960; // ~7 days at ~5s/ledger — see README

/**
 * Runs one ingestion cycle: figure out where to resume from, fetch one page
 * of events, decode and classify them, write everything (events +
 * checkpoint) in a single transaction. Returns true if there may be more
 * events waiting (a full page came back), false if this cycle caught up to
 * the tip — the caller uses this to decide whether to loop again
 * immediately or wait out the poll interval.
 */
export async function runOnce(deps: PollerDeps): Promise<boolean> {
  const { client, db, logger, config } = deps;
  const contractIds = [config.WATCHER_REGISTRY_CONTRACT_ID, config.SLA_VAULT_CONTRACT_ID];

  const checkpoint = db.getCheckpoint();
  let cursor: EventsCursor;

  if (checkpoint?.last_cursor) {
    cursor = { kind: "cursor", cursor: checkpoint.last_cursor };
  } else {
    const latest = await client.getLatestLedger();
    const start = config.START_LEDGER ?? latest;

    if (latest - start > RETENTION_LEDGERS_APPROX) {
      logger.warn(
        { start, latest },
        `requested START_LEDGER is further behind than the RPC node's retention window (~${RETENTION_LEDGERS_APPROX} ledgers). Events in that gap cannot be recovered from RPC alone — this is a real historical gap, not a bug, and it is being logged rather than silently ignored.`,
      );
    }

    cursor = { kind: "ledger", startLedger: start };
  }

  const page = await client.getEvents({
    contractIds,
    cursor,
    limit: config.MAX_LEDGERS_PER_REQUEST,
  });

  // page.cursor is the RPC's own response-level pagination cursor — this is
  // what gets persisted and replayed on the next cycle, regardless of
  // whether any events came back. An individual event's own id (used for
  // this indexer's dedup key in the db layer) is a separate concept and is
  // never used for resuming ingestion.
  if (page.events.length === 0) {
    db.applyBatch({
      lastLedger: page.latestLedger,
      lastCursor: page.cursor,
      watcherRegistrations: [],
      watcherRemovals: [],
      checks: [],
      slas: [],
      settlements: [],
    });
    return false;
  }

  const decoded = page.events.map(decodeEvent);
  const batch = classifyEvents(decoded, logger);
  const lastEvent = decoded[decoded.length - 1];

  db.applyBatch({
    lastLedger: lastEvent?.ledger ?? page.latestLedger,
    lastCursor: page.cursor,
    ...batch,
  });

  logger.info(
    {
      eventsProcessed: decoded.length,
      slasCreated: batch.slas.length,
      checksSubmitted: batch.checks.length,
      settlementsPaid: batch.settlements.length,
    },
    "ingestion cycle complete",
  );

  // If we got a full page, there's likely more waiting right now — worth
  // another cycle immediately instead of idling for POLL_INTERVAL_MS.
  return decoded.length >= config.MAX_LEDGERS_PER_REQUEST;
}

/**
 * The long-running loop. Exits cleanly when `signal` is aborted — see
 * index.ts for how SIGINT/SIGTERM wire into that.
 */
export async function runForever(deps: PollerDeps, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const mayHaveMore = await runOnce(deps);
      if (mayHaveMore) continue;
    } catch (err) {
      deps.logger.error({ err }, "ingestion cycle failed, will retry after the poll interval");
    }

    await sleep(deps.config.POLL_INTERVAL_MS, signal);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
