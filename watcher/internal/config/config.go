// Package config loads and validates this watcher instance's configuration
// entirely from environment variables. Nothing here depends on
// go-stellar-sdk — this package compiles and tests cleanly with a plain Go
// standard library toolchain, which is exactly why it's kept separate from
// internal/contract.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	RPCURL              string
	NetworkPassphrase   string
	WatcherRegistryID   string
	WatcherSecretKey    string
	SLAID               uint64
	TargetURL           string
	RoundLengthSeconds  int
	HTTPTimeout         time.Duration
	HTTPExpectMaxStatus int // status codes below this count as "up"; see health package
}

// Load reads and validates configuration from the given environment lookup
// function (normally os.LookupEnv — injected here so tests don't have to
// mutate real process environment variables). Fails loudly, with every
// problem listed at once, rather than stopping at the first missing value.
func Load(lookup func(string) (string, bool)) (Config, error) {
	var errs []string
	get := func(key string) string {
		v, _ := lookup(key)
		return v
	}
	require := func(key string) string {
		v, ok := lookup(key)
		if !ok || v == "" {
			errs = append(errs, fmt.Sprintf("%s is required", key))
		}
		return v
	}

	cfg := Config{
		RPCURL:            getOrDefault(lookup, "RPC_URL", "https://soroban-testnet.stellar.org"),
		NetworkPassphrase: getOrDefault(lookup, "NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
		WatcherRegistryID: require("WATCHER_REGISTRY_CONTRACT_ID"),
		WatcherSecretKey:  require("WATCHER_SECRET_KEY"),
		TargetURL:         require("TARGET_URL"),
	}

	slaIDStr := require("SLA_ID")
	if slaIDStr != "" {
		id, err := strconv.ParseUint(slaIDStr, 10, 64)
		if err != nil {
			errs = append(errs, fmt.Sprintf("SLA_ID must be a non-negative integer, got %q", slaIDStr))
		} else {
			cfg.SLAID = id
		}
	}

	cfg.RoundLengthSeconds = 60
	if v := get("ROUND_LENGTH_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			errs = append(errs, fmt.Sprintf("ROUND_LENGTH_SECONDS must be a positive integer, got %q", v))
		} else {
			cfg.RoundLengthSeconds = n
		}
	}

	timeoutSeconds := 10
	if v := get("HTTP_TIMEOUT_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			errs = append(errs, fmt.Sprintf("HTTP_TIMEOUT_SECONDS must be a positive integer, got %q", v))
		} else {
			timeoutSeconds = n
		}
	}
	cfg.HTTPTimeout = time.Duration(timeoutSeconds) * time.Second

	// A response is classified "up" if its status code is below this
	// threshold. 400 means 1xx/2xx/3xx all count as up, matching ordinary
	// browser/uptime-monitor convention — a redirect is not a breach.
	cfg.HTTPExpectMaxStatus = 400
	if v := get("HTTP_EXPECT_MAX_STATUS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			errs = append(errs, fmt.Sprintf("HTTP_EXPECT_MAX_STATUS must be a positive integer, got %q", v))
		} else {
			cfg.HTTPExpectMaxStatus = n
		}
	}

	if len(errs) > 0 {
		msg := "invalid configuration:"
		for _, e := range errs {
			msg += "\n  - " + e
		}
		return Config{}, fmt.Errorf("%s", msg)
	}

	return cfg, nil
}

func getOrDefault(lookup func(string) (string, bool), key, def string) string {
	if v, ok := lookup(key); ok && v != "" {
		return v
	}
	return def
}

// LoadFromEnv is the real entrypoint's convenience wrapper around Load.
func LoadFromEnv() (Config, error) {
	return Load(os.LookupEnv)
}
