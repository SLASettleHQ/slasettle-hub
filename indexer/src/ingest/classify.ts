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
      // watcher_registered/watcher_removed carry no `value` payload at all
      // (confirmed against a real on-chain event: `data` decodes to `{}`)
      // — the watcher's address is topic[1], the field the contract marked
      // #[topic], not a `watcher` key in `data`.
      case EVENT_TYPE_TOPIC.watcherRegistered:
        batch.watcherRegistrations.push({
          address: String(event.topics[1]),
          registeredAt: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.watcherRemoved:
        batch.watcherRemovals.push({
          address: String(event.topics[1]),
          removedAt: event.ledgerCloseTime,
        });
        break;

      // check_submitted's real shape, confirmed against a live testnet
      // event: topics = [symbol, sla_id: u64, watcher: address], and
      // data = { round_id: u64, status: Vec<Symbol> } — `status` is a
      // one-element vec wrapping the CheckStatus enum's symbol (e.g.
      // `["Up"]`), not a bare string, confirming the vec-wrapped-symbol
      // encoding this file's mustCheckStatusEnum write-side counterpart
      // (in the watcher daemon) already assumed.
      case EVENT_TYPE_TOPIC.checkSubmitted: {
        const statusVec = data.status;
        const statusSymbol = Array.isArray(statusVec) ? statusVec[0] : statusVec;
        batch.checks.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          round_id: String(data.round_id),
          watcher: String(event.topics[2]),
          status: String(statusSymbol).toLowerCase() === "down" ? "down" : "up",
          checked_at: event.ledgerCloseTime,
        });
        break;
      }

      // slaCreated's real shape, confirmed against a live testnet event:
      // topics = [symbol, sla_id: u64, provider: address] — both are
      // #[topic] fields on the Rust event struct — and
      // data = { token: address, bond_amount: i128, beneficiary: address }.
      // sla_id/provider are NOT in data; reading them from there silently
      // produced the string "undefined" for every row.
      case EVENT_TYPE_TOPIC.slaCreated:
        batch.slas.push({
          sla_id: String(event.topics[1]),
          provider: String(event.topics[2]),
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

      // settlementPaid's real shape, confirmed against a live testnet
      // event: topics = [symbol, sla_id: u64, round_id: u64] — both
      // #[topic] fields — and data = { payout: i128, beneficiary: address}.
      // sla_id/round_id are NOT in data, same mistake as slaCreated above.
      case EVENT_TYPE_TOPIC.settlementPaid:
        batch.settlements.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          round_id: String(event.topics[2]),
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
