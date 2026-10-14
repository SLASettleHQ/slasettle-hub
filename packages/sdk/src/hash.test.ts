import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InvalidSdkInputError } from "./validate.js";
import { computeEndpointHash, trimEndpointInput, validateEndpointUrl } from "./hash.js";

/**
 * Independently computed via `node:crypto` (not the implementation under
 * test), so these vectors are a real second computation of the preimage
 * `"slasettle:endpoint:v1:" + trimmedEndpoint`, not hand-typed digests.
 */
function referenceHashHex(trimmedEndpoint: string): string {
  return createHash("sha256")
    .update(Buffer.from("slasettle:endpoint:v1:" + trimmedEndpoint, "utf8"))
    .digest("hex");
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

describe("trimEndpointInput", () => {
  it("trims leading and trailing ASCII whitespace only", () => {
    expect(trimEndpointInput(" \t https://api.example.com/health \n ")).toBe(
      "https://api.example.com/health",
    );
  });

  it("does not trim internal whitespace", () => {
    expect(trimEndpointInput("https://api.example.com/a b")).toBe("https://api.example.com/a b");
  });

  it("leaves an already-trimmed string unchanged", () => {
    expect(trimEndpointInput("https://api.example.com/health")).toBe(
      "https://api.example.com/health",
    );
  });
});

describe("validateEndpointUrl", () => {
  it("accepts an absolute https URL", () => {
    expect(() => validateEndpointUrl("https://api.example.com/health")).not.toThrow();
  });

  it("accepts an absolute http URL", () => {
    expect(() => validateEndpointUrl("http://api.example.com/health")).not.toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => validateEndpointUrl("")).toThrow(InvalidSdkInputError);
  });

  it("rejects a relative path", () => {
    expect(() => validateEndpointUrl("/health")).toThrow(InvalidSdkInputError);
  });

  it("rejects a non-http(s) scheme", () => {
    expect(() => validateEndpointUrl("ftp://api.example.com/health")).toThrow(InvalidSdkInputError);
  });

  it("rejects a string that isn't a URL at all", () => {
    expect(() => validateEndpointUrl("not a url")).toThrow(InvalidSdkInputError);
  });
});

describe("computeEndpointHash cross-language test vectors", () => {
  const vectors: Record<string, string> = {
    simple: "https://api.example.com/health",
    trailingSlash: "https://api.example.com/health/",
    withQuery: "https://api.example.com/health?service=web&region=us-east",
    explicitPort: "https://api.example.com:8443/health",
  };

  for (const [name, endpoint] of Object.entries(vectors)) {
    it(`matches the independently computed digest for "${name}"`, () => {
      const expected = referenceHashHex(endpoint);
      expect(toHex(computeEndpointHash(endpoint))).toBe(expected);
    });
  }

  it("trims surrounding ASCII whitespace/tabs before hashing, matching the untrimmed reference digest", () => {
    const padded = "  \t https://api.example.com/health \t  ";
    const expected = referenceHashHex("https://api.example.com/health");
    expect(toHex(computeEndpointHash(padded))).toBe(expected);
  });

  it("produces different digests for a URL with and without a trailing slash", () => {
    const withoutSlash = computeEndpointHash("https://api.example.com/health");
    const withSlash = computeEndpointHash("https://api.example.com/health/");
    expect(toHex(withoutSlash)).not.toBe(toHex(withSlash));
  });

  it("returns 32 bytes", () => {
    expect(computeEndpointHash("https://api.example.com/health")).toHaveLength(32);
  });

  it("rejects an invalid endpoint before hashing", () => {
    expect(() => computeEndpointHash("not-a-url")).toThrow(InvalidSdkInputError);
  });
});
