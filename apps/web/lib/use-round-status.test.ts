import { Keypair } from "@stellar/stellar-sdk";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@slasettle/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@slasettle/sdk")>()),
  getRoundTally: vi.fn(),
  isRoundSettled: vi.fn(),
}));
vi.mock("./indexer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./indexer")>()),
  getClock: vi.fn(),
  getCurrentRound: vi.fn(),
}));

import { getRoundTally, isRoundSettled } from "@slasettle/sdk";
import { getClock, getCurrentRound } from "./indexer";
import { fetchRoundStatus, useRoundStatus } from "./use-round-status";
import { TEST_ENDPOINT_HASH } from "@/test/fixtures";

const W1 = Keypair.random().publicKey();
const W2 = Keypair.random().publicKey();

const CLOCK = { ledgerSequence: 1, ledgerCloseTime: "2026-10-01T00:00:30.000Z", currentRoundId: 100n };
const CURRENT_ROUND = {
  roundId: 100n,
  roundStartedAt: "2026-10-01T00:00:00.000Z",
  ledgerSnapshot: { status: "verified" as const, sequence: 1, closeTime: CLOCK.ledgerCloseTime },
  checkedIn: [{ watcher: W1, status: "down" as const, checkedAt: "2026-10-01T00:00:05Z" }],
  notYetCheckedIn: [W2],
};
const LEGACY_CURRENT_ROUND = {
  ...CURRENT_ROUND,
  ledgerSnapshot: { status: "legacy" as const },
};

beforeEach(() => {
  vi.mocked(getClock).mockReset().mockResolvedValue(CLOCK);
  vi.mocked(getCurrentRound).mockReset().mockResolvedValue(CURRENT_ROUND);
  vi.mocked(getRoundTally).mockReset().mockResolvedValue({ votesUp: 0, votesDown: 1 });
  vi.mocked(isRoundSettled).mockReset().mockResolvedValue(false);
});

describe("fetchRoundStatus", () => {
  it("combines indexer participation with on-chain tally and settled state", async () => {
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.roundId).toBe(100n);
    expect(view.asOf).toBe(CURRENT_ROUND.ledgerSnapshot.closeTime);
    expect(view.asOfSource).toBe("ledger");
    expect(view.watchers).toEqual({
      status: "ok",
      value: [
        { address: W1, status: "down" },
        { address: W2, status: "pending" },
      ],
    });
    expect(view.tally).toEqual({ status: "ok", value: { votesUp: 0, votesDown: 1 } });
    expect(view.settled).toEqual({ status: "ok", value: false });
    expect(view.participationVerified).toBe(true);
    expect(view.settlementReady).toBe(true);
    expect(getCurrentRound).toHaveBeenCalledTimes(1);
    expect(getClock).not.toHaveBeenCalled();
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n, TEST_ENDPOINT_HASH);
    expect(isRoundSettled).toHaveBeenCalledWith(7n, 100n);
  });

  it("uses the round and ledger close time from one current-round snapshot across a clock boundary", async () => {
    vi.mocked(getClock).mockResolvedValue({ ...CLOCK, currentRoundId: 101n });

    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);

    expect(view.roundId).toBe(CURRENT_ROUND.roundId);
    expect(view.asOf).toBe(CURRENT_ROUND.ledgerSnapshot.closeTime);
    expect(view.asOfSource).toBe("ledger");
    expect(getClock).not.toHaveBeenCalled();
    expect(getRoundTally).toHaveBeenCalledWith(7n, CURRENT_ROUND.roundId, TEST_ENDPOINT_HASH);
    expect(isRoundSettled).toHaveBeenCalledWith(7n, CURRENT_ROUND.roundId);
  });

  it("keeps clock and on-chain status readable when current-round fails but disables settlement", async () => {
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("indexer unreachable"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.watchers).toEqual({ status: "unavailable", message: "Soroban RPC request failed: indexer unreachable" });
    expect(view.roundId).toBe(100n);
    expect(view.asOf).toBe(CLOCK.ledgerCloseTime);
    expect(view.asOfSource).toBe("ledger");
    expect(view.tally.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
    expect(view.participationVerified).toBe(false);
    expect(view.settlementReady).toBe(false);
    expect(getClock).toHaveBeenCalledTimes(1);
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n, TEST_ENDPOINT_HASH);
    expect(isRoundSettled).toHaveBeenCalledWith(7n, 100n);
  });

  it("uses the clock only for read-only fallback when an older Worker omits the ledger snapshot", async () => {
    vi.mocked(getCurrentRound).mockResolvedValue(LEGACY_CURRENT_ROUND);
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);

    expect(view.roundId).toBe(100n);
    expect(view.asOf).toBe(CLOCK.ledgerCloseTime);
    expect(view.asOfSource).toBe("ledger");
    expect(view.watchers.status).toBe("ok");
    expect(view.participationVerified).toBe(false);
    expect(view.settlementReady).toBe(false);
    expect(getClock).toHaveBeenCalledTimes(1);
  });

  it("does not show legacy watcher rows for a different clock round", async () => {
    vi.mocked(getCurrentRound).mockResolvedValue(LEGACY_CURRENT_ROUND);
    vi.mocked(getClock).mockResolvedValue({ ...CLOCK, currentRoundId: 101n });
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);

    expect(view.roundId).toBe(101n);
    expect(view.watchers).toEqual({
      status: "unavailable",
      message: "Watcher check-ins belong to a different round than the latest network clock.",
    });
    expect(view.settlementReady).toBe(false);
    expect(getRoundTally).toHaveBeenCalledWith(7n, 101n, TEST_ENDPOINT_HASH);
  });

  it("keeps a legacy round visible when the clock is down but marks it degraded", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    vi.mocked(getCurrentRound).mockResolvedValue(LEGACY_CURRENT_ROUND);
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.roundId).toBe(100n);
    expect(view.asOf).toBe(CURRENT_ROUND.roundStartedAt);
    expect(view.asOfSource).toBe("round-start");
    expect(view.watchers.status).toBe("ok");
    expect(view.participationVerified).toBe(false);
    expect(view.settlementReady).toBe(false);
    expect(view.tally.status).toBe("ok");
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n, TEST_ENDPOINT_HASH);
    expect(isRoundSettled).toHaveBeenCalledWith(7n, 100n);
  });

  it("reports every round-dependent value as unavailable when no round is known", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("round down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.roundId).toBeNull();
    expect(view.asOf).toBeNull();
    expect(view.asOfSource).toBeNull();
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: clock down" });
    expect(view.settled.status).toBe("unavailable");
    expect(view.settlementReady).toBe(false);
    expect(getRoundTally).not.toHaveBeenCalled();
  });

  it("reports an RPC failure on the tally without hiding the watchers", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: rpc down" });
    expect(view.watchers.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
    expect(view.settlementReady).toBe(false);
  });

  it("never invents a tally of zero when the read failed", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.tally).not.toHaveProperty("value");
  });

  it("does not mark settlement ready when the on-chain settled read fails", async () => {
    vi.mocked(isRoundSettled).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.settled.status).toBe("unavailable");
    expect(view.settlementReady).toBe(false);
  });
});

