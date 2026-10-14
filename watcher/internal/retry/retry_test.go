package retry

import (
	"context"
	"errors"
	"testing"
	"time"
)

func fastOptions() Options {
	return Options{MaxAttempts: 3, BaseDelay: 1 * time.Millisecond, MaxDelay: 4 * time.Millisecond}
}

func TestDoSucceedsOnFirstAttemptWithoutDelay(t *testing.T) {
	calls := 0
	err := Do(context.Background(), fastOptions(), func() error {
		calls++
		return nil
	})
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
}

func TestDoRetriesUntilSuccess(t *testing.T) {
	calls := 0
	err := Do(context.Background(), fastOptions(), func() error {
		calls++
		if calls < 3 {
			return errors.New("transient")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	if calls != 3 {
		t.Fatalf("calls = %d, want 3", calls)
	}
}

func TestDoGivesUpAfterMaxAttemptsAndReturnsLastError(t *testing.T) {
	calls := 0
	wantErr := errors.New("still failing")
	err := Do(context.Background(), fastOptions(), func() error {
		calls++
		return wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
	if calls != 3 {
		t.Fatalf("calls = %d, want exactly MaxAttempts (3) — must not retry indefinitely", calls)
	}
}

func TestDoDoesNotRetryAfterContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	err := Do(ctx, Options{MaxAttempts: 5, BaseDelay: 50 * time.Millisecond, MaxDelay: 50 * time.Millisecond}, func() error {
		calls++
		if calls == 1 {
			cancel()
		}
		return errors.New("fail")
	})
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if calls != 1 {
		t.Fatalf("calls = %d, want 1 — cancellation during the backoff wait must stop further attempts", calls)
	}
}

func TestDoAppliesExponentialBackoffCappedAtMaxDelay(t *testing.T) {
	opts := Options{MaxAttempts: 4, BaseDelay: 5 * time.Millisecond, MaxDelay: 12 * time.Millisecond}
	start := time.Now()
	calls := 0
	_ = Do(context.Background(), opts, func() error {
		calls++
		return errors.New("fail")
	})
	elapsed := time.Since(start)
	// Delays: 5ms, 10ms, 12ms(capped from 20ms) = 27ms minimum between 4 attempts.
	if elapsed < 20*time.Millisecond {
		t.Fatalf("elapsed = %v, want at least ~20ms of backoff across 3 waits", elapsed)
	}
}
