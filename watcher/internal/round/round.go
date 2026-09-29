// Package round computes round IDs by an off-chain convention:
// floor(unix_seconds / roundLengthSeconds). The contracts do not define it:
// they treat round_id as an opaque u64, never read ledger time, and never
// validate a round_id against time. Every watcher applies this convention to
// its own system clock, which is what lets watchers configured with the same
// round length converge on the same round_id without coordinating. The
// indexer applies the same formula to the latest ledger's close time instead.
// No external dependencies; this package is directly testable.
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
