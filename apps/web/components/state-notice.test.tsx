import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, LoadingState, UnavailableState } from "./state-notice";

describe("state notices", () => {
  it("announces loading politely and hides the skeleton from assistive tech", () => {
    const { container } = render(<LoadingState label="Loading settlement history" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading settlement history");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders empty as a plain statement with an optional next action, not an alert", () => {
    render(
      <EmptyState title="No SLAs yet" action={<button type="button">Create SLA</button>}>
        Create one to get started.
      </EmptyState>,
    );
    expect(screen.getByText("No SLAs yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create SLA" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders unavailable as a status with what failed and what still works", () => {
    render(
      <UnavailableState title="Watcher check-ins unavailable" message="The indexer could not be reached.">
        Vote counts are still read from the contract.
      </UnavailableState>,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Watcher check-ins unavailable");
    expect(notice).toHaveTextContent("The indexer could not be reached.");
    expect(notice).toHaveTextContent("Vote counts are still read from the contract.");
  });

  it("renders an actionable failure as an alert", () => {
    render(<UnavailableState tone="error" title="Could not load SLA" message="Not found." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load SLA");
  });
});
