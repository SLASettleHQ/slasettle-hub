# Watcher Operator Guide

Watcher nodes are registered observers whose daemons can independently probe service endpoints and submit signed votes to Stellar Soroban. The current GREEN Testnet committee uses three project-controlled identities.

## Node Requirements

To operate a watcher node reliably:
- **Compute**: 1 vCPU, 1 GB RAM (minimal footprint).
- **Runtime**: Go 1.22+ or Docker.
- **Network**: Stable, unmetered egress connectivity to public internet and Stellar RPC.
- **Stellar Account**: A dedicated keypair with a modest XLM balance on Testnet to pay transaction fees.

## 1. Keypair Generation & Registration

1. Generate a dedicated Stellar keypair for the watcher node using `stellar-cli` or Stellar Laboratory.
2. Fund the public key using Stellar Friendbot.
3. Submit the public address (`G...`) to the SLASettle registry administrator for inclusion via `watcher_registry.register_watcher(admin, watcher_address)`.
4. Verify registration on-chain:
   ```bash
   stellar contract invoke \
     --id CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY \
     --source <ANY_ACCOUNT> \
     --network testnet \
     -- is_watcher --watcher <WATCHER_PUBLIC_KEY>
   ```

## 2. Configuring the Watcher Daemon

The Go watcher daemon is located in `watcher`. Configure the daemon using environment variables or a `.env` file:

```bash
# Network & RPC
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"

# Contract Addresses
WATCHER_REGISTRY_CONTRACT_ID="CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY"
SLA_VAULT_CONTRACT_ID="CA5R7V5IGMYOBRSAMP4R5MWURSNTY6565NSKEEVR6626PLC3VM2A3EZ2"

# Watcher Identity & Signing Key
WATCHER_SECRET_KEY="S..."

# Monitored Agreement Configuration
SLA_ID=2
TARGET_ENDPOINT="https://api.example.com/health"
PROBE_INTERVAL_SECONDS=60
PROBE_TIMEOUT_SECONDS=5
```

## 3. Running the Daemon

Compile and start the daemon:

```bash
cd watcher
go build -o watcher-node cmd/watcher/main.go
./watcher-node
```

### Operational Loop
Each cycle, the daemon:
1. Reads the ledger-derived current round from `watcher_registry`.
2. Queries `has_watcher_voted` on `watcher_registry`. If already voted, it skips to the next cycle.
3. Performs an HTTP GET request to `TARGET_ENDPOINT` with a 5-second timeout.
4. If response is HTTP 200 within timeout $\to$ votes `UP` (1).
5. If timeout, connection failure, or HTTP 5xx $\to$ votes `DOWN` (2).
6. Constructs and signs `submit_check` transaction on Stellar.
7. Submits to Soroban RPC and waits for ledger confirmation.

## 4. Best Practices for High Availability

- **Run as a System Service**: Deploy using `systemd` or Docker with `restart: always`.
- **Alert on Low Balance**: Ensure the watcher account retains at least 5 XLM to cover ongoing transaction submission fees.
- **Log Aggregation**: Monitor stdout logs for network timeouts, RPC rate limits, and confirmed transaction hashes.
