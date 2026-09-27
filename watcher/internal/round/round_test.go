package round

import (
	"testing"
	"time"
)

func TestCurrentIDMatchesFloorDivision(t *testing.T) {
	// 1700000000 / 60 = 28333333 (integer division)
	tm := time.Unix(1700000000, 0).UTC()
	got := CurrentID(tm, 60)
	want := uint64(1700000000 / 60)
	if got != want {
		t.Errorf("CurrentID = %d, want %d", got, want)
	}
}

func TestCurrentIDIsStableWithinTheSameRound(t *testing.T) {
	roundLength := 60
	base := time.Unix(1700000000-(1700000000%60), 0).UTC() // exact round boundary
	first := CurrentID(base, roundLength)
	almostNextRound := base.Add(59 * time.Second)
	second := CurrentID(almostNextRound, roundLength)
	if first != second {
		t.Errorf("expected the same round_id within one round window, got %d and %d", first, second)
	}
}

func TestCurrentIDAdvancesAcrossARoundBoundary(t *testing.T) {
	roundLength := 60
	base := time.Unix(1700000000-(1700000000%60), 0).UTC()
	first := CurrentID(base, roundLength)
	nextRound := base.Add(60 * time.Second)
	second := CurrentID(nextRound, roundLength)
	if second != first+1 {
		t.Errorf("expected round_id to advance by exactly 1, got %d then %d", first, second)
	}
}

func TestStartTimeAndCurrentIDRoundTrip(t *testing.T) {
	id := uint64(28333333)
	start := StartTime(id, 60)
	got := CurrentID(start, 60)
	if got != id {
		t.Errorf("round-trip failed: StartTime(%d) then CurrentID gave %d", id, got)
	}
}

func TestUntilNextRoundAtExactBoundaryReturnsFullRoundLength(t *testing.T) {
	roundLength := 60
	boundary := time.Unix(1700000000-(1700000000%60), 0).UTC()
	d := UntilNextRound(boundary, roundLength)
	if d != 60*time.Second {
		t.Errorf("expected exactly one round length at a boundary, got %v", d)
	}
}

func TestUntilNextRoundOneSecondBeforeBoundaryIsAboutOneSecond(t *testing.T) {
	roundLength := 60
	boundary := time.Unix(1700000000-(1700000000%60), 0).UTC()
	justBefore := boundary.Add(-1 * time.Second)
	d := UntilNextRound(justBefore, roundLength)
	if d != 1*time.Second {
		t.Errorf("expected 1s until the next round, got %v", d)
	}
}

func TestUntilNextRoundNeverReturnsNegative(t *testing.T) {
	// Exercise several offsets across a round window and confirm the
	// result is always non-negative — the real risk this guards against is
	// an off-by-one in the boundary math producing a negative sleep.
	roundLength := 60
	base := time.Unix(1700000000-(1700000000%60), 0).UTC()
	for offset := 0; offset < 60; offset++ {
		d := UntilNextRound(base.Add(time.Duration(offset)*time.Second), roundLength)
		if d < 0 {
			t.Errorf("offset %ds: got negative duration %v", offset, d)
		}
	}
}
