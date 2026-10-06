/**
 * Typed client for the SLASettle indexer HTTP API, as documented in
 * apps/docs/api.md. The indexer is a read-side cache of
 * history (what happened) — anything that must be current-as-of-right-now
 * (bond balance, SLA status, live tallies) is a direct Soroban read via
 * @slasettle/sdk instead, never this client.
 *
 * Only the fields the spec actually documents are modeled here. Every
 * response is validated at runtime: a mismatch between the real API and this
 * file surfaces as an {@link IndexerResponseError}, never as a silently
 * mis-typed value.
 */

import { StrKey } from "@stellar/stellar-sdk";

export class MissingIndexerConfigError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_INDEXER_API_URL is not set. The indexer base URL is " +
        "supplied per deployment once the indexer is reachable.",
    );
    this.name = "MissingIndexerConfigError";
  }
}

/** The indexer could not be reached at all (network failure, DNS, timeout, CORS). */
export class IndexerUnavailableError extends Error {
  constructor(
    public readonly endpoint: string,
    reason: string,
  ) {
    super(`The indexer could not be reached for ${endpoint}: ${reason}`);
    this.name = "IndexerUnavailableError";
  }
}

/** The indexer answered with a non-2xx status. */
export class IndexerApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    statusText: string,
  ) {
    super(`Indexer request to ${endpoint} failed: ${status} ${statusText}`.trim());
    this.name = "IndexerApiError";
  }
}

/** The indexer answered 2xx, but the body did not match the documented schema. */
export class IndexerResponseError extends Error {
  constructor(
    public readonly endpoint: string,
    detail: string,
  ) {
    super(`The indexer returned an unexpected response for ${endpoint}: ${detail}`);
    this.name = "IndexerResponseError";
  }
}

const DEFAULT_INDEXER_API_URL = "https://slasettle-indexer.slasettle-indexer.workers.dev";
const REQUEST_TIMEOUT_MS = 10_000;

function getIndexerBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL || DEFAULT_INDEXER_API_URL;
  if (!baseUrl) {
    throw new MissingIndexerConfigError();
  }
  return baseUrl.replace(/\/+$/, "");
}

async function indexerGet(path: string): Promise<unknown> {
  const baseUrl = getIndexerBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    const reason =
      err instanceof DOMException && err.name === "TimeoutError"
        ? `no response within ${REQUEST_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : "network error";
    throw new IndexerUnavailableError(path, reason);
  }
  if (!response.ok) {
    throw new IndexerApiError(path, response.status, response.statusText);
  }
  try {
    return await response.json();
  } catch {
    throw new IndexerResponseError(path, "the body is not valid JSON.");
  }
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

type Fields = Record<string, unknown>;

function asObject(value: unknown, endpoint: string, what: string): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new IndexerResponseError(endpoint, `${what} is not an object.`);
  }
  return value as Fields;
}

function str(fields: Fields, key: string, endpoint: string): string {
  const value = fields[key];
  if (typeof value !== "string" || value === "") {
    throw new IndexerResponseError(endpoint, `"${key}" is not a non-empty string.`);
  }
  return value;
}

function nonNegativeInt(fields: Fields, key: string, endpoint: string): number {
  const value = fields[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new IndexerResponseError(endpoint, `"${key}" is not a non-negative integer.`);
  }
  return value;
}

function nullableNonNegativeInt(fields: Fields, key: string, endpoint: string): number | null {
  return fields[key] === null ? null : nonNegativeInt(fields, key, endpoint);
}

/** An i128 amount, which the API serializes as a decimal string. */
function amount(fields: Fields, key: string, endpoint: string): bigint {
  const value = fields[key];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new IndexerResponseError(endpoint, `"${key}" is not a decimal string.`);
  }
  return BigInt(value);
}

function timestamp(fields: Fields, key: string, endpoint: string): string {
  const value = str(fields, key, endpoint);
  if (Number.isNaN(Date.parse(value))) {
    throw new IndexerResponseError(endpoint, `"${key}" is not a timestamp.`);
  }
  return value;
}

function stellarAddress(fields: Fields, key: string, endpoint: string): string {
  const value = str(fields, key, endpoint);
  if (!StrKey.isValidEd25519PublicKey(value) && !StrKey.isValidContract(value)) {
    throw new IndexerResponseError(endpoint, `"${key}" is not a Stellar address.`);
  }
  return value;
}

function txHash(fields: Fields, key: string, endpoint: string): string {
  const value = str(fields, key, endpoint);
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new IndexerResponseError(endpoint, `"${key}" is not a 64-character transaction hash.`);
  }
  return value.toLowerCase();
}

function httpsUrl(fields: Fields, key: string, endpoint: string): string {
  const value = str(fields, key, endpoint);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new IndexerResponseError(endpoint, `"${key}" is not a URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new IndexerResponseError(endpoint, `"${key}" is not an https URL.`);
  }
  return parsed.toString();
}

