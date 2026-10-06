import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Networks } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettlementList } from "./settlement-list";
import type { Settlement } from "./settlement-row";

const SETTLEMENT: Settlement = {
  round: 118n,
  votesUp: 1,
  votesDown: 4,
  quorumThreshold: 3,
  penaltyAmount: 50_000_0000000n,
  tokenDecimals: 7,
  tokenSymbol: "USDC",
  transactionHash: "c".repeat(64),
};

const EXPLORER_URL = "https://stellar.expert/explorer/testnet/tx/" + "c".repeat(64);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", Networks.TESTNET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SettlementList", () => {
  it("shows a real empty state, not a fabricated entry", () => {
    render(<SettlementList settlements={[]} />);
    expect(
      screen.getByText("No settlements yet"),
    ).toBeInTheDocument();
  });

  it("renders a settlement's round, tally, penalty, and explorer link", () => {
    render(<SettlementList settlements={[SETTLEMENT]} />);
    expect(screen.getByText("Round 118")).toBeInTheDocument();
    expect(screen.getByText(/1 up · 4 down · quorum 3/)).toBeInTheDocument();
    expect(screen.getByText("50,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on explorer" })).toHaveAttribute(
      "href",
      EXPLORER_URL,
    );
  });

  it("builds the explorer link for the configured network, not from the indexer", () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", Networks.PUBLIC);
    render(<SettlementList settlements={[SETTLEMENT]} />);
    expect(screen.getByRole("link", { name: "View on explorer" })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/public/tx/" + "c".repeat(64),
    );
  });

  it("omits the explorer link when the network has no explorer or the hash is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", Networks.STANDALONE);
    const { rerender } = render(<SettlementList settlements={[SETTLEMENT]} />);
    expect(screen.queryByRole("link", { name: "View on explorer" })).not.toBeInTheDocument();

    vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", Networks.TESTNET);
    rerender(<SettlementList settlements={[{ ...SETTLEMENT, transactionHash: "../evil" }]} />);
    expect(screen.queryByRole("link", { name: "View on explorer" })).not.toBeInTheDocument();
  });

  it("shows a Load more button only when more pages exist, and calls onLoadMore", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(<SettlementList settlements={[SETTLEMENT]} hasMore onLoadMore={onLoadMore} />);

    const button = screen.getByRole("button", { name: "Load more" });
    await user.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not show Load more when there is no next page", () => {
    render(<SettlementList settlements={[SETTLEMENT]} hasMore={false} />);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
