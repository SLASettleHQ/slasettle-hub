import { computeEndpointHash } from "@slasettle/sdk";
import { describe, expect, it } from "vitest";
import { endpointHashToHex, verifyEndpointCommitment } from "./endpoint-commitment";

describe("endpoint commitment display and comparison", () => {
  it("renders exactly 32 bytes as unprefixed lowercase hex", () => {
    expect(endpointHashToHex(Uint8Array.from({ length: 32 }, (_, index) => index + 1))).toBe(
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
    );
  });

  it("rejects a value that is not 32 bytes", () => {
    expect(() => endpointHashToHex(new Uint8Array(31))).toThrow(/32 bytes/);
  });

  it("uses the SDK algorithm when comparing endpoint commitments", () => {
    const endpoint = "https://example.com/health";
    const expectedHash = computeEndpointHash(endpoint);
    expect(verifyEndpointCommitment(` \t${endpoint}\n`, expectedHash).matches).toBe(true);
    expect(verifyEndpointCommitment(`${endpoint}/`, expectedHash).matches).toBe(false);
  });
});
