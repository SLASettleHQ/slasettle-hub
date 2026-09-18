import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionStatus } from "./transaction-status";

describe("TransactionStatus", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<TransactionStatus state={{ status: "idle" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["building", "Preparing transaction…"],
    ["signing", "Waiting for signature in your wallet…"],
    ["submitting", "Submitting to the network…"],
  ] as const)("shows a pending message for %s", (status, expected) => {
    render(<TransactionStatus state={{ status }} />);
    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });

  it("shows the transaction hash on confirmation", () => {
    const hash = "a".repeat(64);
    render(<TransactionStatus state={{ status: "confirmed", hash }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmed");
    expect(screen.getByRole("status").textContent).toMatch(/aaaaaa…aaaaaa/);
  });

  it("shows the failure message as an alert", () => {
    render(<TransactionStatus state={{ status: "failed", message: "Penalty exceeds bond." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Penalty exceeds bond.");
  });

  it("includes the transaction hash in a failure when one exists", () => {
    render(
      <TransactionStatus
        state={{ status: "failed", message: "Included but failed.", hash: "b".repeat(64) }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/bbbbbb…bbbbbb/);
  });
});
