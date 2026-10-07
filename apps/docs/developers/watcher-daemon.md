# Watcher Daemon Architecture

The SLASettle Watcher Daemon is an autonomous Go service designed to monitor external service endpoints and submit cryptographic health checks to Stellar Soroban.

- **Source Location**: `services/watcher`
- **Language**: Go 1.22+ (verified on Go 1.25.1)
- **Scope**: Single-process daemon scoped to monitor a designated agreement (`SLA_ID`).

## Package Structure

```text
services/watcher/
├── cmd/
│   └── watcher/
│       └── main.go       # Daemon entrypoint and lifecycle loop
├── internal/
│   ├── config/           # Environment variable ingestion and validation
│   ├── contract/         # Soroban RPC client and transaction signer
│   ├── health/           # HTTP probing client and response evaluators
│   └── round/            # Epoch round computation and synchronization
├── go.mod
└── go.sum
```

---

## Operational Execution Loop

The daemon operates in an continuous ticker loop:

```go
ticker := time.NewTicker(time.Duration(cfg.ProbeIntervalSeconds) * time.Second)
defer ticker.Stop()

for range ticker.C {
    roundID := round.CalculateCurrentRound(time.Now(), cfg.RoundLengthSeconds)

    // 1. Skip if already submitted
    voted, err := contractClient.HasWatcherVoted(ctx, cfg.SlaID, roundID, watcherAddr)
    if err != nil || voted {
        continue
    }

    // 2. Execute health check
    status := health.Probe(cfg.TargetURL, cfg.ProbeTimeoutSeconds, cfg.ExpectedStatusMax)

    // 3. Compute endpoint hash (SHA-256)
    endpointHash := sha256.Sum256([]byte(cfg.TargetURL))

    // 4. Submit signed check transaction
    txHash, err := contractClient.SubmitCheck(ctx, watcherKey, cfg.SlaID, roundID, endpointHash, status)
    if err != nil {
        log.Printf("Failed to submit check for round %d: %v", roundID, err)
    } else {
        log.Printf("Submitted check for round %d: tx %s", roundID, txHash)
    }
}
```

---

## Compilation & Execution

```bash
cd services/watcher

# Run unit test suites
go test ./...

# Compile binary
go build -o watcher-daemon ./cmd/watcher

# Run with environment variables
export WATCHER_REGISTRY_CONTRACT_ID="CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF"
export WATCHER_SECRET_KEY="S..."
export TARGET_URL="https://api.example.com/health"
export SLA_ID=2
export RPC_URL="https://soroban-testnet.stellar.org"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

./watcher-daemon
```

---

## Production Deployment with Systemd

Create `/etc/systemd/system/slasettle-watcher.service`:

```ini
[Unit]
Description=SLASettle Watcher Node Daemon
After=network.target

[Service]
Type=simple
User=watcher
WorkingDirectory=/opt/slasettle/watcher
EnvironmentFile=/etc/slasettle/watcher.env
ExecStart=/opt/slasettle/watcher/watcher-daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now slasettle-watcher
```
