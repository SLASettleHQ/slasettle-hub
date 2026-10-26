// Package round computes round IDs by an off-chain convention:
// floor(unix_seconds / roundLengthSeconds). As of v0.2, watcher_registry is
// the authoritative source for round_id — submit_check validates it against
// get_current_round() (current round, or the immediately preceding one) —
// so internal/contract.Client.GetCurrentRound is what the daemon actually
// uses to decide which round_id to submit under. This package's role is
// narrower now: UntilNextRound paces the daemon's sleep/wake cycle against
// its own wall clock, purely for scheduling, never to decide a submission's
// round_id itself. No external dependencies; this package is directly
// testable.
package round

import "time"

// CurrentID returns the round_id for the given moment.
func CurrentID(t time.Time, roundLengthSeconds int) uint64 {
	return uint64(t.Unix()) / uint64(roundLengthSeconds)
}

// StartTime returns when a given round_id began.
func StartTime(id uint64, roundLengthSeconds int) time.Time {
	return time.Unix(int64(id)*int64(roundLengthSeconds), 0).UTC()
}

// UntilNextRound returns how long to wait from `now` until the next round
// boundary. Sleeping this long, rather than a fixed interval, keeps checks
// aligned to round boundaries instead of drifting further from them every
// cycle (a fixed-interval sleep accumulates the check's own execution time
// as drift; this recomputes from the boundary every time instead).
func UntilNextRound(now time.Time, roundLengthSeconds int) time.Duration {
	currentRound := CurrentID(now, roundLengthSeconds)
	nextRoundStart := StartTime(currentRound+1, roundLengthSeconds)
	d := nextRoundStart.Sub(now)
	if d < 0 {
		return 0
	}
	return d
}
