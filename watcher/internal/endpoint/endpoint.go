// Package endpoint computes the same endpoint commitment hash as the
// TypeScript SDK (packages/sdk/src/hash.ts) and the frozen contract spec
// (SLASettle-contract-spec.md section 3):
//
//	endpoint_hash = SHA-256("slasettle:endpoint:v1:" + trimmedEndpoint)
//
// trimmedEndpoint is the input with only leading/trailing ASCII whitespace
// removed — no other normalization. net/url is used for VALIDATION only;
// the bytes that get hashed are always the original trimmed string, never
// anything net/url re-serializes, since Go's url.URL.String() can alter the
// input (e.g. escaping) in ways that would silently produce a different
// commitment than the TypeScript SDK's.
package endpoint

import (
	"crypto/sha256"
	"fmt"
	"net/url"
	"strings"
)

// domainPrefix must stay byte-for-byte identical to
// ENDPOINT_HASH_DOMAIN_PREFIX in packages/sdk/src/hash.ts.
const domainPrefix = "slasettle:endpoint:v1:"

// asciiWhitespace are the only characters TrimEndpointInput strips, matching
// the TypeScript implementation's ASCII_WHITESPACE set exactly (space, tab,
// LF, CR, form feed, vertical tab) rather than Go's unicode-aware
// strings.TrimSpace.
const asciiWhitespace = " \t\n\r\f\v"

// TrimEndpointInput trims only leading/trailing ASCII whitespace from
// endpoint. This is the only normalization ever applied to the committed
// string.
func TrimEndpointInput(endpoint string) string {
	return strings.Trim(endpoint, asciiWhitespace)
}

// ValidateEndpointURL checks that endpoint (expected to already be trimmed)
// is an absolute http:// or https:// URL. Used for validation only — it
// never rewrites the string that gets hashed.
func ValidateEndpointURL(endpoint string) error {
	if endpoint == "" {
		return fmt.Errorf("endpoint must not be empty after trimming whitespace")
	}
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		return fmt.Errorf("endpoint must begin with http:// or https://")
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("endpoint is not a valid URL: %w", err)
	}
	if u.Host == "" {
		return fmt.Errorf("endpoint must include a host")
	}
	return nil
}

// ComputeEndpointHash trims endpoint, validates it, then returns
// SHA-256("slasettle:endpoint:v1:" + trimmedEndpoint) as 32 bytes.
func ComputeEndpointHash(rawEndpoint string) ([32]byte, error) {
	trimmed := TrimEndpointInput(rawEndpoint)
	if err := ValidateEndpointURL(trimmed); err != nil {
		return [32]byte{}, err
	}
	return sha256.Sum256([]byte(domainPrefix + trimmed)), nil
}
