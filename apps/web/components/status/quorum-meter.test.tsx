import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuorumMeter } from "./quorum-meter";

describe("QuorumMeter", () => {
  it("labels quorum as not reached with a text label, not color alone", () => {
    render(<QuorumMeter votesUp={1} votesDown={1} quorumThreshold={3} reached={false} />);
    expect(screen.getByText("Quorum not reached")).toBeInTheDocument();
    expect(screen.getByText(/1 up · 1 down · quorum requires 3/)).toBeInTheDocument();
  });

  it("labels quorum as reached", () => {
    render(<QuorumMeter votesUp={1} votesDown={4} quorumThreshold={3} reached />);
    expect(screen.getByText("Quorum reached")).toBeInTheDocument();
  });

  it("exposes the down-vote progress via ARIA for assistive tech", () => {
    render(<QuorumMeter votesUp={0} votesDown={2} quorumThreshold={4} reached={false} />);
    const bar = screen.getByRole("progressbar", { name: "Down votes toward quorum" });
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "4");
  });
});
