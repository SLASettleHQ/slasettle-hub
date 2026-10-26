# Watcher Daemon Architecture

The SLASettle Watcher Daemon is an autonomous Go service designed to monitor external service endpoints and submit cryptographic health checks to Stellar Soroban.

- **Source Location**: `watcher`
- **Language**: Go 1.22+ (verified on Go 1.25.1)
- **Scope**: Single-process daemon scoped to monitor a designated agreement (`SLA_ID`).

## Package Structure

```text
watcher/
├── cmd/
│   └── watcher/
│       └── main.go       # Daemon entrypoint and lifecycle loop
├── internal/
│   ├── config/           # Environment variable ingestion and validation
│   ├── contract/         # Soroban RPC client, transaction signer, GetCurrentRound/GetSlaEndpointHash reads
│   ├── endpoint/         # Endpoint commitment hashing and validation (matches the TS SDK byte-for-byte)
│   ├── health/           # HTTP probing client and response evaluators
│   ├── retry/            # Bounded retry for transient network errors
│   └── round/            # Local sleep/wake pacing only — never the submitted round_id
├── go.mod
└── go.sum
```

---

## Operational Execution Loop

The daemon runs each round, then sleeps until the next round boundary (via `round.UntilNextRound`, used only for local scheduling/pacing — never to decide a submission's `round_id`):

```go
for {
    // 1. The contract, not the local clock, is authoritative for round_id.
    roundID, err := client.GetCurrentRound(ctx)
    if err != nil {
        continue // retried next cycle
    }

    // 2. Skip if this watcher already voted this round.
    voted, err := client.HasVoted(ctx, cfg.SLAID, roundID)
    if err != nil || voted {
        continue
    }

    // 3. Pre-flight: this watcher's locally configured endpoint must match
    //    the SLA's on-chain commitment before probing or submitting anything.
    committedHash, err := client.GetSlaEndpointHash(ctx, cfg.SLAID)
    if err != nil || committedHash != endpointHash {
        continue // mismatch or read failure: skip this round entirely
    }

    // 4. Execute the health check against this watcher's own TARGET_URL.
    result := checker.Check(ctx, cfg.TargetURL)
    status := statusFrom(result)

    // 5. Submit the signed check transaction, voting under the commitment
    //    computed once at startup (see "Endpoint Commitment" below) —
    //    never a freshly re-hashed or re-derived value.
    client.SubmitCheck(ctx, cfg.SLAID, roundID, endpointHash, status)

    sleepFor := round.UntilNextRound(time.Now(), cfg.RoundLengthSeconds)
    time.Sleep(sleepFor)
}
```

### Endpoint Commitment

The daemon computes its endpoint commitment once at startup from `TARGET_URL`:

```text
endpoint_hash = SHA-256("slasettle:endpoint:v1:" + ASCII_TRIM(TARGET_URL))
```

This is **not** a plain `SHA-256(TARGET_URL)` — the fixed domain-separation prefix `slasettle:endpoint:v1:` is always part of the preimage, matching the TypeScript SDK and Web implementations exactly (see `apps/docs/protocol/watcher-model.md`).

---

## Compilation & Execution

```bash
cd watcher

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
