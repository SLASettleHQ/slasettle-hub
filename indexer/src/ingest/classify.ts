import type { DecodedEvent } from "../rpc/decode.js";
import { EVENT_TYPE_TOPIC, amountToString } from "../rpc/decode.js";
import type { CheckRow, SettlementRow, SlaRow } from "../db/db.js";
import type { Logger } from "pino";

export interface ClassifiedBatch {
  watcherRegistrations: Array<{ address: string; registeredAt: string }>;
  watcherRemovals: Array<{ address: string; removedAt: string }>;
  checks: CheckRow[];
  slas: SlaRow[];
  settlements: SettlementRow[];
}

function emptyBatch(): ClassifiedBatch {
  return { watcherRegistrations: [], watcherRemovals: [], checks: [], slas: [], settlements: [] };
}

/**
 * Turns a page of decoded events into rows the db layer can write. Each
 * event is matched on its topic symbol against EVENT_TYPE_TOPIC — see the
 * warning at the top of decode.ts about that mapping's unverified status.
 * An event whose topic doesn't match anything recognized is logged and
 * skipped, not silently dropped — a growing count of unrecognized events in
 * the logs is exactly the signal that EVENT_TYPE_TOPIC needs correcting
 * against real observed data.
 */
export function classifyEvents(events: DecodedEvent[], logger: Logger): ClassifiedBatch {
  const batch = emptyBatch();

  for (const event of events) {
    const data = event.data as Record<string, unknown>;

    switch (event.topicSymbol) {
      case EVENT_TYPE_TOPIC.watcherRegistered:
        batch.watcherRegistrations.push({
          address: String(data.watcher),
          registeredAt: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.watcherRemoved:
        batch.watcherRemovals.push({
          address: String(data.watcher),
          removedAt: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.checkSubmitted:
        batch.checks.push({
          event_id: event.eventId,
          sla_id: String(data.sla_id),
          round_id: String(data.round_id),
          watcher: String(data.watcher),
          status: String(data.status).toLowerCase() === "down" ? "down" : "up",
          checked_at: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.slaCreated:
        batch.slas.push({
          sla_id: String(data.sla_id),
          provider: String(data.provider),
          token: String(data.token),
          bond_amount_at_creation: amountToString(data.bond_amount),
          // Not in the event payload — see the schema.sql comment on this
          // column. Filled lazily by a live get_sla read, cached once.
          quorum_threshold: null,
          beneficiary: String(data.beneficiary),
          created_at: event.ledgerCloseTime,
          tx_hash: event.txHash,
        });
        break;

      case EVENT_TYPE_TOPIC.settlementPaid:
        batch.settlements.push({
          event_id: event.eventId,
          sla_id: String(data.sla_id),
          round_id: String(data.round_id),
          quorum_threshold: null,
          penalty_amount: amountToString(data.payout),
          beneficiary: String(data.beneficiary),
          tx_hash: event.txHash,
          ledger_close_time: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.bondToppedUp:
      case EVENT_TYPE_TOPIC.slaCancelled:
      case EVENT_TYPE_TOPIC.bondWithdrawn:
        // Not needed by any endpoint in the current API spec — these are
        // observed and decoded correctly, just not persisted. Add a table
        // for them if a future endpoint needs their history.
        break;

      default:
        logger.warn(
          { eventId: event.eventId, topicSymbol: event.topicSymbol, contractId: event.contractId },
          "unrecognized event topic — see decode.ts's warning comment, this likely means EVENT_TYPE_TOPIC needs correcting against a real observed event",
        );
    }
  }

  return batch;
}
