import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderSlaFailure, ProviderSlaView } from "@/lib/use-provider-slas";

const wallet = vi.hoisted(() => ({
  current: {
    status: "disconnected" as string,
    connection: null as null | { address: string; network: string; networkPassphrase: string },
    error: null,
    connect: () => {},
    disconnect: () => {},
  },
}));
const slasState = vi.hoisted(() => ({
  current: {
    slas: [] as unknown[],
    failures: [] as unknown[],
    loading: false,
    error: null as string | null,
    refresh: () => {},
  },
}));

vi.mock("@/components/wallet/wallet-provider", () => ({ useWallet: () => wallet.current }));
vi.mock("@/lib/use-provider-slas", () => ({ useProviderSlas: () => slasState.current }));
vi.mock("./create-sla-form", () => ({ CreateSlaForm: () => <div>create form</div> }));
vi.mock("./sla-card", () => ({
  SlaCard: ({ sla }: { sla: ProviderSlaView }) => <div>card for SLA #{sla.slaId.toString()}</div>,
}));

import { DashboardView } from "./dashboard-view";

const CONNECTION = { address: "GPROVIDER", network: "TESTNET", networkPassphrase: "Test SDF Network ; September 2015" };

function sla(id: bigint): ProviderSlaView {
  return {
    slaId: id,
    config: {} as ProviderSlaView["config"],
    bondBalance: 1n,
    tokenDecimals: 7,
    tokenSymbol: "USDC",
  };
}

function connect(overrides: Partial<typeof slasState.current> = {}) {
  wallet.current = { ...wallet.current, status: "connected", connection: CONNECTION };
  slasState.current = { ...slasState.current, slas: [], failures: [], loading: false, error: null, ...overrides };
}

beforeEach(() => {
  wallet.current = { ...wallet.current, status: "disconnected", connection: null };
  slasState.current = { slas: [], failures: [], loading: false, error: null, refresh: () => {} };
});

describe("DashboardView wallet states", () => {
  it("asks a disconnected visitor to connect and shows no SLA data", () => {
    render(<DashboardView />);
    expect(screen.getByText("Connect your wallet to create and manage your SLAs.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
    expect(screen.queryByText("create form")).not.toBeInTheDocument();
  });

  it("says Freighter is missing, with no connect button, when it is not installed", () => {
    wallet.current = { ...wallet.current, status: "unavailable" };
    render(<DashboardView />);
    expect(screen.getByText(/Freighter isn't installed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).not.toBeInTheDocument();
  });

  it("shows a status message while the wallet is being detected", () => {
    wallet.current = { ...wallet.current, status: "checking" };
    render(<DashboardView />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking wallet connection");
  });
});

describe("DashboardView provider SLAs", () => {
  it("shows a loading state, not an empty one, while SLAs load", () => {
    connect({ loading: true });
    render(<DashboardView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your SLAs");
    expect(screen.queryByText("No SLAs yet")).not.toBeInTheDocument();
  });

  it("shows an empty state, which is not an error, for a provider with no SLAs", () => {
    connect();
    render(<DashboardView />);
    expect(screen.getByText("No SLAs yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lists the provider's real SLAs", () => {
    connect({ slas: [sla(0n), sla(3n)] });
    render(<DashboardView />);
    expect(screen.getByText("card for SLA #0")).toBeInTheDocument();
    expect(screen.getByText("card for SLA #3")).toBeInTheDocument();
    expect(screen.queryByText("No SLAs yet")).not.toBeInTheDocument();
  });

  it("reports an unavailable indexer as an error, never as an empty list", () => {
    connect({ error: "The indexer could not be reached. fetch failed" });
    render(<DashboardView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your SLAs could not be listed");
    expect(screen.getByRole("alert")).toHaveTextContent("The indexer could not be reached.");
    expect(screen.queryByText("No SLAs yet")).not.toBeInTheDocument();
  });

  it("keeps the previous list visible when a refresh fails", () => {
    connect({ slas: [sla(0n)], error: "The indexer could not be reached." });
    render(<DashboardView />);
    expect(screen.getByText("card for SLA #0")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh your SLAs");
  });

  it("names an SLA that could not be read while still showing the others", () => {
    const failures: ProviderSlaFailure[] = [{ slaId: 5n, message: "Soroban RPC request failed: timeout" }];
    connect({ slas: [sla(0n)], failures });
    render(<DashboardView />);
    expect(screen.getByText("card for SLA #0")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("SLA #5: Soroban RPC request failed: timeout");
  });
});
