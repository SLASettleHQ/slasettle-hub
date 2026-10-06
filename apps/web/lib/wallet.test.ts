import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendTransaction = vi.fn();
const pollTransaction = vi.fn();

vi.mock("@slasettle/sdk", () => ({
  getSdkConfig: vi.fn(),
  getRpcServer: () => ({ sendTransaction, pollTransaction }),
}));
vi.mock("@stellar/freighter-api", () => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

import { WalletError, isUserRejection, submitTransaction } from "./wallet";

const SIGNED = {} as never;

beforeEach(() => {
  sendTransaction.mockReset();
  pollTransaction.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("submitTransaction", () => {
  it("reports the hash as submitted before polling for the final status", async () => {
    sendTransaction.mockResolvedValue({ status: "PENDING", hash: "h1" });
    const order: string[] = [];
    pollTransaction.mockImplementation(async () => {
      order.push("poll");
      return { status: "SUCCESS" };
    });

    const result = await submitTransaction(SIGNED, { onSubmitted: (hash) => order.push(`submitted:${hash}`) });

    expect(order).toEqual(["submitted:h1", "poll"]);
    expect(result).toMatchObject({ hash: "h1", status: "SUCCESS" });
  });

  it("polls a DUPLICATE submission rather than treating it as an error", async () => {
    sendTransaction.mockResolvedValue({ status: "DUPLICATE", hash: "h2" });
    pollTransaction.mockResolvedValue({ status: "SUCCESS" });
    await expect(submitTransaction(SIGNED)).resolves.toMatchObject({ hash: "h2", status: "SUCCESS" });
  });

  it("throws on ERROR and TRY_AGAIN_LATER without polling or reporting a submission", async () => {
    const onSubmitted = vi.fn();
    sendTransaction.mockResolvedValueOnce({ status: "ERROR", hash: "h3" });
    await expect(submitTransaction(SIGNED, { onSubmitted })).rejects.toThrow(/rejected the transaction/);
    sendTransaction.mockResolvedValueOnce({ status: "TRY_AGAIN_LATER", hash: "h4" });
    await expect(submitTransaction(SIGNED, { onSubmitted })).rejects.toThrow(/busy/);
    expect(pollTransaction).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});

describe("isUserRejection", () => {
  it("recognises a declined wallet request and nothing else", () => {
    expect(isUserRejection(new WalletError("The user rejected this request."))).toBe(true);
    expect(isUserRejection(new WalletError("User declined access"))).toBe(true);
    expect(isUserRejection(new WalletError("Freighter is locked."))).toBe(false);
    expect(isUserRejection(new Error("The user rejected this request."))).toBe(false);
  });
});
