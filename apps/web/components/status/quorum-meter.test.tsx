import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuorumMeter } from "./quorum-meter";

describe("QuorumMeter", () => {
  it("labels quorum as not reached with a text label, not color alone", () => {
    render(<QuorumMeter votesUp={1} votesDown={1} quorumThreshold={3} reached={false} />);
    expect(screen.getByText("Quorum not reached")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(/Down votes required/)).toBeInTheDocument();
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

  it("says Up votes do not count, so they cannot be mistaken for progress", () => {
    render(<QuorumMeter votesUp={5} votesDown={0} quorumThreshold={3} reached={false} />);
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
    expect(screen.getByText(/5 Up votes do not count toward settlement/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("fills the bar in proportion to Down votes and caps it at full", () => {
    const { rerender } = render(
      <QuorumMeter votesUp={0} votesDown={1} quorumThreshold={4} reached={false} />,
    );
    const fill = () => screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill().style.width).toBe("25%");
    rerender(<QuorumMeter votesUp={0} votesDown={9} quorumThreshold={4} reached />);
    expect(fill().style.width).toBe("100%");
  });
});
