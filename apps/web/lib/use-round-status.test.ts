import { Keypair } from "@stellar/stellar-sdk";
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
import { fetchRoundStatus } from "./use-round-status";

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
    const view = await fetchRoundStatus(7n);
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
    expect(getRoundTally).toHaveBeenCalledWith(7n, 100n);
  });

  it("keeps on-chain reads working when the participation endpoint is down", async () => {
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("indexer unreachable"));
    const view = await fetchRoundStatus(7n);
    expect(view.watchers).toEqual({ status: "unavailable", message: "Soroban RPC request failed: indexer unreachable" });
    expect(view.roundId).toBe(100n);
    expect(view.tally.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
  });

  it("falls back to the participation endpoint's round when the clock is down", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    const view = await fetchRoundStatus(7n);
    expect(view.roundId).toBe(100n);
    expect(view.tally.status).toBe("ok");
  });

  it("reports every round-dependent value as unavailable when no round is known", async () => {
    vi.mocked(getClock).mockRejectedValue(new Error("clock down"));
    vi.mocked(getCurrentRound).mockRejectedValue(new Error("round down"));
    const view = await fetchRoundStatus(7n);
    expect(view.roundId).toBeNull();
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: clock down" });
    expect(view.settled.status).toBe("unavailable");
    expect(getRoundTally).not.toHaveBeenCalled();
  });

  it("reports an RPC failure on the tally without hiding the watchers", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n);
    expect(view.tally).toEqual({ status: "unavailable", message: "Soroban RPC request failed: rpc down" });
    expect(view.watchers.status).toBe("ok");
    expect(view.settled.status).toBe("ok");
  });

  it("never invents a tally of zero when the read failed", async () => {
    vi.mocked(getRoundTally).mockRejectedValue(new Error("rpc down"));
    const view = await fetchRoundStatus(7n);
    expect(view.tally).not.toHaveProperty("value");
  });
});
