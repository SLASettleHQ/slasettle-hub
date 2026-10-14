// Command watcher is the independent third-party daemon: it checks a
// target endpoint once per round and submits its vote to watcher_registry.
// Anyone can run their own copy of this against their own watcher address
// registered by the contract's admin — that's the whole point of the
// quorum design (see SLASettle-contract-spec.md).
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/config"
	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/contract"
	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/health"
	"github.com/SLASettleHQ/slasettle-hub/watcher/internal/round"
)

// errEndpointCommitmentMismatch is returned by checkEndpointCommitment when
// this daemon's configured endpoint doesn't match the SLA's on-chain
// commitment. Deliberately doesn't include either hash's bytes in the
// message — see section 14 of the v0.2 integration notes: don't log
// sensitive endpoint data unnecessarily.
var errEndpointCommitmentMismatch = errors.New("configured endpoint does not match the SLA's on-chain commitment")

// checkEndpointCommitment compares this daemon's locally-computed endpoint
// hash against the SLA's on-chain committed hash, read fresh from sla_vault
// immediately before this check. Returns errEndpointCommitmentMismatch on a
// mismatch — the caller must never proceed to a check or a submission in
// that case.
func checkEndpointCommitment(committedHash, configuredHash [32]byte) error {
	if committedHash != configuredHash {
		return errEndpointCommitmentMismatch
	}
	return nil
}

func main() {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	client, err := contract.NewClient(cfg.RPCURL, cfg.NetworkPassphrase, cfg.WatcherRegistryID, cfg.SLAVaultID, cfg.WatcherSecretKey)
	if err != nil {
		log.Fatalf("failed to set up contract client: %v", err)
	}

	checker := health.NewChecker(cfg.HTTPTimeout, cfg.HTTPExpectMaxStatus)
	endpointHash, err := contract.EndpointHash(cfg.TargetURL)
	if err != nil {
		log.Fatalf("invalid TARGET_URL: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Printf("starting watcher for sla_id=%d, target=%s, round_length=%ds", cfg.SLAID, cfg.TargetURL, cfg.RoundLengthSeconds)

	for {
		select {
		case <-ctx.Done():
			log.Println("shutting down")
			return
		default:
		}

		runOneRound(ctx, cfg, client, checker, endpointHash)

		sleepFor := round.UntilNextRound(time.Now(), cfg.RoundLengthSeconds)
		select {
		case <-ctx.Done():
			log.Println("shutting down")
			return
		case <-time.After(sleepFor):
		}
	}
}

func runOneRound(ctx context.Context, cfg config.Config, client *contract.Client, checker *health.Checker, endpointHash [32]byte) {
	// The contract, not the local wall clock, decides which round_id a
	// submission will be accepted under — submit_check validates round_id
	// against watcher_registry.get_current_round() itself, with a grace
	// window for the immediately preceding round. Using that same
	// authoritative value here means this daemon's round_id always matches
	// what the contract will accept, including right at a round boundary.
	roundID, err := client.GetCurrentRound(ctx)
	if err != nil {
		log.Printf("could not read the contract's current round, skipping this round: %v", err)
		return
	}

	alreadyVoted, err := client.HasVoted(ctx, cfg.SLAID, roundID)
	if err != nil {
		log.Printf("round %d: could not check prior vote status, skipping this round: %v", roundID, err)
		return
	}
	if alreadyVoted {
		log.Printf("round %d: already voted, skipping", roundID)
		return
	}

	// Pre-flight: confirm the SLA's on-chain commitment still matches what
	// this daemon is configured to check, before spending anything on an
	// HTTP check or a transaction. A watcher gets exactly one submission per
	// (sla_id, round_id) regardless of endpoint hash, so submitting under a
	// mismatched hash would burn that round's vote on a tally the SLA will
	// never settle against, with no way to repair it for this round.
	committedHash, err := client.GetSlaEndpointHash(ctx, cfg.SLAID)
	if err != nil {
		log.Printf("round %d: could not read the SLA's committed endpoint, skipping this round: %v", roundID, err)
		return
	}
	if err := checkEndpointCommitment(committedHash, endpointHash); err != nil {
		log.Printf("round %d: %v, skipping this round", roundID, err)
		return
	}

	checkCtx, cancel := context.WithTimeout(ctx, cfg.HTTPTimeout+5*time.Second)
	defer cancel()
	result := checker.Check(checkCtx, cfg.TargetURL)

	status := contract.StatusUp
	if result.Status == health.Down {
		status = contract.StatusDown
	}
	log.Printf("round %d: check result status=%s http_code=%d timeout=%v", roundID, status, result.StatusCode, result.Timeout)

	if err := client.SubmitCheck(ctx, cfg.SLAID, roundID, endpointHash, status); err != nil {
		log.Printf("round %d: failed to submit check: %v", roundID, err)
		return
	}
	log.Printf("round %d: submitted check successfully", roundID)
}
