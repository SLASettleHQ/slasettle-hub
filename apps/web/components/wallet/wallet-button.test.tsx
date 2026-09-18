import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallet", () => ({
  isFreighterAvailable: vi.fn(),
  getActiveWallet: vi.fn(),
  connectWallet: vi.fn(),
  WalletError: class WalletError extends Error {},
}));

import { connectWallet, getActiveWallet, isFreighterAvailable } from "@/lib/wallet";
import { WalletProvider } from "./wallet-provider";
import { WalletButton } from "./wallet-button";

const isFreighterAvailableMock = vi.mocked(isFreighterAvailable);
const getActiveWalletMock = vi.mocked(getActiveWallet);
const connectWalletMock = vi.mocked(connectWallet);

beforeEach(() => {
  isFreighterAvailableMock.mockReset();
  getActiveWalletMock.mockReset();
  connectWalletMock.mockReset();
});

function renderWalletButton() {
  return render(
    <WalletProvider>
      <WalletButton />
    </WalletProvider>,
  );
}

describe("WalletButton", () => {
  it("prompts to install Freighter when it isn't detected", async () => {
    isFreighterAvailableMock.mockResolvedValue(false);
    renderWalletButton();

    expect(await screen.findByRole("link", { name: "Install Freighter" })).toBeInTheDocument();
  });

  it("shows a Connect Wallet button when Freighter is available but not connected", async () => {
    isFreighterAvailableMock.mockResolvedValue(true);
    getActiveWalletMock.mockResolvedValue(null);
    renderWalletButton();

    expect(await screen.findByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
  });

  it("connects and shows the truncated address on click", async () => {
    isFreighterAvailableMock.mockResolvedValue(true);
    getActiveWalletMock.mockResolvedValue(null);
    connectWalletMock.mockResolvedValue({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV",
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    const user = userEvent.setup();
    renderWalletButton();

    const connectButton = await screen.findByRole("button", { name: "Connect Wallet" });
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /GABC…STUV/ })).toBeInTheDocument();
    });
  });

  it("silently restores a previously authorized connection without prompting", async () => {
    isFreighterAvailableMock.mockResolvedValue(true);
    getActiveWalletMock.mockResolvedValue({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV",
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    renderWalletButton();

    expect(await screen.findByRole("button", { name: /GABC…STUV/ })).toBeInTheDocument();
    expect(connectWalletMock).not.toHaveBeenCalled();
  });
});
