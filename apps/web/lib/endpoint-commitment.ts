import { computeEndpointHash } from "@slasettle/sdk";

export function endpointHashToHex(endpointHash: Uint8Array): string {
  if (endpointHash.length !== 32) {
    throw new TypeError("Endpoint commitments must be exactly 32 bytes.");
  }
  return Array.from(endpointHash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function verifyEndpointCommitment(
  endpoint: string,
  expectedHash: Uint8Array,
): { computedHash: Uint8Array; matches: boolean } {
  const computedHash = computeEndpointHash(endpoint, "endpoint");
  return {
    computedHash,
    matches: endpointHashToHex(computedHash) === endpointHashToHex(expectedHash),
  };
}
