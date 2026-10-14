package endpoint

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

// referenceHashHex independently computes the preimage/digest the same way
// ComputeEndpointHash should, but without calling it — a second computation
// path within Go, so the main test isn't just checking the function against
// itself.
func referenceHashHex(trimmedEndpoint string) string {
	sum := sha256.Sum256([]byte("slasettle:endpoint:v1:" + trimmedEndpoint))
	return hex.EncodeToString(sum[:])
}

func TestTrimEndpointInput(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{"leading and trailing whitespace", " \t https://api.example.com/health \n ", "https://api.example.com/health"},
		{"already trimmed", "https://api.example.com/health", "https://api.example.com/health"},
		{"internal whitespace preserved", "https://api.example.com/a b", "https://api.example.com/a b"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := TrimEndpointInput(c.in); got != c.want {
				t.Errorf("TrimEndpointInput(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestValidateEndpointURL(t *testing.T) {
	valid := []string{
		"https://api.example.com/health",
		"http://api.example.com/health",
		"https://api.example.com:8443/health",
	}
	for _, v := range valid {
		if err := ValidateEndpointURL(v); err != nil {
			t.Errorf("ValidateEndpointURL(%q) returned error: %v", v, err)
		}
	}

	invalid := []string{"", "/health", "ftp://api.example.com/health", "not a url"}
	for _, v := range invalid {
		if err := ValidateEndpointURL(v); err == nil {
			t.Errorf("ValidateEndpointURL(%q) expected an error, got nil", v)
		}
	}
}

// TestComputeEndpointHashCrossLanguageVectors uses the same vectors as
// packages/sdk/src/hash.test.ts. Expected digests below were computed via
// Node's crypto.createHash("sha256") against the identical preimage
// ("slasettle:endpoint:v1:" + trimmedEndpoint) in the course of implementing
// the TypeScript side (see hash.test.ts), and are cross-checked again here
// against Go's independent sha256 computation via referenceHashHex.
func TestComputeEndpointHashCrossLanguageVectors(t *testing.T) {
	vectors := map[string]struct {
		endpoint string
		wantHex  string
	}{
		"simple":        {"https://api.example.com/health", "4ad453d9bea4f9b4ec85cac92948d113961dcd379e29afa049c456018a5170cb"},
		"trailingSlash": {"https://api.example.com/health/", "ed461c790d6060b4b07f2d601c8bd568a2258288d932e5c7130f12ebc460e12d"},
		"withQuery":     {"https://api.example.com/health?service=web&region=us-east", "1a381af81c0f35b795a6c91abf167be5c2b06aa17cff0730da9043031c7faf9e"},
		"explicitPort":  {"https://api.example.com:8443/health", "55c5c3f6de16c8d33b6757f4fac696e68a27b9a12ee92a0c5c30429a0ce1853d"},
	}

	for name, v := range vectors {
		t.Run(name, func(t *testing.T) {
			// Sanity: the hardcoded vector matches Go's own independent
			// sha256 computation of the same preimage.
			if ref := referenceHashHex(v.endpoint); ref != v.wantHex {
				t.Fatalf("test vector %q is wrong: referenceHashHex = %s, want %s", name, ref, v.wantHex)
			}

			got, err := ComputeEndpointHash(v.endpoint)
			if err != nil {
				t.Fatalf("ComputeEndpointHash(%q) returned error: %v", v.endpoint, err)
			}
			if gotHex := hex.EncodeToString(got[:]); gotHex != v.wantHex {
				t.Errorf("ComputeEndpointHash(%q) = %s, want %s", v.endpoint, gotHex, v.wantHex)
			}
		})
	}

	t.Run("trailing slash changes the digest", func(t *testing.T) {
		a, err := ComputeEndpointHash("https://api.example.com/health")
		if err != nil {
			t.Fatal(err)
		}
		b, err := ComputeEndpointHash("https://api.example.com/health/")
		if err != nil {
			t.Fatal(err)
		}
		if a == b {
			t.Error("expected different digests for URLs with and without a trailing slash")
		}
	})

	t.Run("ASCII whitespace is trimmed before hashing", func(t *testing.T) {
		padded, err := ComputeEndpointHash("  \t https://api.example.com/health \t  ")
		if err != nil {
			t.Fatal(err)
		}
		unpadded, err := ComputeEndpointHash("https://api.example.com/health")
		if err != nil {
			t.Fatal(err)
		}
		if padded != unpadded {
			t.Error("expected padded and unpadded endpoints to hash identically")
		}
	})

	t.Run("invalid endpoint is rejected before hashing", func(t *testing.T) {
		if _, err := ComputeEndpointHash("not-a-url"); err == nil {
			t.Error("expected an error for an invalid endpoint")
		}
	})
}
