import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: {
    status: "Active",
    provider: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    beneficiary: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    token: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    penaltyPerBreach: 1_000_000n,
    quorumThreshold: 3,
    uptimeTargetBps: 9_900,
    endpointHash: new Uint8Array(32),
  },
  refresh: vi.fn(),
}));

vi.mock("@/lib/use-sla-config", () => ({
  useSlaConfig: () => ({
    data: { config: state.config, bondBalance: 10_000_000n, tokenDecimals: 7, tokenSymbol: "XLM" },
    loading: false,
    error: null,
    refresh: state.refresh,
  }),
}));
vi.mock("@/lib/use-round-status", () => ({
  useRoundStatus: () => ({ data: null, error: null, loading: false, refresh: vi.fn() }),
}));
vi.mock("@/lib/use-settlement-history", () => ({
  useSettlementHistory: () => ({
    settlements: [],
    nextCursor: null,
    loading: false,
    loadingMore: false,
    error: null,
    reload: vi.fn(),
    loadMore: vi.fn(),
  }),
}));
vi.mock("./endpoint-verifier", () => ({ EndpointVerifier: () => <div>Endpoint verifier</div> }));
vi.mock("./round-panel", () => ({ RoundPanel: () => <div>Round panel</div> }));

import { StatusView } from "./status-view";

describe("StatusView contract behavior copy", () => {
  it("describes the target as metadata and settlement as per-round", () => {
    render(<StatusView slaId={42n} />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bv1\b/i);
    expect(text).toMatch(/uptime target:.*descriptive metadata/i);
    expect(text).toMatch(/do not calculate monthly uptime against it/i);
    expect(text).toMatch(/settlement eligibility is checked per round/i);
    expect(screen.getByText(/shared watcher registry/i)).toBeInTheDocument();
  });
});
