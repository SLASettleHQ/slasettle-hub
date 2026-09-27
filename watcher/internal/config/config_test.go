package config

import (
	"strings"
	"testing"
)

func lookupFrom(m map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) {
		v, ok := m[k]
		return v, ok
	}
}

func TestLoadWithAllRequiredValuesSucceeds(t *testing.T) {
	cfg, err := Load(lookupFrom(map[string]string{
		"WATCHER_REGISTRY_CONTRACT_ID": "CREGISTRY",
		"WATCHER_SECRET_KEY":           "SSECRET",
		"TARGET_URL":                   "https://example.com/health",
		"SLA_ID":                       "7",
	}))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cfg.SLAID != 7 {
		t.Errorf("expected SLAID 7, got %d", cfg.SLAID)
	}
	if cfg.RoundLengthSeconds != 60 {
		t.Errorf("expected default RoundLengthSeconds 60, got %d", cfg.RoundLengthSeconds)
	}
}

func TestLoadReportsAllMissingRequiredValuesAtOnce(t *testing.T) {
	_, err := Load(lookupFrom(map[string]string{}))
	if err == nil {
		t.Fatal("expected an error for missing required config")
	}
	for _, want := range []string{"WATCHER_REGISTRY_CONTRACT_ID", "WATCHER_SECRET_KEY", "TARGET_URL", "SLA_ID"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("expected error to mention %s, got: %v", want, err)
		}
	}
}

func TestLoadRejectsNonNumericSLAID(t *testing.T) {
	_, err := Load(lookupFrom(map[string]string{
		"WATCHER_REGISTRY_CONTRACT_ID": "CREGISTRY",
		"WATCHER_SECRET_KEY":           "SSECRET",
		"TARGET_URL":                   "https://example.com/health",
		"SLA_ID":                       "not-a-number",
	}))
	if err == nil || !strings.Contains(err.Error(), "SLA_ID") {
		t.Fatalf("expected an SLA_ID error, got %v", err)
	}
}

func TestLoadRejectsZeroOrNegativeRoundLength(t *testing.T) {
	base := map[string]string{
		"WATCHER_REGISTRY_CONTRACT_ID": "CREGISTRY",
		"WATCHER_SECRET_KEY":           "SSECRET",
		"TARGET_URL":                   "https://example.com/health",
		"SLA_ID":                       "1",
	}

	for _, bad := range []string{"0", "-5", "not-a-number"} {
		m := map[string]string{}
		for k, v := range base {
			m[k] = v
		}
		m["ROUND_LENGTH_SECONDS"] = bad
		_, err := Load(lookupFrom(m))
		if err == nil {
			t.Errorf("expected an error for ROUND_LENGTH_SECONDS=%q", bad)
		}
	}
}

func TestLoadUsesDefaultsWhenOptionalValuesOmitted(t *testing.T) {
	cfg, err := Load(lookupFrom(map[string]string{
		"WATCHER_REGISTRY_CONTRACT_ID": "CREGISTRY",
		"WATCHER_SECRET_KEY":           "SSECRET",
		"TARGET_URL":                   "https://example.com/health",
		"SLA_ID":                       "1",
	}))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cfg.RPCURL != "https://soroban-testnet.stellar.org" {
		t.Errorf("expected default RPCURL, got %s", cfg.RPCURL)
	}
	if cfg.HTTPExpectMaxStatus != 400 {
		t.Errorf("expected default HTTPExpectMaxStatus 400, got %d", cfg.HTTPExpectMaxStatus)
	}
}
