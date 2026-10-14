import type { DecodedEvent } from "../rpc/decode.js";
import { EVENT_TYPE_TOPIC, amountToString, bytesToHex } from "../rpc/decode.js";
import type {
  CheckRow,
  LifecycleEventRow,
  SettlementRow,
  SlaRow,
  WatcherEvent,
} from "../db/db.js";
import type { Logger } from "pino";

export interface ClassifiedBatch {
  // A single array, not separate registration/removal arrays, so a
  // register -> remove -> re-register sequence within one batch keeps
  // its real chronological order all the way to the database. See
  // WatcherEvent's doc comment in db.ts for why this matters.
  watcherEvents: WatcherEvent[];
  checks: CheckRow[];
  slas: SlaRow[];
  settlements: SettlementRow[];
  lifecycleEvents: LifecycleEventRow[];
}

function emptyBatch(): ClassifiedBatch {
  return { watcherEvents: [], checks: [], slas: [], settlements: [], lifecycleEvents: [] };
}

/**
 * Strictly parses a CheckStatus value decoded from an event's `data.status`
 * (a one-element vec wrapping the enum's symbol, e.g. `["Up"]`). Returns
 * `null` for anything that isn't exactly "Up" or "Down" — an unrecognized
 * string, an unexpected shape, or a missing/undefined value — so the
 * caller can quarantine it. This deliberately replaces a looser
 * `value === "down" ? "down" : "up"` pattern: that shape makes every
 * unrecognized value silently "up", which would hide a real decode bug or
 * a contract/indexer mismatch behind a false-healthy status.
 */
export function parseCheckStatus(raw: unknown): "up" | "down" | null {
  // The real on-chain encoding is always a one-element vec wrapping the
  // symbol (e.g. ["Up"]) — a bare string doesn't match that shape and is
  // rejected too, not leniently accepted just because its value happens to
  // equal a valid variant name.
  if (!Array.isArray(raw) || raw.length !== 1) return null;
  const symbol = raw[0];
  if (symbol === "Up") return "up";
  if (symbol === "Down") return "down";
  return null;
}

/**
 * Turns a page of decoded events into rows the db layer can write. Each
 * event is matched on its topic symbol against EVENT_TYPE_TOPIC — see the
 * observed wire format documented at the top of decode.ts.
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
        batch.watcherEvents.push({
          type: "registered",
          address: String(event.topics[1]),
          at: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.watcherRemoved:
        batch.watcherEvents.push({
          type: "removed",
          address: String(event.topics[1]),
          at: event.ledgerCloseTime,
        });
        break;

      // check_submitted's v0.2 shape (see decode.ts): topics = [symbol,
      // sla_id: u64, watcher: address], and
      // data = { round_id: u64, endpoint_hash: BytesN<32>, status: Vec<Symbol> }
      // — status is a one-element vec wrapping the CheckStatus enum's
      // symbol (e.g. `["Up"]`), not a bare string, confirming the
      // vec-wrapped-symbol encoding this file's mustCheckStatusEnum
      // write-side counterpart (in the watcher daemon) already assumed.
      //
      // An unrecognized/malformed status is quarantined (logged, not
      // persisted) rather than defaulted to "up" — see parseCheckStatus.
      case EVENT_TYPE_TOPIC.checkSubmitted: {
        const status = parseCheckStatus(data.status);
        if (status === null) {
          logger.warn(
            { eventId: event.eventId, rawStatus: data.status },
            "check_submitted event has an unrecognized or malformed status — quarantined, not persisted as up or down",
          );
          break;
        }
        batch.checks.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          round_id: String(data.round_id),
          watcher: String(event.topics[2]),
          status,
          endpoint_hash: bytesToHex(data.endpoint_hash),
          checked_at: event.ledgerCloseTime,
        });
        break;
      }

      // sla_created's v0.2 shape (see decode.ts): topics = [symbol,
      // sla_id: u64, provider: address] — both #[topic] fields — and
      // data = { token, endpoint_hash, bond_amount, uptime_target_bps,
      // quorum_threshold, penalty_per_breach, beneficiary }. sla_id/provider
      // are NOT in data; reading them from there silently produced the
      // string "undefined" for every row under v0.1.
      //
      // quorum_threshold now comes straight from the event — v0.1 didn't
      // carry it, requiring a lazy live get_sla read per row (see
      // rpc/liveReads.ts and the N+1 fix in api/routes.ts); v0.2 rows never
      // need that fallback.
      case EVENT_TYPE_TOPIC.slaCreated:
        batch.slas.push({
          sla_id: String(event.topics[1]),
          provider: String(event.topics[2]),
          token: String(data.token),
          endpoint_hash: bytesToHex(data.endpoint_hash),
          bond_amount_at_creation: amountToString(data.bond_amount),
          quorum_threshold: Number(data.quorum_threshold),
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

      // Lifecycle events: previously recognized and decoded correctly but
      // intentionally not persisted (topics = [symbol, sla_id: u64];
      // data = { amount: i128 } for bond_topped_up/bond_withdrawn, {} for
      // sla_cancelled). Now persisted to sla_lifecycle_events for
      // provider/SLA audit history.
      case EVENT_TYPE_TOPIC.bondToppedUp:
        batch.lifecycleEvents.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          event_type: "bond_topped_up",
          amount: amountToString(data.amount),
          tx_hash: event.txHash,
          ledger_close_time: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.slaCancelled:
        batch.lifecycleEvents.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          event_type: "sla_cancelled",
          amount: null,
          tx_hash: event.txHash,
          ledger_close_time: event.ledgerCloseTime,
        });
        break;

      case EVENT_TYPE_TOPIC.bondWithdrawn:
        batch.lifecycleEvents.push({
          event_id: event.eventId,
          sla_id: String(event.topics[1]),
          event_type: "bond_withdrawn",
          amount: amountToString(data.amount),
          tx_hash: event.txHash,
          ledger_close_time: event.ledgerCloseTime,
        });
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
