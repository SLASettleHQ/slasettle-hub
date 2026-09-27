import { rpc, scValToNative } from "@stellar/stellar-sdk";

/**
 * IMPORTANT, READ BEFORE TRUSTING THIS FILE:
 *
 * The event topic layout below (which string identifies each event type) is
 * inferred from the #[contractevent] macro's documented convention, not
 * observed from a real compiled contract. The sandbox this indexer was
 * written in could not compile slasettle-vault (see its own README), so no
 * real event was ever actually emitted and inspected here.
 *
 * Before running this indexer against testnet: deploy the contracts,
 * trigger one of each event type, log the raw decoded topics with
 * DEBUG_LOG_RAW_EVENTS=1, and confirm the topic[0] symbol actually matches
 * one of the strings in EVENT_TYPE_TOPIC below. If it doesn't, fix the map
 * — do not fix it by guessing again, fix it by looking at a real event.
 *
 * getEvents is filtered to contractId only, no topics filter at all — not
 * by topic value — specifically because of this uncertainty, following the
 * same defensive choice a real production Soroban indexer made when facing
 * the same problem (see the escrow-backend PR referenced in this repo's
 * README). Classification happens client-side, after decoding, by matching
 * topic[0] and the decoded field shape together, not by topic[0] alone.
 *
 * (Earlier this indexer sent a single-segment wildcard, `topics: [["*"]]`,
 * intending it to match anything — it doesn't. Soroban RPC's topic filter
 * matches on segment count, so `[["*"]]` only matches 1-segment topics and
 * silently drops every real event here, which all carry 2 segments
 * (`[symbol, address]`). Confirmed against a real on-chain
 * `watcher_registered` transaction: `getEvents` returned it with no
 * `topics` key and returned nothing with `[["*"]]`, for the identical
 * contract IDs and ledger range.)
 *
 * The naming convention below is now confirmed for watcherRegistered: the
 * real event's topic[0] symbol is `watcher_registered` (snake_case), not
 * `WatcherRegistered` — the #[contractevent] macro lower-snakes the Rust
 * variant name. The other seven are updated to match that same, now-known
 * derivation, but only two event kinds' *data shape* is confirmed so far
 * (see classify.ts for both):
 *   - watcherRegistered/watcherRemoved: `value` is empty; the watcher
 *     address is topic[1], not a `watcher` field in `data`.
 *   - checkSubmitted: topics = [symbol, sla_id: u64, watcher: address];
 *     `data` = { round_id: u64, status: Vec<Symbol> } — `status` is a
 *     one-element vec wrapping the CheckStatus enum's symbol (e.g.
 *     `["Up"]`), not a bare string.
 *   - slaCreated: topics = [symbol, sla_id: u64, provider: address]
 *     (both #[topic] fields on the Rust struct); `data` = { token: address,
 *     bond_amount: i128, beneficiary: address }. sla_id/provider are NOT in
 *     `data` — confirmed against the real sla_created event from tx
 *     258c86d2a0de481d60240dd29cea6de490840bd29f78e550fb97fb4fb8028b7c.
 *   - settlementPaid: topics = [symbol, sla_id: u64, round_id: u64] (both
 *     #[topic]); `data` = { payout: i128, beneficiary: address }.
 *     sla_id/round_id are NOT in `data` — confirmed against the real
 *     settlement_paid event from tx
 *     b1dc301a22f8381ee9705a72e214d212e1f1c81c9b0ac53729506708b286d85e.
 * bondToppedUp/slaCancelled/bondWithdrawn still have their field layout
 * guessed — no real event of those kinds has been observed yet, so don't
 * trust `data.*` for those without checking a real one first. (They're each
 * a single #[topic] sla_id plus one data field per contracts/sla_vault/src/
 * events.rs, so the same topic/data split almost certainly applies, but
 * "almost certainly" is exactly the confidence level that was wrong twice
 * already — verify before trusting.)
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
