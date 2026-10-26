package main

import (
	"errors"
	"testing"
)

func TestCheckEndpointCommitmentAllowsAMatchingHash(t *testing.T) {
	var hash [32]byte
	for i := range hash {
		hash[i] = byte(i)
	}
	if err := checkEndpointCommitment(hash, hash); err != nil {
		t.Fatalf("expected no error for matching hashes, got %v", err)
	}
}

func TestCheckEndpointCommitmentBlocksAMismatchedHash(t *testing.T) {
	var committed, configured [32]byte
	configured[0] = 1 // differs from the all-zero committed hash

	err := checkEndpointCommitment(committed, configured)
	if !errors.Is(err, errEndpointCommitmentMismatch) {
		t.Fatalf("err = %v, want errEndpointCommitmentMismatch", err)
	}
}
