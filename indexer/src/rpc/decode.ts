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
 * getEvents is filtered to contractId only, topics: [["*"]] wildcard — not
 * by topic value — specifically because of this uncertainty, following the
 * same defensive choice a real production Soroban indexer made when facing
 * the same problem (see the escrow-backend PR referenced in this repo's
 * README). Classification happens client-side, after decoding, by matching
 * topic[0] and the decoded field shape together, not by topic[0] alone.
 */
export const EVENT_TYPE_TOPIC = {
  watcherRegistered: "WatcherRegistered",
  watcherRemoved: "WatcherRemoved",
  checkSubmitted: "CheckSubmitted",
  slaCreated: "SlaCreated",
  bondToppedUp: "BondToppedUp",
  settlementPaid: "SettlementPaid",
  slaCancelled: "SlaCancelled",
  bondWithdrawn: "BondWithdrawn",
} as const;

export interface DecodedEvent {
  eventId: string;
  ledger: number;
  ledgerCloseTime: string;
  txHash: string;
  contractId: string;
  topicSymbol: string | undefined;
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
    data,
  };
}

/**
 * getEvents topic filtering: each segment must be the literal string "*"
 * (wildcard) or a base64-encoded XDR ScVal — confirmed against the real
 * installed SDK types, EventFilter.topics is string[][], not ScVal[][].
 * This indexer never filters by topic value server-side (see the warning
 * at the top of this file for why), so the wildcard is all it ever sends.
 */
export function wildcardTopicFilter(): string[][] {
  return [["*"]];
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
