import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  buildTopUpBondTx: vi.fn(),
  buildCancelSlaTx: vi.fn(),
  buildWithdrawBondTx: vi.fn(),
  buildTriggerSettlementTx: vi.fn(),
  getTokenDecimals: vi.fn(),
  getTokenSymbol: vi.fn(),
}));

import { getActiveWallet, isFreighterAvailable } from "@/lib/wallet";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { CancelSlaAction } from "@/components/dashboard/cancel-sla-action";
import { CreateSlaForm } from "@/components/dashboard/create-sla-form";
import { TopUpBondForm } from "@/components/dashboard/top-up-bond-form";
import { WithdrawBondAction } from "@/components/dashboard/withdraw-bond-action";
import { TriggerSettlementAction } from "@/components/status/trigger-settlement-action";

const TESTNET = "Test SDF Network ; September 2015";
const FUTURENET = "Test SDF Future Network ; October 2022";
const MESSAGE =
  "Your wallet is on Futurenet. Switch your wallet to Testnet before submitting transactions.";

function connectWalletOn(networkPassphrase: string | null) {
  vi.mocked(isFreighterAvailable).mockResolvedValue(true);
  vi.mocked(getActiveWallet).mockResolvedValue(
    networkPassphrase === null
      ? null
      : { address: "GPROVIDER", network: "NET", networkPassphrase },
  );
}

const writeActions = [
  ["Create SLA", () => <CreateSlaForm />, "Create SLA"],
  ["Top Up Bond", () => <TopUpBondForm slaId={0n} tokenDecimals={7} tokenSymbol="XLM" />, "Top Up Bond"],
  ["Cancel SLA", () => <CancelSlaAction slaId={0n} />, "Cancel SLA"],
  ["Withdraw Bond", () => <WithdrawBondAction slaId={0n} />, "Withdraw Bond"],
  ["Trigger Settlement", () => <TriggerSettlementAction slaId={0n} roundId={1n} />, "Trigger Settlement"],
] as const;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", TESTNET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("write actions with a wallet on the wrong network", () => {
  it.each(writeActions)("%s is disabled and explains why", async (_name, renderAction, buttonName) => {
    connectWalletOn(FUTURENET);
    render(<WalletProvider>{renderAction()}</WalletProvider>);

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
    expect(screen.getByRole("button", { name: buttonName })).toBeDisabled();
  });
});

describe("write actions with a wallet on the configured network", () => {
  it.each(writeActions)("%s stays available with no warning", async (_name, renderAction, buttonName) => {
    connectWalletOn(TESTNET);
    render(<WalletProvider>{renderAction()}</WalletProvider>);

    const button = await screen.findByRole("button", { name: buttonName });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("with no wallet connected", () => {
  it("keeps the existing connect prompt and shows no network warning", async () => {
    connectWalletOn(null);
    render(
      <WalletProvider>
        <TriggerSettlementAction slaId={0n} roundId={1n} />
      </WalletProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Connect wallet to trigger settlement" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
