/**
 * Typed client for the SLASettle indexer HTTP API, per
 * SLASettle-indexer-api-spec.md. The indexer is a read-side cache of
 * history (what happened) — anything that must be current-as-of-right-now
 * (bond balance, SLA status, live tallies) is a direct Soroban read via
 * @slasettle/sdk instead, never this client.
 *
 * Only the fields the spec actually documents are modeled here. A mismatch
 * between the real API and this file should surface as a decode error, not
 * be silently absorbed.
 */

export class MissingIndexerConfigError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_INDEXER_API_URL is not set. The indexer base URL is " +
        "supplied per deployment once the indexer is reachable.",
    );
    this.name = "MissingIndexerConfigError";
  }
}

export class IndexerApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    statusText: string,
  ) {
    super(`Indexer request to ${endpoint} failed: ${status} ${statusText}`);
    this.name = "IndexerApiError";
  }
}

function getIndexerBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL;
  if (!baseUrl) {
    throw new MissingIndexerConfigError();
  }
  return baseUrl;
}

async function indexerGet<T>(path: string): Promise<T> {
  const baseUrl = getIndexerBaseUrl();
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new IndexerApiError(path, response.status, response.statusText);
  }
  return (await response.json()) as T;
}

/** The `{ data, next_cursor }` envelope used by every list-returning endpoint. */
interface Page<T> {
  data: T[];
  next_cursor: string | null;
}

export interface PagedResult<T> {
  data: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Endpoint 1 — GET /v1/watchers
// ---------------------------------------------------------------------------

interface RawWatcher {
  address: string;
  registered_at: string;
}

export interface EligibleWatcher {
  address: string;
  registeredAt: string;
}

export async function getWatchers(): Promise<PagedResult<EligibleWatcher>> {
  const page = await indexerGet<Page<RawWatcher>>("/v1/watchers");
  return {
    data: page.data.map((w) => ({ address: w.address, registeredAt: w.registered_at })),
    nextCursor: page.next_cursor,
  };
}

// ---------------------------------------------------------------------------
// Endpoint 2 — GET /v1/slas/{sla_id}/current-round
// Not wrapped in the { data, next_cursor } envelope.
// ---------------------------------------------------------------------------

interface RawCheckedInWatcher {
  watcher: string;
  status: "up" | "down";
  checked_at: string;
}

interface RawCurrentRound {
  round_id: number;
  round_started_at: string;
  checked_in: RawCheckedInWatcher[];
  not_yet_checked_in: string[];
}

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
  const raw = await indexerGet<RawCurrentRound>(`/v1/slas/${slaId}/current-round`);
  return {
    roundId: BigInt(raw.round_id),
    roundStartedAt: raw.round_started_at,
    checkedIn: raw.checked_in.map((w) => ({
      watcher: w.watcher,
      status: w.status,
      checkedAt: w.checked_at,
    })),
    notYetCheckedIn: raw.not_yet_checked_in,
  };
}

// ---------------------------------------------------------------------------
// Endpoint 3 — GET /v1/slas/{sla_id}/settlements?limit=&before=
// ---------------------------------------------------------------------------

interface RawSettlement {
  round_id: number;
  votes_up: number;
  votes_down: number;
  quorum_threshold: number;
  penalty_amount: string;
  beneficiary: string;
  tx_hash: string;
  ledger_close_time: string;
  explorer_url: string;
}

export interface IndexedSettlement {
  roundId: bigint;
  votesUp: number;
  votesDown: number;
  quorumThreshold: number;
  penaltyAmount: bigint;
  beneficiary: string;
  txHash: string;
  ledgerCloseTime: string;
  explorerUrl: string;
}

export async function getSettlements(
  slaId: bigint,
  options: { limit?: number; before?: string } = {},
): Promise<PagedResult<IndexedSettlement>> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.before !== undefined) params.set("before", options.before);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const page = await indexerGet<Page<RawSettlement>>(
    `/v1/slas/${slaId}/settlements${query}`,
  );
  return {
    data: page.data.map((s) => ({
      roundId: BigInt(s.round_id),
      votesUp: s.votes_up,
      votesDown: s.votes_down,
      quorumThreshold: s.quorum_threshold,
      penaltyAmount: BigInt(s.penalty_amount),
      beneficiary: s.beneficiary,
      txHash: s.tx_hash,
      ledgerCloseTime: s.ledger_close_time,
      explorerUrl: s.explorer_url,
    })),
    nextCursor: page.next_cursor,
  };
}

// ---------------------------------------------------------------------------
// Endpoint 4 — GET /v1/providers/{address}/slas
// ---------------------------------------------------------------------------

interface RawProviderSla {
  sla_id: number;
  token: string;
  bond_amount_at_creation: string;
  beneficiary: string;
  created_at: string;
  tx_hash: string;
}

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
  const page = await indexerGet<Page<RawProviderSla>>(`/v1/providers/${address}/slas`);
  return {
    data: page.data.map((s) => ({
      slaId: BigInt(s.sla_id),
      token: s.token,
      bondAmountAtCreation: BigInt(s.bond_amount_at_creation),
      beneficiary: s.beneficiary,
      createdAt: s.created_at,
      txHash: s.tx_hash,
    })),
    nextCursor: page.next_cursor,
  };
}

// ---------------------------------------------------------------------------
// Endpoint 5 — GET /v1/clock
// Not wrapped in the { data, next_cursor } envelope.
// ---------------------------------------------------------------------------

interface RawClock {
  ledger_sequence: number;
  ledger_close_time: string;
  current_round_id: number;
}

export interface Clock {
  ledgerSequence: number;
  ledgerCloseTime: string;
  currentRoundId: bigint;
}

/**
 * The authoritative source for the current round_id. Never derive round_id
 * from the browser's clock — see SLASettle-indexer-api-spec.md.
 */
export async function getClock(): Promise<Clock> {
  const raw = await indexerGet<RawClock>("/v1/clock");
  return {
    ledgerSequence: raw.ledger_sequence,
    ledgerCloseTime: raw.ledger_close_time,
    currentRoundId: BigInt(raw.current_round_id),
  };
}
