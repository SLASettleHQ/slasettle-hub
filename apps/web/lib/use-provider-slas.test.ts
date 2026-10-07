import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@slasettle/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@slasettle/sdk")>()),
  getSla: vi.fn(),
  getBondBalance: vi.fn(),
  getTokenDecimals: vi.fn(),
  getTokenSymbol: vi.fn(),
}));
vi.mock("./indexer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./indexer")>()),
  getProviderSlas: vi.fn(),
}));

import { getBondBalance, getSla, getTokenDecimals, getTokenSymbol, type SLAConfig } from "@slasettle/sdk";
import { IndexerUnavailableError, getProviderSlas } from "./indexer";
import { fetchProviderSlas, useProviderSlas } from "./use-provider-slas";

const PROVIDER = Keypair.random().publicKey();
const TOKEN_A = StrKey.encodeContract(Buffer.alloc(32, 1));
const TOKEN_B = StrKey.encodeContract(Buffer.alloc(32, 2));

function summary(slaId: bigint, token = TOKEN_A) {
  return {
    slaId,
    token,
    bondAmountAtCreation: 1n,
    beneficiary: PROVIDER,
    createdAt: "2026-10-01T00:00:00Z",
    txHash: "a".repeat(64),
  };
}

function config(token: string): SLAConfig {
  return {
    provider: PROVIDER,
    token,
    bondAmount: 100n,
    uptimeTargetBps: 9990,
    quorumThreshold: 3,
    penaltyPerBreach: 10n,
    beneficiary: PROVIDER,
    status: "Active",
  };
}

beforeEach(() => {
  vi.mocked(getProviderSlas).mockReset();
  vi.mocked(getSla).mockReset().mockImplementation(async () => config(TOKEN_A));
  vi.mocked(getBondBalance).mockReset().mockResolvedValue(77n);
  vi.mocked(getTokenDecimals).mockReset().mockResolvedValue(7);
  vi.mocked(getTokenSymbol).mockReset().mockResolvedValue("USDC");
});

describe("fetchProviderSlas", () => {
  it("reads live state for each discovered id, not the indexer's creation-time bond", async () => {
    vi.mocked(getProviderSlas).mockResolvedValue({ data: [summary(0n), summary(1n)], nextCursor: null });
    const result = await fetchProviderSlas(PROVIDER);

    expect(result.failures).toEqual([]);
    expect(result.slas.map((s) => s.slaId)).toEqual([0n, 1n]);
    expect(result.slas[0]).toMatchObject({ bondBalance: 77n, tokenDecimals: 7, tokenSymbol: "USDC" });
    expect(getSla).toHaveBeenCalledTimes(2);
    expect(getBondBalance).toHaveBeenCalledTimes(2);
  });

  it("returns no SLAs, and no failures, when the provider has none", async () => {
    vi.mocked(getProviderSlas).mockResolvedValue({ data: [], nextCursor: null });
    await expect(fetchProviderSlas(PROVIDER)).resolves.toEqual({ slas: [], failures: [] });
  });

  it("throws when discovery fails, so an outage is never shown as an empty list", async () => {
    vi.mocked(getProviderSlas).mockRejectedValue(new IndexerUnavailableError("/v1/providers/x/slas", "fetch failed"));
    await expect(fetchProviderSlas(PROVIDER)).rejects.toBeInstanceOf(IndexerUnavailableError);
  });

  it("reports one SLA that cannot be read without hiding the others", async () => {
    vi.mocked(getProviderSlas).mockResolvedValue({ data: [summary(0n), summary(1n), summary(2n)], nextCursor: null });
    vi.mocked(getSla).mockImplementation(async (id) => {
      if (id === 1n) throw new Error("rpc timeout");
      return config(TOKEN_A);
    });
    const result = await fetchProviderSlas(PROVIDER);

    expect(result.slas.map((s) => s.slaId)).toEqual([0n, 2n]);
    expect(result.failures).toEqual([{ slaId: 1n, message: "Soroban RPC request failed: rpc timeout" }]);
  });

  it("reads each token's metadata once, however many SLAs share it", async () => {
    vi.mocked(getProviderSlas).mockResolvedValue({
      data: [summary(0n), summary(1n), summary(2n), summary(3n)],
      nextCursor: null,
    });
    vi.mocked(getSla).mockImplementation(async (id) => config(id === 3n ? TOKEN_B : TOKEN_A));
    await fetchProviderSlas(PROVIDER);

    expect(getTokenDecimals).toHaveBeenCalledTimes(2);
    expect(getTokenSymbol).toHaveBeenCalledTimes(2);
  });

  it("never runs more than a handful of SLA reads at once", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => BigInt(i));
    vi.mocked(getProviderSlas).mockResolvedValue({ data: ids.map((id) => summary(id)), nextCursor: null });
    let active = 0;
    let peak = 0;
    vi.mocked(getSla).mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return config(TOKEN_A);
    });
    await fetchProviderSlas(PROVIDER);

    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
});

describe("useProviderSlas refreshAfterCreate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps re-reading until a just-created SLA appears, then stops", async () => {
    const getProviderSlasMock = vi.mocked(getProviderSlas);
    getProviderSlasMock.mockResolvedValue({ data: [summary(0n), summary(1n)], nextCursor: null });
    const { result } = renderHook(() => useProviderSlas(PROVIDER));
    await waitFor(() => expect(result.current.slas).toHaveLength(2));
    const callsBefore = getProviderSlasMock.mock.calls.length;

    // The indexer has not ingested the new SLA yet: the first re-read is unchanged.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => result.current.refreshAfterCreate());
    await waitFor(() => expect(getProviderSlasMock.mock.calls.length).toBe(callsBefore + 1));
    expect(result.current.slas).toHaveLength(2);

    // Once it has, the next retry picks it up.
    getProviderSlasMock.mockResolvedValue({ data: [summary(0n), summary(1n), summary(2n)], nextCursor: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await waitFor(() => expect(result.current.slas).toHaveLength(3));

    // And it stops retrying.
    const callsAfterFound = getProviderSlasMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getProviderSlasMock.mock.calls.length).toBe(callsAfterFound);
  });

  it("gives up after a bounded number of retries when nothing new appears", async () => {
    const getProviderSlasMock = vi.mocked(getProviderSlas);
    getProviderSlasMock.mockResolvedValue({ data: [summary(0n)], nextCursor: null });
    const { result } = renderHook(() => useProviderSlas(PROVIDER));
    await waitFor(() => expect(result.current.slas).toHaveLength(1));

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => result.current.refreshAfterCreate());
    for (let step = 0; step < 40; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    }
    // One initial read, one immediate re-read, then at most 18 retries.
    expect(getProviderSlasMock.mock.calls.length).toBeLessThanOrEqual(1 + 1 + 18);
    expect(getProviderSlasMock.mock.calls.length).toBe(1 + 1 + 18);
  });
});
