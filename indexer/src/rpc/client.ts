import { rpc } from "@stellar/stellar-sdk";
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

export class SorobanEventClient implements EventClient {
  private readonly server: rpc.Server;

  constructor(rpcUrl: string) {
    this.server = new rpc.Server(rpcUrl);
  }

  async getLatestLedger(): Promise<number> {
    const res = await this.server.getLatestLedger();
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

    if (params.cursor.kind === "ledger") {
      return this.server.getEvents({ ...base, startLedger: params.cursor.startLedger });
    }
    return this.server.getEvents({ ...base, cursor: params.cursor.cursor });
  }
}
