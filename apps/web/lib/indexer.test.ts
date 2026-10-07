import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IndexerApiError,
  IndexerResponseError,
  IndexerUnavailableError,
  MissingIndexerConfigError,
  getClock,
  getCurrentRound,
  getHealth,
  getProviderSlas,
  getSettlements,
  getWatchers,
} from "./indexer";

const WATCHER_A = Keypair.random().publicKey();
const WATCHER_B = Keypair.random().publicKey();
const PROVIDER = Keypair.random().publicKey();
const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 7));
const HASH = "6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147";

const fetchMock = vi.fn();

function respond(body: unknown, init: { status?: number; statusText?: string } = {}) {
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: init.status ?? 200,
      statusText: init.statusText ?? "",
    }),
  );
}

function settlementRow(overrides: Record<string, unknown> = {}) {
  return {
    round_id: 118,
    votes_up: 1,
    votes_down: 3,
    quorum_threshold: 3,
    penalty_amount: "170141183460469231731687303715884105727",
    beneficiary: WATCHER_B,
    tx_hash: HASH,
    ledger_close_time: "2026-09-27T23:41:47Z",
    explorer_url: `https://stellar.expert/explorer/testnet/tx/${HASH}`,
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_INDEXER_API_URL", "https://indexer.test/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getHealth", () => {
  it("parses a healthy response, with and without an indexed ledger", async () => {
    respond({ status: "ok", last_indexed_ledger: 4905879 });
    await expect(getHealth()).resolves.toEqual({ status: "ok", lastIndexedLedger: 4905879 });
    respond({ status: "ok", last_indexed_ledger: null });
    await expect(getHealth()).resolves.toEqual({ status: "ok", lastIndexedLedger: null });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://indexer.test/v1/health");
  });

  it("rejects an unexpected status value", async () => {
    respond({ status: "degraded", last_indexed_ledger: 1 });
    await expect(getHealth()).rejects.toBeInstanceOf(IndexerResponseError);
  });
});

