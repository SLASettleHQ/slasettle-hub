// Command watcher is the independent third-party daemon: it checks a
// target endpoint once per round and submits its vote to watcher_registry.
// Anyone can run their own copy of this against their own watcher address
// registered by the contract's admin — that's the whole point of the
// quorum design (see SLASettle-contract-spec.md).
package main

import (
	"context"
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

func main() {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	client, err := contract.NewClient(cfg.RPCURL, cfg.NetworkPassphrase, cfg.WatcherRegistryID, cfg.WatcherSecretKey)
	if err != nil {
		log.Fatalf("failed to set up contract client: %v", err)
	}

	checker := health.NewChecker(cfg.HTTPTimeout, cfg.HTTPExpectMaxStatus)
	endpointHash := contract.EndpointHash(cfg.TargetURL)

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
	roundID := round.CurrentID(time.Now(), cfg.RoundLengthSeconds)

	alreadyVoted, err := client.HasVoted(ctx, cfg.SLAID, roundID)
	if err != nil {
		log.Printf("round %d: could not check prior vote status, skipping this round: %v", roundID, err)
		return
	}
	if alreadyVoted {
		log.Printf("round %d: already voted, skipping", roundID)
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
