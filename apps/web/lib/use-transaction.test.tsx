import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./wallet", () => ({
  signTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

import { signTransaction, submitTransaction } from "./wallet";
import { useTransaction } from "./use-transaction";

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
