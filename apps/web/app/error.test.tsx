import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RouteError from "./error";
import NotFound from "./not-found";

describe("route error page", () => {
  it("announces the failure, offers retry, and states that nothing reached the wallet", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<RouteError error={Object.assign(new Error("boom"), { digest: "abc123" })} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("This page failed to render");
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was sent to your wallet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("not found page", () => {
  it("routes to the SLA lookup and the dashboard", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Look up an SLA" })).toHaveAttribute("href", "/status");
    expect(screen.getByRole("link", { name: "Open dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
