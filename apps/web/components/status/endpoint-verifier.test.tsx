import { computeEndpointHash } from "@slasettle/sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointVerifier } from "./endpoint-verifier";

const ENDPOINT = "https://example.com/health";
const COMMITMENT = computeEndpointHash(ENDPOINT);

describe("EndpointVerifier", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  async function compare(endpoint: string) {
    const user = userEvent.setup();
    render(<EndpointVerifier endpointHash={COMMITMENT} />);
    const input = screen.getByLabelText("Verify an endpoint");
    fireEvent.change(input, { target: { value: endpoint } });
    await user.click(screen.getByRole("button", { name: "Compare commitment" }));
  }

  it("reports MATCH for the committed endpoint", async () => {
    await compare(ENDPOINT);
    expect(screen.getByRole("status")).toHaveTextContent("MATCH");
    expect(screen.getByText(/confirms that this endpoint string produces/)).toBeInTheDocument();
  });

  it("reports DOES NOT MATCH for a different endpoint", async () => {
    await compare("https://different.example.com/health");
    expect(screen.getByRole("status")).toHaveTextContent("DOES NOT MATCH");
  });

  it("treats a trailing slash as a different endpoint", async () => {
    await compare(`${ENDPOINT}/`);
    expect(screen.getByRole("status")).toHaveTextContent("DOES NOT MATCH");
  });

  it("ASCII-trims verifier input", async () => {
    await compare(` \t${ENDPOINT}\r\n `);
    expect(screen.getByRole("status")).toHaveTextContent("MATCH");
  });

  it("shows a plain validation error for an invalid URL", async () => {
    await compare("/health");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid absolute HTTP or HTTPS URL.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("computes locally without making a request", async () => {
    await compare(ENDPOINT);
    expect(fetch).not.toHaveBeenCalled();
  });
});
