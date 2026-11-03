import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProtocolFlow } from "./protocol-flow";

describe("ProtocolFlow responsive layout", () => {
  it("stacks each step when a narrow viewport cannot fit its title and detail side by side", () => {
    render(<ProtocolFlow />);

    const firstStep = screen.getByRole("heading", { name: "Provider creates the SLA" }).closest("li");
    expect(firstStep).toHaveClass("flex-col", "min-[360px]:flex-row", "lg:flex-col");
  });
});
