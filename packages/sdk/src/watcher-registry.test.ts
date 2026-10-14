import { Address, Keypair, scValToNative } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getSdkConfig: vi.fn(),
  simulateReadCall: vi.fn(),
  buildInvokeTx: vi.fn(),
}));

import { getSdkConfig, simulateReadCall } from "./client.js";
import {
  getCurrentRound,
  getRoundTally,
  getWatcherCount,
  hasWatcherVoted,
  isWatcher,
} from "./watcher-registry.js";

const ENDPOINT_HASH = new Uint8Array(32).fill(9);

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
    await expect(getRoundTally(1n, 2n, ENDPOINT_HASH)).resolves.toEqual({
      votesUp: 3,
      votesDown: 5,
    });
    expect(simulateReadCallMock).toHaveBeenCalledWith(
      REGISTRY_CONTRACT_ID,
      "get_round_tally",
      expect.any(Array),
    );
  });

  it("encodes (sla_id, round_id, endpoint_hash) as the call args", async () => {
    simulateReadCallMock.mockResolvedValue({ votes_up: 0, votes_down: 0 });
    await getRoundTally(1n, 2n, ENDPOINT_HASH);
    const args = simulateReadCallMock.mock.calls[0]![2] as import("@stellar/stellar-sdk").xdr.ScVal[];
    const decoded = args.map((scVal) => scValToNative(scVal));
    expect(decoded[0]).toBe(1n);
    expect(decoded[1]).toBe(2n);
    expect(new Uint8Array(decoded[2] as Uint8Array)).toEqual(ENDPOINT_HASH);
  });

  it("throws a clear error when the tally is missing fields", async () => {
    simulateReadCallMock.mockResolvedValue({ votes_up: 3 });
    await expect(getRoundTally(1n, 2n, ENDPOINT_HASH)).rejects.toThrow(/missing votes_up\/votes_down/);
  });
});

describe("getRoundTally strictness", () => {
  it("rejects a tally whose counts are not numbers", async () => {
    simulateReadCallMock.mockResolvedValue({ votes_up: "3", votes_down: 5 });
    await expect(getRoundTally(1n, 2n, ENDPOINT_HASH)).rejects.toThrow(/expected numbers/);
  });

  it("rejects an out-of-range round id before any RPC call", async () => {
    await expect(getRoundTally(1n, -1n, ENDPOINT_HASH)).rejects.toMatchObject({ field: "roundId" });
    expect(simulateReadCallMock).not.toHaveBeenCalled();
  });

  it("rejects an endpoint hash that isn't 32 bytes, before any RPC call", async () => {
    await expect(getRoundTally(1n, 2n, new Uint8Array(31))).rejects.toThrow(/32 bytes/);
    expect(simulateReadCallMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed watcher address before any RPC call", async () => {
    await expect(isWatcher("not-an-address")).rejects.toMatchObject({ field: "watcher" });
    await expect(hasWatcherVoted(1n, 2n, "bad")).rejects.toMatchObject({ field: "watcher" });
    expect(simulateReadCallMock).not.toHaveBeenCalled();
  });
});

describe("getCurrentRound", () => {
  it("returns the raw round id as a bigint", async () => {
    simulateReadCallMock.mockResolvedValue(42n);
    await expect(getCurrentRound()).resolves.toBe(42n);
    expect(simulateReadCallMock).toHaveBeenCalledWith(
      REGISTRY_CONTRACT_ID,
      "get_current_round",
      [],
    );
  });

  it("rejects a non-bigint result", async () => {
    simulateReadCallMock.mockResolvedValue(42);
    await expect(getCurrentRound()).rejects.toThrow(/expected a bigint/);
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
