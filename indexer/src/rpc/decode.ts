import { rpc, scValToNative } from "@stellar/stellar-sdk";

/**
 * Event wire format, as observed on real Testnet transactions (see
 * slasettle-vault/evidence/testnet-2026-09-27.md and, for the current
 * deployment's re-check on 2026-09-29,
 * evidence/parity-matrix-2026-09-29.md section 4). Every event's topic[0] is
 * the event's name as a snake_case symbol — the #[contractevent] macro
 * lower-snakes the Rust struct name — followed by the fields the contract
 * marked #[topic]. The remaining fields are `value`, decoded as a map keyed
 * by field name; an event with no such fields decodes to `{}`.
 *
 *   watcher_registered / watcher_removed
 *     topics = [symbol, watcher: address]        data = {}
 *   check_submitted
 *     topics = [symbol, sla_id: u64, watcher: address]
 *     data   = { round_id: u64, status: Vec<Symbol> }  e.g. status = ["Up"]
 *   sla_created
 *     topics = [symbol, sla_id: u64, provider: address]
 *     data   = { token: address, bond_amount: i128, beneficiary: address }
 *   bond_topped_up
 *     topics = [symbol, sla_id: u64]             data = { amount: i128 }
 *   settlement_paid
 *     topics = [symbol, sla_id: u64, round_id: u64]
 *     data   = { payout: i128, beneficiary: address }
 *   sla_cancelled
 *     topics = [symbol, sla_id: u64]             data = {}
 *   bond_withdrawn
 *     topics = [symbol, sla_id: u64]             data = { amount: i128 }
 *
 * Reading sla_id/round_id/provider/watcher from `data` instead of `topics`
 * silently produced the string "undefined" for every row when this file
 * was first written; that mistake is why each shape above is pinned to an
 * observed event rather than inferred from the #[topic] annotations alone.
 *
 * getEvents is filtered to contractId only, with no topics filter at all.
 * Soroban RPC's topic filter matches on segment count, so a single-segment
 * wildcard (`topics: [["*"]]`) only matches 1-segment topics and silently
 * dropped every real event here, which all carry 2 or 3 segments.
 * Classification happens client-side, after decoding, by matching topic[0]
 * (see classify.ts).
 */
export const EVENT_TYPE_TOPIC = {
  watcherRegistered: "watcher_registered",
  watcherRemoved: "watcher_removed",
  checkSubmitted: "check_submitted",
  slaCreated: "sla_created",
  bondToppedUp: "bond_topped_up",
  settlementPaid: "settlement_paid",
  slaCancelled: "sla_cancelled",
  bondWithdrawn: "bond_withdrawn",
} as const;

export interface DecodedEvent {
  eventId: string;
  ledger: number;
  ledgerCloseTime: string;
  txHash: string;
  contractId: string;
  topicSymbol: string | undefined;
  /** Every decoded topic segment, topic[0] (the symbol) included. */
  topics: unknown[];
  data: Record<string, unknown> | unknown;
}

/**
 * Decodes one raw getEvents result entry into something usable. i128/u128
 * values pass through scValToNative as strings, per the SDK's own behavior
 * — never coerced to Number here, on purpose, since a bond amount can
 * exceed Number.MAX_SAFE_INTEGER.
 *
 * Note there is no per-event paging token in this SDK version's
 * EventResponse type — pagination is a single cursor on the response as a
 * whole (see client.ts), not per event. `eventId` (from the event's own
 * `id` field) is used purely as this indexer's own idempotency key for
 * INSERT OR IGNORE, not for RPC pagination.
 */
export function decodeEvent(raw: rpc.Api.EventResponse): DecodedEvent {
  const topics = raw.topic.map((t) => scValToNative(t));
  const topicSymbol = typeof topics[0] === "string" ? topics[0] : undefined;
  const data = scValToNative(raw.value);

  return {
    eventId: raw.id,
    ledger: raw.ledger,
    ledgerCloseTime: raw.ledgerClosedAt,
    txHash: raw.txHash,
    contractId: raw.contractId?.toString() ?? "",
    topicSymbol,
    topics,
    data,
  };
}

/**
 * Ensures an amount decoded from an event is a plain decimal string, never
 * a JS number, regardless of what shape scValToNative happened to return it
 * in (it can return bigint for i128/u128 depending on SDK version — this
 * normalizes either case to a string, which is the wire format the
 * indexer API spec promises).
 */
export function amountToString(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    throw new Error(
      `amountToString received a JS number (${value}) — this means precision may already be lost upstream. This should never happen; investigate the decode path before trusting this value.`,
    );
  }
  throw new Error(`amountToString received an unexpected type: ${typeof value}`);
}
