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

  it("labels the product preview as example data, not live state", () => {
    render(<Home />);
    expect(screen.getByText(/Example data — not a live SLA/)).toBeInTheDocument();
  });

  it("labels the protocol flow walkthrough as an example, not live network data", () => {
    render(<Home />);
    expect(screen.getByText(/Example walkthrough — not live network data/)).toBeInTheDocument();
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
