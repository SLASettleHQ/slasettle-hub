import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./wallet")>();
  return {
    ...actual,
    signTransaction: vi.fn(),
    submitTransaction: vi.fn(),
  };
});

import { WalletError, signTransaction, submitTransaction } from "./wallet";
import { isTransactionBusy, useTransaction } from "./use-transaction";

const TESTNET = "Test SDF Network ; September 2015";
const FUTURENET = "Test SDF Future Network ; October 2022";

function walletOn(networkPassphrase: string) {
  return { address: "GADDRESS", network: "NET", networkPassphrase };
}

beforeEach(() => {
  vi.mocked(signTransaction).mockReset();
  vi.mocked(submitTransaction).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("useTransaction network guard", () => {
  it("builds, signs and submits when the wallet is on the configured network", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
    vi.mocked(signTransaction).mockResolvedValue({} as never);
    vi.mocked(submitTransaction).mockResolvedValue({ hash: "abc", status: "SUCCESS" } as never);
    const build = vi.fn().mockResolvedValue({});

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(build, walletOn(TESTNET));
    });

    expect(build).toHaveBeenCalledTimes(1);
    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(submitTransaction).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ status: "confirmed", hash: "abc" });
  });

  it("builds, signs and submits nothing when the wallet is on another network", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
    const build = vi.fn();

    const { result } = renderHook(() => useTransaction());
    let outcome: unknown = "unset";
    await act(async () => {
      outcome = await result.current.run(build, walletOn(FUTURENET));
    });

    expect(outcome).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    expect(submitTransaction).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({
      status: "failed",
      message: "Your wallet is on Futurenet. Switch your wallet to Testnet before submitting transactions.",
    });
  });

  it("fails closed when the app has no configured network", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", "");
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    const build = vi.fn();

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(build, walletOn(TESTNET));
    });

    expect(build).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    expect(submitTransaction).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      status: "failed",
      message: expect.stringContaining("no network configured"),
    });
  });
});

describe("useTransaction outcomes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
    vi.mocked(signTransaction).mockResolvedValue({} as never);
  });

  it("is pending after submission and only confirmed once the result is SUCCESS", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(submitTransaction).mockImplementation((_tx, options) => {
      options?.onSubmitted?.("hash1");
      return new Promise((resolve) => {
        finish = resolve;
      }) as never;
    });

    const { result } = renderHook(() => useTransaction());
    let running: Promise<unknown> = Promise.resolve();
    await act(async () => {
      running = result.current.run(async () => ({}) as never, walletOn(TESTNET));
    });
    expect(result.current.state).toEqual({ status: "pending", hash: "hash1" });
    expect(isTransactionBusy(result.current.state)).toBe(true);

    await act(async () => {
      finish({ hash: "hash1", status: "SUCCESS" });
      await running;
    });
    expect(result.current.state).toEqual({ status: "confirmed", hash: "hash1" });
    expect(isTransactionBusy(result.current.state)).toBe(false);
  });

  it("reports a wallet rejection as rejected and never submits", async () => {
    vi.mocked(signTransaction).mockRejectedValue(new WalletError("The user rejected this request."));

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(async () => ({}) as never, walletOn(TESTNET));
    });

    expect(submitTransaction).not.toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ status: "rejected" });
  });

  it("reports other wallet errors as failures with their message", async () => {
    vi.mocked(signTransaction).mockRejectedValue(new WalletError("Freighter is locked."));

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(async () => ({}) as never, walletOn(TESTNET));
    });

    expect(result.current.state).toEqual({ status: "failed", message: "Freighter is locked." });
  });

  it("reports an on-chain failure with the hash", async () => {
    vi.mocked(submitTransaction).mockResolvedValue({ hash: "h2", status: "FAILED" } as never);

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(async () => ({}) as never, walletOn(TESTNET));
    });

    expect(result.current.state).toMatchObject({ status: "failed", hash: "h2" });
  });

  it("reports a poll that never resolved as unconfirmed, not failed or confirmed", async () => {
    vi.mocked(submitTransaction).mockResolvedValue({ hash: "h3", status: "NOT_FOUND" } as never);

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(async () => ({}) as never, walletOn(TESTNET));
    });

    expect(result.current.state).toMatchObject({ status: "unconfirmed", hash: "h3" });
  });

  it("surfaces a build-time validation error from the form", async () => {
    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("Penalty exceeds bond.");
      }, walletOn(TESTNET));
    });

    expect(signTransaction).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: "failed", message: "Penalty exceeds bond." });
  });
});
