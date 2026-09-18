import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet", () => ({
  isFreighterAvailable: vi.fn(),
  getActiveWallet: vi.fn(),
  connectWallet: vi.fn(),
  signTransaction: vi.fn(),
  submitTransaction: vi.fn(),
  WalletError: class WalletError extends Error {},
}));

vi.mock("@slasettle/sdk", () => ({
  buildCreateSlaTx: vi.fn(),
  getTokenDecimals: vi.fn(),
  getTokenSymbol: vi.fn(),
}));

import { buildCreateSlaTx, getTokenDecimals, getTokenSymbol } from "@slasettle/sdk";
import { getActiveWallet, isFreighterAvailable } from "@/lib/wallet";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { CreateSlaForm } from "./create-sla-form";

const PROVIDER_ADDRESS = "GPROVIDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB";
const BENEFICIARY_ADDRESS = "GBENEFICIARY234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const TOKEN_ADDRESS = "CTOKEN1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE";

beforeEach(() => {
  vi.mocked(isFreighterAvailable).mockResolvedValue(true);
  vi.mocked(getActiveWallet).mockResolvedValue({
    address: PROVIDER_ADDRESS,
    network: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
  });
  vi.mocked(buildCreateSlaTx).mockReset();
  vi.mocked(getTokenDecimals).mockReset();
  vi.mocked(getTokenSymbol).mockReset();
});

function renderForm() {
  return render(
    <WalletProvider>
      <CreateSlaForm />
    </WalletProvider>,
  );
}

describe("CreateSlaForm", () => {
  it("prompts to connect a wallet when disconnected", async () => {
    vi.mocked(getActiveWallet).mockResolvedValue(null);
    renderForm();

    expect(await screen.findByText(/Connect your wallet to create an SLA/)).toBeInTheDocument();
  });

  it("rejects submission with empty required fields, without building a transaction", async () => {
    const user = userEvent.setup();
    renderForm();

    const submit = await screen.findByRole("button", { name: "Create SLA" });
    await user.click(submit);

    expect(await screen.findAllByText("Required.")).toHaveLength(2);
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("rejects a non-positive quorum threshold", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(await screen.findByPlaceholderText("C..."), TOKEN_ADDRESS);
    await user.type(screen.getByPlaceholderText("G..."), BENEFICIARY_ADDRESS);
    await user.type(screen.getByPlaceholderText("3"), "0");
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(
      await screen.findByText("Enter a whole number of watchers, e.g. 3."),
    ).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("converts decimal amounts using the live token decimals and submits", async () => {
    vi.mocked(getTokenDecimals).mockResolvedValue(7);
    vi.mocked(getTokenSymbol).mockResolvedValue("USDC");
    vi.mocked(buildCreateSlaTx).mockResolvedValue({} as never);

    const user = userEvent.setup();
    renderForm();

    await user.type(await screen.findByPlaceholderText("C..."), TOKEN_ADDRESS);
    await user.type(screen.getByPlaceholderText("G..."), BENEFICIARY_ADDRESS);
    await user.type(screen.getByPlaceholderText("1000.00"), "1000.50");
    await user.type(screen.getByPlaceholderText("50.00"), "10.25");
    await user.type(screen.getByPlaceholderText("3"), "3");
    await user.type(screen.getByPlaceholderText("99.90"), "99.9");
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    await waitFor(() => expect(buildCreateSlaTx).toHaveBeenCalledTimes(1));
    expect(buildCreateSlaTx).toHaveBeenCalledWith({
      provider: PROVIDER_ADDRESS,
      token: TOKEN_ADDRESS,
      bondAmount: 1_000_5000000n,
      uptimeTargetBps: 9990,
      quorumThreshold: 3,
      penaltyPerBreach: 10_2500000n,
      beneficiary: BENEFICIARY_ADDRESS,
    });
  });

  it("rejects a penalty larger than the bond amount before building a transaction", async () => {
    vi.mocked(getTokenDecimals).mockResolvedValue(7);
    vi.mocked(getTokenSymbol).mockResolvedValue("USDC");

    const user = userEvent.setup();
    renderForm();

    await user.type(await screen.findByPlaceholderText("C..."), TOKEN_ADDRESS);
    await user.type(screen.getByPlaceholderText("G..."), BENEFICIARY_ADDRESS);
    await user.type(screen.getByPlaceholderText("1000.00"), "10");
    await user.type(screen.getByPlaceholderText("50.00"), "50");
    await user.type(screen.getByPlaceholderText("3"), "3");
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText(/cannot exceed the bond amount/)).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });
});
