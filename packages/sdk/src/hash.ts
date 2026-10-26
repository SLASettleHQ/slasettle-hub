import { sha256 } from "@noble/hashes/sha2.js";
import { InvalidSdkInputError } from "./validate.js";

/**
 * Fixed domain-separation prefix for the endpoint commitment preimage.
 * Mirrors SLASettle-contract-spec.md section 3 exactly — do not change this
 * without updating that spec and every other language's implementation
 * (the Go watcher in particular).
 */
const ENDPOINT_HASH_DOMAIN_PREFIX = "slasettle:endpoint:v1:";

/**
 * ASCII whitespace characters trimmed by {@link trimEndpointInput}: space,
 * tab, LF, CR, form feed, vertical tab. Deliberately not `\s` (which also
 * matches Unicode whitespace) so this behaves identically across engines
 * and matches the Go implementation's byte-for-byte trim.
 */
const ASCII_WHITESPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g;

/**
 * Trims only leading/trailing ASCII whitespace from `endpoint`. This is the
 * ONLY normalization ever applied to the committed string — it intentionally
 * does not lowercase, canonicalize, or otherwise rewrite the URL. Named
 * `trimEndpointInput` rather than `normalizeEndpointInput` so callers don't
 * mistake this for full URL canonicalization.
 */
export function trimEndpointInput(endpoint: string): string {
  return endpoint.replace(ASCII_WHITESPACE, "");
}

/**
 * Validates that `endpoint` (expected to already be trimmed) is an absolute
 * http:// or https:// URL. Used for validation only — the exact string
 * passed in is what gets hashed, never a canonicalized version of it.
 * Throws {@link InvalidSdkInputError} if invalid.
 */
export function validateEndpointUrl(endpoint: string, field = "endpoint"): void {
  if (endpoint.length === 0) {
    throw new InvalidSdkInputError(field, "must not be empty after trimming whitespace.");
  }
  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    throw new InvalidSdkInputError(field, "must begin with http:// or https://.");
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new InvalidSdkInputError(field, "is not a valid absolute URL.");
  }
  if (url.host.length === 0) {
    throw new InvalidSdkInputError(field, "must include a host.");
  }
}

/**
 * Computes the endpoint commitment hash: ASCII-trims `endpoint`, validates
 * it's an absolute http(s) URL, then returns
 * `SHA-256("slasettle:endpoint:v1:" + trimmedEndpoint)` as 32 bytes.
 *
 * The exact trimmed string is hashed — never a canonicalized form of it, so
 * `https://api.example.com/health` and `https://api.example.com/health/`
 * produce different commitments.
 */
export function computeEndpointHash(endpoint: string, field = "endpoint"): Uint8Array {
  const trimmed = trimEndpointInput(endpoint);
  validateEndpointUrl(trimmed, field);
  const preimage = new TextEncoder().encode(ENDPOINT_HASH_DOMAIN_PREFIX + trimmed);
  return sha256(preimage);
}
