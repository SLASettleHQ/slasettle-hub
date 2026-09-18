import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WatcherGrid } from "./watcher-grid";

const WATCHERS = [
  { address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1", status: "up" as const },
  { address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2", status: "down" as const },
  { address: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC3", status: "pending" as const },
];

describe("WatcherGrid", () => {
  it("counts only checked-in watchers, not pending ones, in the header", () => {
    render(<WatcherGrid watchers={WATCHERS} />);
    expect(screen.getByText("2 of 3 watchers checked in")).toBeInTheDocument();
  });

  it("renders each watcher's status as a text label, not color alone", () => {
    render(<WatcherGrid watchers={WATCHERS} />);
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders zero of N when no one has checked in", () => {
    render(
      <WatcherGrid
        watchers={[{ address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1", status: "pending" }]}
      />,
    );
    expect(screen.getByText("0 of 1 watchers checked in")).toBeInTheDocument();
  });
});
