import { Address } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  simulateReadCall: vi.fn(),
}));

import { simulateReadCall } from "./client.js";
import { getTokenDecimals, getTokenSymbol } from "./token.js";

const simulateReadCallMock = vi.mocked(simulateReadCall);
const TOKEN_CONTRACT_ID = Address.contract(new Uint8Array(32).fill(6)).toString();

beforeEach(() => {
  simulateReadCallMock.mockReset();
});

describe("getTokenDecimals", () => {
  it("returns the raw number and calls decimals() on the given token", async () => {
    simulateReadCallMock.mockResolvedValue(7);
    await expect(getTokenDecimals(TOKEN_CONTRACT_ID)).resolves.toBe(7);
    expect(simulateReadCallMock).toHaveBeenCalledWith(TOKEN_CONTRACT_ID, "decimals", []);
  });

  it("rejects a non-number result", async () => {
    simulateReadCallMock.mockResolvedValue("7");
    await expect(getTokenDecimals(TOKEN_CONTRACT_ID)).rejects.toThrow(/expected a number/);
  });
});

describe("getTokenSymbol", () => {
  it("returns the raw string and calls symbol() on the given token", async () => {
    simulateReadCallMock.mockResolvedValue("USDC");
    await expect(getTokenSymbol(TOKEN_CONTRACT_ID)).resolves.toBe("USDC");
    expect(simulateReadCallMock).toHaveBeenCalledWith(TOKEN_CONTRACT_ID, "symbol", []);
  });

  it("rejects a non-string result", async () => {
    simulateReadCallMock.mockResolvedValue(42);
    await expect(getTokenSymbol(TOKEN_CONTRACT_ID)).rejects.toThrow(/expected a string/);
  });
});
