import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SLAConfig } from "@slasettle/sdk";

const TESTNET = "Test SDF Network ; September 2015";

vi.mock("@/components/wallet/wallet-provider", () => ({
  useWallet: () => ({
    status: "connected",
    connection: { address: "GPROVIDER", network: "TESTNET", networkPassphrase: TESTNET },
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));
vi.mock("@/lib/wallet", () => ({
  signTransaction: vi.fn().mockResolvedValue({}),
  submitTransaction: vi.fn().mockResolvedValue({ hash: "a".repeat(64), status: "SUCCESS" }),
  isUserRejection: vi.fn(() => false),
}));
vi.mock("@slasettle/sdk", () => ({
  buildCancelSlaTx: vi.fn().mockResolvedValue({}),
  buildWithdrawBondTx: vi.fn().mockResolvedValue({}),
  buildTopUpBondTx: vi.fn().mockResolvedValue({}),
}));

import { buildCancelSlaTx, buildTopUpBondTx, buildWithdrawBondTx } from "@slasettle/sdk";
import type { ProviderSlaView } from "@/lib/use-provider-slas";
import { SlaCard } from "./sla-card";

const CONFIG: SLAConfig = {
  provider: "GPROVIDER",
  token: "CTOKEN",
  bondAmount: 1000_0000000n,
  uptimeTargetBps: 9990,
  quorumThreshold: 3,
  penaltyPerBreach: 50_0000000n,
  beneficiary: "GBENEFICIARY",
  status: "Active",
};

function sla(overrides: Partial<ProviderSlaView> = {}, config: Partial<SLAConfig> = {}): ProviderSlaView {
  return {
    slaId: 4n,
    config: { ...CONFIG, ...config },
    bondBalance: 800_0000000n,
    tokenDecimals: 7,
    tokenSymbol: "USDC",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
  vi.mocked(buildCancelSlaTx).mockClear();
  vi.mocked(buildWithdrawBondTx).mockClear();
  vi.mocked(buildTopUpBondTx).mockClear();
});

describe("SlaCard actions for an Active SLA", () => {
  it("offers top-up and cancel, and not withdrawal", () => {
    render(<SlaCard sla={sla()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Top Up Bond" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel SLA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it("describes the uptime target as display only, with integer percentage formatting", () => {
    render(<SlaCard sla={sla()} onChanged={vi.fn()} />);
    expect(screen.getByText("Uptime target (display only)")).toBeInTheDocument();
    expect(screen.getByText("99.90%")).toBeInTheDocument();
  });

  it("explains cancellation, including that it does not withdraw the bond, before anything is signed", async () => {
    const user = userEvent.setup();
    render(<SlaCard sla={sla()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));

    expect(screen.getByText(/Cancelling does not withdraw the bond/)).toBeInTheDocument();
    expect(buildCancelSlaTx).not.toHaveBeenCalled();
  });

  it("builds the cancel transaction only after confirmation and refreshes the card when confirmed", async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<SlaCard sla={sla()} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));
    await user.click(screen.getByRole("button", { name: "Sign and cancel" }));

    await waitFor(() => expect(buildCancelSlaTx).toHaveBeenCalledWith({ caller: "GPROVIDER", slaId: 4n }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });
});

describe("SlaCard actions for a Cancelled SLA", () => {
  const cancelled = (overrides: Partial<ProviderSlaView> = {}) => sla(overrides, { status: "Cancelled" });

  it("offers withdrawal and neither top-up nor cancel", () => {
    render(<SlaCard sla={cancelled()} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Withdraw remaining bond" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel SLA" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Top Up Bond" })).not.toBeInTheDocument();
  });

  it("shows the live bond in the confirmation and says cancel and withdraw are separate", async () => {
    const user = userEvent.setup();
    render(<SlaCard sla={cancelled()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Withdraw remaining bond" }));

    const group = screen.getByRole("group", { name: /Withdraw the remaining bond of SLA #4/ });
    expect(group).toHaveTextContent("800");
    expect(group).toHaveTextContent("Cancelling and withdrawing are different operations");
    expect(buildWithdrawBondTx).not.toHaveBeenCalled();
  });

  it("builds the withdrawal transaction after confirmation", async () => {
    const user = userEvent.setup();
    render(<SlaCard sla={cancelled()} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Withdraw remaining bond" }));
    await user.click(screen.getByRole("button", { name: "Sign and withdraw" }));

    await waitFor(() => expect(buildWithdrawBondTx).toHaveBeenCalledWith({ caller: "GPROVIDER", slaId: 4n }));
  });

  it("offers nothing to click when no bond remains, instead of a button that can only fail", () => {
    render(<SlaCard sla={cancelled({ bondBalance: 0n })} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no bond remains, so there is nothing to withdraw/)).toBeInTheDocument();
  });
});

describe("top-up validation", () => {
  async function submitTopUp(amount: string) {
    const user = userEvent.setup();
    render(<SlaCard sla={sla()} onChanged={vi.fn()} />);
    const input = screen.getByLabelText(/Top up amount/);
    if (amount) await user.type(input, amount);
    await user.click(screen.getByRole("button", { name: "Top Up Bond" }));
    return input;
  }

  it("rejects an empty amount next to the field and builds nothing", async () => {
    const input = await submitTopUp("");
    expect(await screen.findByText("Enter the top-up amount.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(buildTopUpBondTx).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "The amount must be greater than zero."],
    ["1.12345678", "This token supports at most 7 decimal places."],
    ["abc", "Use a plain number such as 1000.50."],
  ])("rejects %s", async (amount, message) => {
    await submitTopUp(amount);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(buildTopUpBondTx).not.toHaveBeenCalled();
  });

  it("converts to base units with the token's decimals and submits", async () => {
    await submitTopUp("12.5");
    await waitFor(() =>
      expect(buildTopUpBondTx).toHaveBeenCalledWith({ caller: "GPROVIDER", slaId: 4n, amount: 125_000_000n }),
    );
  });
});