describe("useRoundStatus configuration gating", () => {
  it("does not request data until the endpoint hash is available", () => {
    const { result } = renderHook(() => useRoundStatus(7n, null));

    expect(result.current).toMatchObject({ data: null, error: null, loading: true });
    expect(getClock).not.toHaveBeenCalled();
    expect(getCurrentRound).not.toHaveBeenCalled();
    expect(getRoundTally).not.toHaveBeenCalled();
    expect(isRoundSettled).not.toHaveBeenCalled();
  });

  it("starts the first poll immediately when the endpoint hash becomes available", async () => {
    const { result, rerender } = renderHook(
      ({ endpointHash }: { endpointHash: Uint8Array | null }) => useRoundStatus(7n, endpointHash),
      { initialProps: { endpointHash: null as Uint8Array | null } },
    );

    expect(result.current).toMatchObject({ data: null, error: null, loading: true });
    expect(getClock).not.toHaveBeenCalled();
    expect(getCurrentRound).not.toHaveBeenCalled();

    rerender({ endpointHash: TEST_ENDPOINT_HASH });
    await waitFor(() => expect(result.current.data?.roundId).toBe(100n));

    expect(getClock).not.toHaveBeenCalled();
    expect(getCurrentRound).toHaveBeenCalledTimes(1);
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n, TEST_ENDPOINT_HASH);
  });

  it("invalidates prior configuration data and polls the new SLA and endpoint hash", async () => {
    const nextHash = new Uint8Array(32).fill(8);
    vi.mocked(getClock)
      .mockReset()
      .mockResolvedValueOnce(CLOCK)
      .mockResolvedValueOnce({ ...CLOCK, currentRoundId: 101n });
    vi.mocked(getCurrentRound)
      .mockReset()
      .mockResolvedValueOnce(CURRENT_ROUND)
      .mockResolvedValueOnce({
        ...CURRENT_ROUND,
        roundId: 101n,
        roundStartedAt: "2026-10-01T00:01:00.000Z",
        ledgerSnapshot: { status: "verified", sequence: 2, closeTime: "2026-10-01T00:01:00.000Z" },
      });

    const { result, rerender } = renderHook(
      ({ slaId, endpointHash }: { slaId: bigint; endpointHash: Uint8Array }) => useRoundStatus(slaId, endpointHash),
      { initialProps: { slaId: 7n, endpointHash: TEST_ENDPOINT_HASH } },
    );
    await waitFor(() => expect(result.current.data?.roundId).toBe(100n));

    rerender({ slaId: 8n, endpointHash: nextHash });
    expect(result.current).toMatchObject({ data: null, error: null, loading: true });
    await waitFor(() => expect(result.current.data?.roundId).toBe(101n));

    expect(getClock).not.toHaveBeenCalled();
    expect(getCurrentRound).toHaveBeenCalledTimes(2);
    expect(getRoundTally).toHaveBeenLastCalledWith(8n, 101n, nextHash);
    expect(isRoundSettled).toHaveBeenLastCalledWith(8n, 101n);
  });

  it("recovers from a clock-only degraded poll when a later current-round read succeeds", async () => {
    vi.mocked(getCurrentRound)
      .mockReset()
      .mockRejectedValueOnce(new Error("temporary current-round failure"))
      .mockResolvedValueOnce(CURRENT_ROUND);
    const { result } = renderHook(() => useRoundStatus(7n, TEST_ENDPOINT_HASH));

    await waitFor(() => expect(result.current.data?.settlementReady).toBe(false));
    expect(result.current.data?.roundId).toBe(100n);
    expect(result.current.error).toBeNull();

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.data?.settlementReady).toBe(true));
    expect(result.current.error).toBeNull();
    expect(getClock).toHaveBeenCalledTimes(1);
    expect(getCurrentRound).toHaveBeenCalledTimes(2);
  });
});
