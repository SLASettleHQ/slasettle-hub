import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import Home from "./page";

describe("Landing page", () => {
  it("states the mechanism plainly in the hero", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        name: /Back an uptime promise with funds a contract actually holds\./,
      }),
    ).toBeInTheDocument();
  });

  it("ships no example watchers, hashes, balances or settlement rows", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Example (data|walkthrough)/);
    expect(text).not.toMatch(/USDC|GABC\d|explorer\/testnet\/tx\/example/);
    expect(text).not.toMatch(/\d+ of \d+ checked in/);
    expect(screen.queryByRole("link", { name: /explorer/i })).not.toBeInTheDocument();
  });

  it("explains the flow from bond to permissionless settlement using real contract calls", () => {
    render(<Home />);
    for (const call of [
      "sla_vault.create_sla",
      "watcher_registry.submit_check",
      "sla_vault.trigger_settlement",
    ]) {
      expect(screen.getByText(call)).toBeInTheDocument();
    }
    expect(screen.getByText(/any wallet can trigger settlement/i)).toBeInTheDocument();
  });

  it("states the v1 limitations", () => {
    render(<Home />);
    expect(screen.getByText(/does not calculate monthly uptime|do not calculate monthly uptime/i)).toBeInTheDocument();
    expect(screen.getByText(/one watcher set/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot\s+choose watchers/i)).toBeInTheDocument();
  });

  it("links to the provider dashboard and the public status lookup", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Open provider dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: "View status" })).toBeInTheDocument();
  });

  it("navigates to the status page for a valid numeric SLA ID", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByPlaceholderText("SLA ID, e.g. 42"), "42");
    await user.click(screen.getByRole("button", { name: "View status" }));

    expect(push).toHaveBeenCalledWith("/status/42");
  });

  it("rejects a non-numeric SLA ID instead of navigating", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.type(screen.getByPlaceholderText("SLA ID, e.g. 42"), "not-a-number");
    await user.click(screen.getByRole("button", { name: "View status" }));

    expect(await screen.findByText("Enter a numeric SLA ID, e.g. 42.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
