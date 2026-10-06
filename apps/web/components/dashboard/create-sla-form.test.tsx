import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet", () => ({
  isUserRejection: vi.fn(() => false),
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

// Real strkeys: the form validates address format before building anything.
const PROVIDER_ADDRESS = Keypair.random().publicKey();
const BENEFICIARY_ADDRESS = Keypair.random().publicKey();
const TOKEN_ADDRESS = StrKey.encodeContract(Buffer.alloc(32, 9));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015");
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

    expect(await screen.findByText("Enter the token contract ID.")).toBeInTheDocument();
    expect(screen.getByText("Enter the beneficiary address.")).toBeInTheDocument();
    expect(screen.getByText("Enter the number of Down votes required.")).toBeInTheDocument();
    expect(screen.getByText("Enter an uptime target, for example 99.90.")).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
    expect(getTokenDecimals).not.toHaveBeenCalled();
  });

  it("rejects a non-positive quorum threshold", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(await screen.findByPlaceholderText("C..."), TOKEN_ADDRESS);
    await user.type(screen.getByPlaceholderText("G..."), BENEFICIARY_ADDRESS);
    await user.type(screen.getByPlaceholderText("3"), "0");
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText("At least 1 Down vote is required.")).toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText("99.90"), "99.9");
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText("The penalty cannot exceed the bond (10 USDC).")).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  async function fillValid(user: ReturnType<typeof userEvent.setup>, overrides: Partial<Record<string, string>> = {}) {
    const entries: Record<string, string> = {
      "C...": TOKEN_ADDRESS,
      "G...": BENEFICIARY_ADDRESS,
      "1000.00": "100",
      "50.00": "5",
      "3": "3",
      "99.90": "99.9",
      ...overrides,
    };
    for (const [placeholder, value] of Object.entries(entries)) {
      const input = await screen.findByPlaceholderText(placeholder);
      if (value) await user.type(input, value);
    }
  }

  it("shows address-format errors next to the fields and builds nothing", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user, { "C...": "CNOTAREALTOKEN", "G...": "nobody" });
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText(/Not a valid token contract ID/)).toBeInTheDocument();
    expect(screen.getByText(/Not a valid Stellar address/)).toBeInTheDocument();
    expect(getTokenDecimals).not.toHaveBeenCalled();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("does not default a blank uptime target to zero", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user, { "99.90": "" });
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText("Enter an uptime target, for example 99.90.")).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("rejects an uptime target above 100%", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillValid(user, { "99.90": "150" });
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText("The target cannot be more than 100%.")).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("explains a token that has more decimals than the amount allows, on the amount field", async () => {
    vi.mocked(getTokenDecimals).mockResolvedValue(0);
    vi.mocked(getTokenSymbol).mockResolvedValue("PTS");
    const user = userEvent.setup();
    renderForm();
    await fillValid(user, { "1000.00": "10.5" });
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText("This token has no decimal places. Use a whole number.")).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("reports an unreadable token on the token field, not as a generic failure", async () => {
    vi.mocked(getTokenDecimals).mockRejectedValue(new Error("simulation failed"));
    vi.mocked(getTokenSymbol).mockRejectedValue(new Error("simulation failed"));
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    expect(await screen.findByText(/Could not read decimals\(\) and symbol\(\)/)).toBeInTheDocument();
    expect(buildCreateSlaTx).not.toHaveBeenCalled();
  });

  it("marks invalid fields for assistive technology and links their errors", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(await screen.findByRole("button", { name: "Create SLA" }));

    const token = await screen.findByPlaceholderText("C...");
    expect(token).toHaveAttribute("aria-invalid", "true");
    const describedBy = token.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toMatch(/-error/);
    expect(document.getElementById(describedBy.split(" ").find((id) => id.endsWith("-error"))!)).toHaveTextContent(
      "Enter the token contract ID.",
    );
  });

  it("disables the button and prevents a duplicate submit while the token is being checked", async () => {
    let resolveDecimals: (value: number) => void = () => {};
    vi.mocked(getTokenDecimals).mockImplementation(() => new Promise((resolve) => (resolveDecimals = resolve)));
    vi.mocked(getTokenSymbol).mockResolvedValue("USDC");
    vi.mocked(buildCreateSlaTx).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create SLA" }));

    const button = await screen.findByRole("button", { name: "Checking token…" });
    expect(button).toBeDisabled();
    expect(getTokenDecimals).toHaveBeenCalledTimes(1);
    resolveDecimals(7);
    await waitFor(() => expect(buildCreateSlaTx).toHaveBeenCalledTimes(1));
  });
});