describe("configuration", () => {
  it.each([undefined, ""])("has no built-in fallback when the URL is %j", async (value) => {
    vi.stubEnv("NEXT_PUBLIC_INDEXER_API_URL", value as string);
    if (value === undefined) delete process.env.NEXT_PUBLIC_INDEXER_API_URL;
    await expect(getHealth()).rejects.toBeInstanceOf(MissingIndexerConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("failure classification", () => {
  it("reports a network failure as unavailable, not as an empty result", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getWatchers()).rejects.toBeInstanceOf(IndexerUnavailableError);
  });

  it("reports a timeout as unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    await expect(getClock()).rejects.toThrow(/no response within/);
  });

  it("reports a non-2xx status as an API error carrying the status", async () => {
    respond({ error: "internal_error" }, { status: 500, statusText: "Internal Server Error" });
    await expect(getClock()).rejects.toMatchObject({ name: "IndexerApiError", status: 500 });
    respond("nope", { status: 404 });
    await expect(getClock()).rejects.toBeInstanceOf(IndexerApiError);
  });

  it("reports a non-JSON body as a malformed response", async () => {
    respond("<html>404</html>");
    await expect(getClock()).rejects.toBeInstanceOf(IndexerResponseError);
  });
});

describe("getWatchers", () => {
  it("maps the watcher list", async () => {
    respond({
      data: [{ address: WATCHER_A, registered_at: "2026-09-27T23:26:57Z" }],
      next_cursor: null,
    });
    await expect(getWatchers()).resolves.toEqual({
      data: [{ address: WATCHER_A, registeredAt: "2026-09-27T23:26:57Z" }],
      nextCursor: null,
    });
  });

  it("returns an empty list as empty, which is distinct from a failure", async () => {
    respond({ data: [], next_cursor: null });
    await expect(getWatchers()).resolves.toEqual({ data: [], nextCursor: null });
  });

  it.each([
    ["a missing data array", { next_cursor: null }],
    ["a non-array data field", { data: {}, next_cursor: null }],
    ["a bad cursor type", { data: [], next_cursor: 5 }],
    ["a non-address watcher", { data: [{ address: "nope", registered_at: "2026-09-27T23:26:57Z" }], next_cursor: null }],
    ["a bad timestamp", { data: [{ address: WATCHER_A, registered_at: "yesterday" }], next_cursor: null }],
    ["a null body", null],
  ])("rejects %s", async (_label, body) => {
    respond(body);
    await expect(getWatchers()).rejects.toBeInstanceOf(IndexerResponseError);
  });
});

describe("getCurrentRound", () => {
  const valid = {
    round_id: 29842537,
    round_started_at: "2026-09-27T23:37:00.000Z",
    checked_in: [{ watcher: WATCHER_A, status: "down", checked_at: "2026-09-27T23:37:12Z" }],
    not_yet_checked_in: [WATCHER_B],
  };

  it("maps checked-in and pending watchers", async () => {
    respond(valid);
    await expect(getCurrentRound(5n)).resolves.toEqual({
      roundId: 29842537n,
      roundStartedAt: "2026-09-27T23:37:00.000Z",
      checkedIn: [{ watcher: WATCHER_A, status: "down", checkedAt: "2026-09-27T23:37:12Z" }],
      notYetCheckedIn: [WATCHER_B],
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://indexer.test/v1/slas/5/current-round");
  });

  it("rejects a watcher status other than up or down", async () => {
    respond({ ...valid, checked_in: [{ ...valid.checked_in[0], status: "maybe" }] });
    await expect(getCurrentRound(5n)).rejects.toThrow(/status is not "up" or "down"/);
  });

  it("rejects missing participation arrays", async () => {
    respond({ ...valid, checked_in: undefined });
    await expect(getCurrentRound(5n)).rejects.toBeInstanceOf(IndexerResponseError);
  });

  it("refuses a negative SLA id before making a request", async () => {
    await expect(getCurrentRound(-1n)).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getSettlements", () => {
  it("parses rows and keeps i128 penalties exact", async () => {
    respond({ data: [settlementRow()], next_cursor: "abc" });
    const page = await getSettlements(1n);
    expect(page.nextCursor).toBe("abc");
    expect(page.data[0]).toMatchObject({
      roundId: 118n,
      votesUp: 1,
      votesDown: 3,
      quorumThreshold: 3,
      penaltyAmount: 170141183460469231731687303715884105727n,
      txHash: HASH,
    });
  });

  it("returns an empty history as empty", async () => {
    respond({ data: [], next_cursor: null });
    await expect(getSettlements(1n)).resolves.toEqual({ data: [], nextCursor: null });
  });

  it("sends limit and before, URL-encoded, for cursor pagination", async () => {
    respond({ data: [], next_cursor: null });
    await getSettlements(9n, { limit: 20, before: "a b/c=" });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://indexer.test/v1/slas/9/settlements?limit=20&before=a+b%2Fc%3D",
    );
  });

  it("follows next_cursor across two pages", async () => {
    respond({ data: [settlementRow({ round_id: 2 })], next_cursor: "page2" });
    respond({ data: [settlementRow({ round_id: 1 })], next_cursor: null });
    const first = await getSettlements(1n, { limit: 1 });
    const second = await getSettlements(1n, { limit: 1, before: first.nextCursor! });
    expect([first.data[0]!.roundId, second.data[0]!.roundId]).toEqual([2n, 1n]);
    expect(second.nextCursor).toBeNull();
    expect(String(fetchMock.mock.calls[1]![0])).toContain("before=page2");
  });

  it.each([
    ["a numeric penalty", { penalty_amount: 10000000 }],
    ["a negative penalty string", { penalty_amount: "-5" }],
    ["a short transaction hash", { tx_hash: "abc" }],
    ["a javascript: explorer URL", { explorer_url: "javascript:alert(1)" }],
    ["an http explorer URL", { explorer_url: "http://stellar.expert/x" }],
    ["a fractional round", { round_id: 1.5 }],
  ])("rejects %s", async (_label, override) => {
    respond({ data: [settlementRow(override)], next_cursor: null });
    await expect(getSettlements(1n)).rejects.toBeInstanceOf(IndexerResponseError);
  });

  it("refuses an invalid limit before making a request", async () => {
    await expect(getSettlements(1n, { limit: 0 })).rejects.toBeInstanceOf(RangeError);
    await expect(getSettlements(1n, { limit: 1.5 })).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getProviderSlas", () => {
  it("maps discovered SLA ids and keeps the creation bond as a bigint", async () => {
    respond({
      data: [
        {
          sla_id: 0,
          token: TOKEN,
          bond_amount_at_creation: "50000000",
          beneficiary: WATCHER_B,
          created_at: "2026-09-27T23:36:12Z",
          tx_hash: HASH,
        },
      ],
      next_cursor: null,
    });
    const page = await getProviderSlas(PROVIDER);
    expect(page.data[0]).toMatchObject({ slaId: 0n, bondAmountAtCreation: 50_000_000n, token: TOKEN });
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://indexer.test/v1/providers/${PROVIDER}/slas`);
  });

  it("returns no SLAs as empty, which is distinct from a failure", async () => {
    respond({ data: [], next_cursor: null });
    await expect(getProviderSlas(PROVIDER)).resolves.toEqual({ data: [], nextCursor: null });
  });

  it("refuses a malformed provider address before making a request", async () => {
    await expect(getProviderSlas("../../etc")).rejects.toBeInstanceOf(RangeError);
    await expect(getProviderSlas(TOKEN)).rejects.toBeInstanceOf(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getClock", () => {
  it("maps the ledger-derived round", async () => {
    respond({
      ledger_sequence: 4905879,
      ledger_close_time: "2026-09-27T23:53:00.000Z",
      current_round_id: 29842553,
    });
    await expect(getClock()).resolves.toEqual({
      ledgerSequence: 4905879,
      ledgerCloseTime: "2026-09-27T23:53:00.000Z",
      currentRoundId: 29842553n,
    });
  });

  it("rejects a clock with a missing round", async () => {
    respond({ ledger_sequence: 1, ledger_close_time: "2026-09-27T23:53:00.000Z" });
    await expect(getClock()).rejects.toBeInstanceOf(IndexerResponseError);
  });
});