function envelope<T>(
  body: unknown,
  endpoint: string,
  parseItem: (item: Fields) => T,
): PagedResult<T> {
  const page = asObject(body, endpoint, "the response");
  if (!Array.isArray(page.data)) {
    throw new IndexerResponseError(endpoint, '"data" is not an array.');
  }
  const nextCursor = page.next_cursor;
  if (nextCursor !== null && typeof nextCursor !== "string") {
    throw new IndexerResponseError(endpoint, '"next_cursor" is neither null nor a string.');
  }
  return {
    data: page.data.map((item, index) => parseItem(asObject(item, endpoint, `data[${index}]`))),
    nextCursor,
  };
}

function checkSlaId(slaId: bigint): string {
  if (typeof slaId !== "bigint" || slaId < 0n) {
    throw new RangeError("slaId must be a non-negative bigint.");
  }
  return slaId.toString();
}

export interface PagedResult<T> {
  data: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Endpoint 0 — GET /v1/health
// ---------------------------------------------------------------------------

export interface IndexerHealth {
  status: "ok";
  /** `null` until the indexer completes its first ingestion pass. */
  lastIndexedLedger: number | null;
}

export async function getHealth(): Promise<IndexerHealth> {
  const endpoint = "/v1/health";
  const fields = asObject(await indexerGet(endpoint), endpoint, "the response");
  if (fields.status !== "ok") {
    throw new IndexerResponseError(endpoint, '"status" is not "ok".');
  }
  return {
    status: "ok",
    lastIndexedLedger: nullableNonNegativeInt(fields, "last_indexed_ledger", endpoint),
  };
}

// ---------------------------------------------------------------------------
// Endpoint 1 — GET /v1/watchers
// ---------------------------------------------------------------------------

export interface EligibleWatcher {
  address: string;
  registeredAt: string;
}

export async function getWatchers(): Promise<PagedResult<EligibleWatcher>> {
  const endpoint = "/v1/watchers";
  return envelope(await indexerGet(endpoint), endpoint, (w) => ({
    address: stellarAddress(w, "address", endpoint),
    registeredAt: timestamp(w, "registered_at", endpoint),
  }));
}

// ---------------------------------------------------------------------------
// Endpoint 2 — GET /v1/slas/{sla_id}/current-round
// Not wrapped in the { data, next_cursor } envelope.
// ---------------------------------------------------------------------------

export interface CheckedInWatcher {
  watcher: string;
  status: "up" | "down";
  checkedAt: string;
}

export interface CurrentRound {
  roundId: bigint;
  roundStartedAt: string;
  checkedIn: CheckedInWatcher[];
  notYetCheckedIn: string[];
}

export async function getCurrentRound(slaId: bigint): Promise<CurrentRound> {
  const endpoint = `/v1/slas/${checkSlaId(slaId)}/current-round`;
  const fields = asObject(await indexerGet(endpoint), endpoint, "the response");

  if (!Array.isArray(fields.checked_in) || !Array.isArray(fields.not_yet_checked_in)) {
    throw new IndexerResponseError(
      endpoint,
      '"checked_in" and "not_yet_checked_in" must both be arrays.',
    );
  }

  return {
    roundId: BigInt(nonNegativeInt(fields, "round_id", endpoint)),
    roundStartedAt: timestamp(fields, "round_started_at", endpoint),
    checkedIn: fields.checked_in.map((item, index) => {
      const w = asObject(item, endpoint, `checked_in[${index}]`);
      const status = w.status;
      if (status !== "up" && status !== "down") {
        throw new IndexerResponseError(endpoint, `checked_in[${index}].status is not "up" or "down".`);
      }
      return {
        watcher: stellarAddress(w, "watcher", endpoint),
        status,
        checkedAt: timestamp(w, "checked_at", endpoint),
      };
    }),
    notYetCheckedIn: fields.not_yet_checked_in.map((address, index) => {
      if (typeof address !== "string" || !StrKey.isValidEd25519PublicKey(address)) {
        throw new IndexerResponseError(endpoint, `not_yet_checked_in[${index}] is not a watcher address.`);
      }
      return address;
    }),
  };
}

// ---------------------------------------------------------------------------
// Endpoint 3 — GET /v1/slas/{sla_id}/settlements?limit=&before=
// ---------------------------------------------------------------------------

export interface IndexedSettlement {
  roundId: bigint;
  votesUp: number;
  votesDown: number;
  quorumThreshold: number;
  penaltyAmount: bigint;
  beneficiary: string;
  txHash: string;
  ledgerCloseTime: string;
  /** As reported by the indexer. Prefer a link built from `txHash` for the configured network. */
  explorerUrl: string;
}

export async function getSettlements(
  slaId: bigint,
  options: { limit?: number; before?: string } = {},
): Promise<PagedResult<IndexedSettlement>> {
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new RangeError("limit must be a positive integer.");
  }
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.before !== undefined) params.set("before", options.before);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const endpoint = `/v1/slas/${checkSlaId(slaId)}/settlements${query}`;
  return envelope(await indexerGet(endpoint), endpoint, (s) => ({
    roundId: BigInt(nonNegativeInt(s, "round_id", endpoint)),
    votesUp: nonNegativeInt(s, "votes_up", endpoint),
    votesDown: nonNegativeInt(s, "votes_down", endpoint),
    quorumThreshold: nonNegativeInt(s, "quorum_threshold", endpoint),
    penaltyAmount: amount(s, "penalty_amount", endpoint),
    beneficiary: stellarAddress(s, "beneficiary", endpoint),
    txHash: txHash(s, "tx_hash", endpoint),
    ledgerCloseTime: timestamp(s, "ledger_close_time", endpoint),
    explorerUrl: httpsUrl(s, "explorer_url", endpoint),
  }));
}

