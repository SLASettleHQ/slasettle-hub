import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SLAConfig } from "@slasettle/sdk";
import type { PollingState } from "@/lib/use-polling";
import type { RoundStatusView } from "@/lib/use-round-status";

vi.mock("@/components/wallet/wallet-provider", () => ({
  useWallet: () => ({ status: "disconnected", connection: null, error: null, connect: vi.fn(), disconnect: vi.fn() }),
}));

import { RoundPanel } from "./round-panel";

const W1 = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1";
const W2 = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2";

const CONFIG: SLAConfig = {
  provider: "GP",
  token: "CT",
  bondAmount: 1_000_0000000n,
  uptimeTargetBps: 9990,
  quorumThreshold: 2,
  penaltyPerBreach: 50_0000000n,
  beneficiary: "GB",
  status: "Active",
};

function view(overrides: Partial<RoundStatusView> = {}): PollingState<RoundStatusView> {
  return {
    loading: false,
    error: null,
    data: {
      roundId: 100n,
      asOf: "2026-10-01T00:00:00.000Z",
      watchers: {
        status: "ok",
        value: [
          { address: W1, status: "down" },
          { address: W2, status: "pending" },
        ],
      },
      tally: { status: "ok", value: { votesUp: 0, votesDown: 1 } },
      settled: { status: "ok", value: false },
      ...overrides,
    },
  };
}

function renderPanel(round: PollingState<RoundStatusView>, config: SLAConfig = CONFIG) {
  return render(
    <RoundPanel
      slaId={1n}
      config={config}
      tokenDecimals={7}
      tokenSymbol="USDC"
      round={round}
      onSettled={vi.fn()}
    />,
  );
}

const triggerButton = () => screen.queryByRole("button", { name: /trigger settlement|connect wallet to trigger/i });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015");
});

describe("RoundPanel", () => {
  it("shows a loading state before the first result and never a populated panel", () => {
    renderPanel({ data: null, error: null, loading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading the current round");
    expect(screen.queryByText(/Round /)).not.toBeInTheDocument();
  });

  it("shows the ledger-derived round, per-watcher status and the Down tally", () => {
    renderPanel(view());
    expect(screen.getByText("Round 100")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 watchers checked in")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Quorum not reached")).toBeInTheDocument();
  });

  it("does not offer settlement below quorum", () => {
    renderPanel(view());
    expect(triggerButton()).not.toBeInTheDocument();
    expect(screen.getByText(/Quorum has not been reached/)).toBeInTheDocument();
  });

  it("offers settlement at quorum, with the round, tally and penalty shown", () => {
    renderPanel(view({ tally: { status: "ok", value: { votesUp: 0, votesDown: 2 } } }));
    expect(screen.getByText("Quorum reached")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 required")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    // Open to any wallet: the prompt is to connect, not a provider-only restriction.
    expect(triggerButton()).toHaveTextContent("Connect wallet to trigger settlement");
  });

  it("does not offer settlement for an already settled round", () => {
    renderPanel(
      view({
        tally: { status: "ok", value: { votesUp: 0, votesDown: 3 } },
        settled: { status: "ok", value: true },
      }),
    );
    expect(screen.getByText("This round has already been settled.")).toBeInTheDocument();
    expect(triggerButton()).not.toBeInTheDocument();
  });

  it("does not offer settlement for a cancelled SLA", () => {
    renderPanel(view({ tally: { status: "ok", value: { votesUp: 0, votesDown: 3 } } }), {
      ...CONFIG,
      status: "Cancelled",
    });
    expect(screen.getByText(/This SLA is cancelled/)).toBeInTheDocument();
    expect(triggerButton()).not.toBeInTheDocument();
  });

  it("says watcher check-ins are unavailable, not empty, when the indexer is down, and keeps the on-chain tally", () => {
    renderPanel(view({ watchers: { status: "unavailable", message: "The indexer could not be reached." } }));
    expect(screen.getByText("Watcher check-ins unavailable")).toBeInTheDocument();
    expect(screen.getByText("The indexer could not be reached.")).toBeInTheDocument();
    expect(screen.queryByText("No registered watchers")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("distinguishes zero registered watchers from an unavailable watcher list", () => {
    renderPanel(view({ watchers: { status: "ok", value: [] } }));
    expect(screen.getByText("No registered watchers")).toBeInTheDocument();
    expect(screen.queryByText("Watcher check-ins unavailable")).not.toBeInTheDocument();
  });

  it("says plainly that no votes have arrived when every watcher is pending", () => {
    renderPanel(
      view({
        watchers: { status: "ok", value: [{ address: W1, status: "pending" }, { address: W2, status: "pending" }] },
        tally: { status: "ok", value: { votesUp: 0, votesDown: 0 } },
      }),
    );
    expect(screen.getByText("No watcher has voted yet in this round.")).toBeInTheDocument();
  });

  it("shows no quorum and disables settlement when the tally cannot be read, instead of showing zero", () => {
    renderPanel(view({ tally: { status: "unavailable", message: "Soroban RPC request failed: timeout" } }));
    expect(screen.getByText("Vote tally unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Down votes required/)).not.toBeInTheDocument();
    expect(screen.queryByText("0 / 2")).not.toBeInTheDocument();
    expect(triggerButton()).not.toBeInTheDocument();
  });

  it("disables settlement when the settled state cannot be read", () => {
    renderPanel(
      view({
        tally: { status: "ok", value: { votesUp: 0, votesDown: 5 } },
        settled: { status: "unavailable", message: "Soroban RPC request failed: timeout" },
      }),
    );
    expect(screen.getByText("Settled state unavailable")).toBeInTheDocument();
    expect(triggerButton()).not.toBeInTheDocument();
  });

  it("reports an unknown round and does not guess one from the device clock", () => {
    const unavailable = { status: "unavailable" as const, message: "The indexer could not be reached." };
    renderPanel(view({ roundId: null, asOf: null, watchers: unavailable, tally: unavailable, settled: unavailable }));
    expect(screen.getByText("Current round unknown")).toBeInTheDocument();
    expect(screen.queryByText(/^Round \d+/)).not.toBeInTheDocument();
    expect(triggerButton()).not.toBeInTheDocument();
  });

  it("shows an error when the round could not be loaded at all", () => {
    renderPanel({ data: null, error: "boom", loading: false });
    expect(screen.getByRole("alert")).toHaveTextContent("Current round could not be loaded");
  });
});
