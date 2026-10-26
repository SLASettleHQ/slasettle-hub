// Package retry provides a small bounded-retry helper with exponential
// backoff. It is intentionally generic about what counts as "retryable" —
// callers are expected to only pass it functions whose error already means
// "this specific call failed at the RPC/network transport layer," never a
// deterministic application-level outcome. See internal/contract, which
// wraps only the direct rpcclient calls (LoadAccount, SimulateTransaction,
// SendTransaction, PollTransaction) this way — a contract error returned
// inside a successful RPC response (e.g. simulation.Error, a rejected
// submission, DuplicateCheck/InvalidRound/NotAWatcher/ContractPaused) is
// never routed through this package, because retrying those would just
// reproduce the same deterministic rejection.
package retry

import (
	"context"
	"time"
)

// Options controls the bounded-retry schedule.
type Options struct {
	// MaxAttempts is the total number of calls to fn, including the first —
	// so MaxAttempts-1 retries happen after an initial failure.
	MaxAttempts int
	// BaseDelay is the wait before the first retry; it doubles after each
	// subsequent failed attempt, capped at MaxDelay.
	BaseDelay time.Duration
	MaxDelay  time.Duration
}

// DefaultOptions returns a modest retry schedule: 3 total attempts, with
// backoff starting at 150ms and capped at 600ms — enough to ride out a
// brief transport blip without materially slowing down a round that's
// genuinely failing for a non-transient reason.
func DefaultOptions() Options {
	return Options{MaxAttempts: 3, BaseDelay: 150 * time.Millisecond, MaxDelay: 600 * time.Millisecond}
}

// Do calls fn up to opts.MaxAttempts times, waiting with exponential backoff
// between attempts, until it succeeds (returns a nil error) or attempts run
// out. Returns the last error if every attempt failed. Stops early and
// returns ctx.Err() if ctx is cancelled while waiting between attempts.
func Do(ctx context.Context, opts Options, fn func() error) error {
	if opts.MaxAttempts < 1 {
		opts.MaxAttempts = 1
	}

	var lastErr error
	delay := opts.BaseDelay
	for attempt := 1; attempt <= opts.MaxAttempts; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		if attempt == opts.MaxAttempts {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		delay *= 2
		if delay > opts.MaxDelay {
			delay = opts.MaxDelay
		}
	}
	return lastErr
}
