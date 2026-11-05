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

const CLOCK = { ledgerSequence: 1, ledgerCloseTime: "2026-10-01T00:00:00.000Z", currentRoundId: 100n };
const CURRENT_ROUND = {
  roundId: 100n,
  roundStartedAt: "2026-10-01T00:00:00.000Z",
  checkedIn: [{ watcher: W1, status: "down" as const, checkedAt: "2026-10-01T00:00:05Z" }],
  notYetCheckedIn: [W2],
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
    expect(view.watchers).toEqual({
      status: "ok",
      value: [
        { address: W1, status: "down" },
        { address: W2, status: "pending" },
      ],
    });
    expect(view.tally).toEqual({ status: "ok", value: { votesUp: 0, votesDown: 1 } });
    expect(view.settled).toEqual({ status: "ok", value: false });
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n, TEST_ENDPOINT_HASH);
  });

  it("keeps on-chain reads working when the participation endpoint is down", async () => {
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("indexer unreachable"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.watchers).toEqual({ status: "unavailable", message: "Soroban RPC request failed: indexer unreachable" });
    expect(view.roundId).toBe(100n);
    expect(view.tally.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
  });

  it("falls back to the participation endpoint's round when the clock is down", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.roundId).toBe(100n);
    expect(view.tally.status).toBe("ok");
  });

  it("reports every round-dependent value as unavailable when no round is known", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("round down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.roundId).toBeNull();
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: clock down" });
    expect(view.settled.status).toBe("unavailable");
    expect(getRoundTally).not.toHaveBeenCalled();
  });

  it("reports an RPC failure on the tally without hiding the watchers", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: rpc down" });
    expect(view.watchers.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
  });

  it("never invents a tally of zero when the read failed", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n, TEST_ENDPOINT_HASH);
    expect(view.tally).not.toHaveProperty("value");
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

    expect(getClock).toHaveBeenCalledTimes(1);
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
      .mockResolvedValueOnce({ ...CURRENT_ROUND, roundId: 101n, roundStartedAt: "2026-10-01T00:01:00.000Z" });

    const { result, rerender } = renderHook(
      ({ slaId, endpointHash }: { slaId: bigint; endpointHash: Uint8Array }) => useRoundStatus(slaId, endpointHash),
      { initialProps: { slaId: 7n, endpointHash: TEST_ENDPOINT_HASH } },
    );
    await waitFor(() => expect(result.current.data?.roundId).toBe(100n));

    rerender({ slaId: 8n, endpointHash: nextHash });
    expect(result.current).toMatchObject({ data: null, error: null, loading: true });
    await waitFor(() => expect(result.current.data?.roundId).toBe(101n));

    expect(getClock).toHaveBeenCalledTimes(2);
    expect(getCurrentRound).toHaveBeenCalledTimes(2);
    expect(getRoundTally).toHaveBeenLastCalledWith(8n, 101n, nextHash);
    expect(isRoundSettled).toHaveBeenLastCalledWith(8n, 101n);
  });

  it("clears a failed initial poll when a later refresh succeeds", async () => {
    vi.mocked(getClock).mockImplementationOnce(() => {
      throw new Error("temporary indexer failure");
    });
    const { result } = renderHook(() => useRoundStatus(7n, TEST_ENDPOINT_HASH));

    await waitFor(() => expect(result.current.error).toBe("temporary indexer failure"));
    expect(result.current.data).toBeNull();

    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.data?.roundId).toBe(100n));
    expect(result.current.error).toBeNull();
  });
});