// ---------------------------------------------------------------------------
// Endpoint 4 — GET /v1/providers/{address}/slas
// ---------------------------------------------------------------------------

export interface ProviderSlaSummary {
  slaId: bigint;
  token: string;
  bondAmountAtCreation: bigint;
  beneficiary: string;
  createdAt: string;
  txHash: string;
}

/**
 * Returns which SLA IDs exist for a provider. This is deliberately thin —
 * it does not carry live bond balance or status. Callers must follow up
 * with a live getSla/getBondBalance read per ID via the SDK.
 */
export async function getProviderSlas(
  address: string,
): Promise<PagedResult<ProviderSlaSummary>> {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new RangeError("address must be a valid Stellar account address (G...).");
  }
  const endpoint = `/v1/providers/${address}/slas`;
  return envelope(await indexerGet(endpoint), endpoint, (s) => ({
    slaId: BigInt(nonNegativeInt(s, "sla_id", endpoint)),
    token: stellarAddress(s, "token", endpoint),
    bondAmountAtCreation: amount(s, "bond_amount_at_creation", endpoint),
    beneficiary: stellarAddress(s, "beneficiary", endpoint),
    createdAt: timestamp(s, "created_at", endpoint),
    txHash: txHash(s, "tx_hash", endpoint),
  }));
}

// ---------------------------------------------------------------------------
// Endpoint 5 — GET /v1/clock
// Not wrapped in the { data, next_cursor } envelope.
// ---------------------------------------------------------------------------

export interface Clock {
  ledgerSequence: number;
  ledgerCloseTime: string;
  currentRoundId: bigint;
}

/**
 * The authoritative source for the current round_id. Never derive round_id
 * from the browser's clock — see apps/docs/api.md.
 */
export async function getClock(): Promise<Clock> {
  const endpoint = "/v1/clock";
  const fields = asObject(await indexerGet(endpoint), endpoint, "the response");
  return {
    ledgerSequence: nonNegativeInt(fields, "ledger_sequence", endpoint),
    ledgerCloseTime: timestamp(fields, "ledger_close_time", endpoint),
    currentRoundId: BigInt(nonNegativeInt(fields, "current_round_id", endpoint)),
  };
}
