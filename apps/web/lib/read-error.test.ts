import { InvalidSdkConfigError, MissingSdkConfigError, SorobanSimulationError } from "@slasettle/sdk";
import { describe, expect, it } from "vitest";
import { IndexerApiError, IndexerResponseError, IndexerUnavailableError } from "./indexer";
import { describeReadError } from "./read-error";

describe("describeReadError", () => {
  it("names configuration problems", () => {
    expect(describeReadError(new MissingSdkConfigError(["NEXT_PUBLIC_SOROBAN_RPC_URL"]))).toMatch(
      /not configured correctly.*NEXT_PUBLIC_SOROBAN_RPC_URL/,
    );
    expect(describeReadError(new InvalidSdkConfigError(["bad URL."]))).toMatch(/not configured correctly/);
  });

  it("separates a contract rejection from an RPC outage", () => {
    expect(describeReadError(new SorobanSimulationError("C1", "get_sla", "SLA not found"))).toBe(
      "The contract rejected the read: SLA not found",
    );
    expect(describeReadError(new Error("Network Error"))).toBe("Soroban RPC request failed: Network Error");
  });

  it("says plainly that an SLA does not exist instead of dumping the host error", () => {
    const raw = 'HostError: Error(Contract, #9) Event log (newest first): 0: [Diagnostic Event] topics:[error, Error(Contract, #9)]';
    expect(describeReadError(new SorobanSimulationError("C1", "get_sla", raw))).toBe(
      "No SLA with this ID exists on this network (the contract reported SlaNotFound).",
    );
    // Other methods, and other contract errors, keep the raw message.
    expect(describeReadError(new SorobanSimulationError("C1", "get_bond_balance", raw))).toMatch(/HostError/);
    expect(describeReadError(new SorobanSimulationError("C1", "get_sla", "Error(Contract, #3)"))).toMatch(
      /#3/,
    );
  });

  it("separates indexer unavailable, bad status and malformed body", () => {
    expect(describeReadError(new IndexerUnavailableError("/v1/clock", "fetch failed"))).toBe(
      "The indexer could not be reached for /v1/clock: fetch failed",
    );
    expect(describeReadError(new IndexerApiError("/v1/clock", 500, "Internal Server Error"))).toMatch(/500/);
    expect(describeReadError(new IndexerResponseError("/v1/clock", "bad body"))).toMatch(/unexpected response/);
  });

  it("describes an unexpected contract shape", () => {
    expect(describeReadError(new TypeError("get_sla field is number"))).toMatch(/does not recognize/);
  });

  it("never returns an empty or generic-only message for a non-Error", () => {
    expect(describeReadError("boom")).toMatch(/unknown reason/);
  });
});
