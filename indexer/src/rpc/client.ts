import { rpc } from "@stellar/stellar-sdk";
import type { Logger } from "pino";
import { wildcardTopicFilter } from "./decode.js";

/**
 * getEvents requires either startLedger or cursor, never both — the RPC
 * rejects the request outright if both are set. This type makes that
 * mutual exclusion explicit rather than leaving it to caller discipline.
 */
export type EventsCursor = { kind: "ledger"; startLedger: number } | { kind: "cursor"; cursor: string };

/**
 * The shape the poller actually depends on — extracted as an interface, not
 * the concrete class, so tests can pass a fake without fighting TypeScript's
 * structural typing over the class's private fields.
 */
export interface EventClient {
  getLatestLedger(): Promise<number>;
  getEvents(params: { contractIds: string[]; cursor: EventsCursor; limit: number }): Promise<rpc.Api.GetEventsResponse>;
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

/**
 * @stellar/stellar-sdk's HTTP client (feaxios) wraps every network-level
 * fetch failure in an AxiosError but never forwards the original error's
 * `.cause` — so a DNS failure, a dropped connection, and a timeout are all
 * indistinguishable "fetch failed" with `cause: undefined` by the time they
 * reach us (confirmed by reproducing the same request with plain `fetch()`,
 * which does surface a real cause: ETIMEDOUT / ENETUNREACH against the RPC
 * host's Cloudflare edge — an environment-level connectivity issue, not a
 * malformed request). An AxiosError with no `.response` is exactly the
 * shape of that swallowed network failure — as opposed to one *with* a
 * `.response`, which means the RPC host answered with an HTTP error status,
 * a real failure this indexer should surface immediately rather than retry.
 */
export function isTransientNetworkError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "isAxiosError" in err &&
    (err as { isAxiosError?: unknown }).isAxiosError === true &&
    (err as { response?: unknown }).response === undefined
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withNetworkRetry<T>(label: string, logger: Logger | undefined, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientNetworkError(err) || attempt === RETRY_ATTEMPTS) throw err;
      logger?.warn(
        { attempt, maxAttempts: RETRY_ATTEMPTS, label },
        `${label} failed with a network-level error whose real cause feaxios discards (see client.ts) — retrying, this is very likely transient`,
      );
      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw new Error("unreachable");
}

export class SorobanEventClient implements EventClient {
  private readonly server: rpc.Server;
  private readonly logger?: Logger;

  constructor(rpcUrl: string, logger?: Logger) {
    this.server = new rpc.Server(rpcUrl);
    this.logger = logger;
  }

  async getLatestLedger(): Promise<number> {
    const res = await withNetworkRetry("getLatestLedger", this.logger, () => this.server.getLatestLedger());
    return res.sequence;
  }

  /**
   * Fetches one page of events for the given contract IDs. Soroban RPC's
   * getEvents topic filter accepts at most 4 segments; this indexer never
   * relies on it for filtering anyway (see decode.ts for why) — the
   * wildcard filter is used here instead, and real filtering happens after
   * decoding. contractIds is capped at 5 per filter batch per the RPC's own
   * limit; this indexer only ever watches 2, well under that.
   */
  async getEvents(params: {
    contractIds: string[];
    cursor: EventsCursor;
    limit: number;
  }): Promise<rpc.Api.GetEventsResponse> {
    if (params.contractIds.length > 5) {
      throw new Error(
        `getEvents called with ${params.contractIds.length} contract IDs — Soroban RPC caps a single filter batch at 5. Split into multiple calls if this ever needs to watch more contracts.`,
      );
    }

    const base = {
      filters: [
        {
          type: "contract" as const,
          contractIds: params.contractIds,
          topics: wildcardTopicFilter(),
        },
      ],
      limit: params.limit,
    };

    return withNetworkRetry("getEvents", this.logger, () => {
      if (params.cursor.kind === "ledger") {
        return this.server.getEvents({ ...base, startLedger: params.cursor.startLedger });
      }
      return this.server.getEvents({ ...base, cursor: params.cursor.cursor });
    });
  }
}
