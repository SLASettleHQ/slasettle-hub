import { Address, Keypair, scValToNative } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getSdkConfig: vi.fn(),
  simulateReadCall: vi.fn(),
  buildInvokeTx: vi.fn(),
}));

import { getSdkConfig, simulateReadCall } from "./client.js";
import { getRoundTally, getWatcherCount, hasWatcherVoted, isWatcher } from "./watcher-registry.js";

const simulateReadCallMock = vi.mocked(simulateReadCall);
const getSdkConfigMock = vi.mocked(getSdkConfig);

const WATCHER = Keypair.random().publicKey();
const REGISTRY_CONTRACT_ID = Address.contract(new Uint8Array(32).fill(4)).toString();

getSdkConfigMock.mockReturnValue({
  sorobanRpcUrl: "https://rpc.test",
  networkPassphrase: "Test SDF Network ; September 2015",
  slaVaultContractId: Address.contract(new Uint8Array(32).fill(5)).toString(),
  watcherRegistryContractId: REGISTRY_CONTRACT_ID,
});

beforeEach(() => {
  simulateReadCallMock.mockReset();
});

describe("getRoundTally", () => {
  it("decodes votes_up/votes_down into camelCase RoundTally", async () => {
    simulateReadCallMock.mockResolvedValue({ votes_up: 3, votes_down: 5 });
    await expect(getRoundTally(1n, 2n)).resolves.toEqual({ votesUp: 3, votesDown: 5 });
    expect(simulateReadCallMock).toHaveBeenCalledWith(
      REGISTRY_CONTRACT_ID,
      "get_round_tally",
      expect.any(Array),
    );
  });

  it("throws a clear error when the tally is missing fields", async () => {
    simulateReadCallMock.mockResolvedValue({ votes_up: 3 });
    await expect(getRoundTally(1n, 2n)).rejects.toThrow(/missing votes_up\/votes_down/);
  });
});

describe("hasWatcherVoted", () => {
  it("returns the raw boolean and encodes (sla_id, round_id, watcher)", async () => {
    simulateReadCallMock.mockResolvedValue(true);
    await expect(hasWatcherVoted(1n, 2n, WATCHER)).resolves.toBe(true);
    const args = simulateReadCallMock.mock.calls[0]![2] as import("@stellar/stellar-sdk").xdr.ScVal[];
    expect(args.map((scVal) => scValToNative(scVal))).toEqual([1n, 2n, WATCHER]);
  });

  it("rejects a non-boolean result", async () => {
    simulateReadCallMock.mockResolvedValue(null);
    await expect(hasWatcherVoted(1n, 2n, WATCHER)).rejects.toThrow(/expected a boolean/);
  });
});

describe("isWatcher", () => {
  it("returns the raw boolean", async () => {
    simulateReadCallMock.mockResolvedValue(false);
    await expect(isWatcher(WATCHER)).resolves.toBe(false);
  });

  it("rejects a non-boolean result", async () => {
    simulateReadCallMock.mockResolvedValue(1);
    await expect(isWatcher(WATCHER)).rejects.toThrow(/expected a boolean/);
  });
});

describe("getWatcherCount", () => {
  it("returns the raw number", async () => {
    simulateReadCallMock.mockResolvedValue(5);
    await expect(getWatcherCount()).resolves.toBe(5);
    expect(simulateReadCallMock).toHaveBeenCalledWith(REGISTRY_CONTRACT_ID, "get_watcher_count", []);
  });

  it("rejects a non-number result", async () => {
    simulateReadCallMock.mockResolvedValue("5");
    await expect(getWatcherCount()).rejects.toThrow(/expected a number/);
  });
});
