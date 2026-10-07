# Watcher Topology & Node Model

Watcher nodes are the decentralized observers of the SLASettle protocol. They bridge off-chain service health to the on-chain consensus state in `watcher_registry`.

## Node Lifecycle & Authorization

In the current protocol implementation:
1. **Curated Node Committee**: Watcher addresses are authorized on-chain by the registry administrator via `watcher_registry.register_watcher(admin, watcher_address)`.
2. **Identity Verification**: When submitting a check, the transaction must be signed by the watcher account (`watcher.require_auth()`).
3. **De-Registration**: If an operator goes offline or misbehaves, the administrator can revoke authorization via `remove_watcher(admin, watcher_address)`. De-registration decrements `WatcherCount` without affecting tallies of previously finalized rounds.

## Round Synchronization

Rounds define discrete observation windows during which watchers probe target services and submit votes.

- **Round Identification**: Rounds are indexed by a monotonically increasing 64-bit integer (`round_id`).
- **Time Calculation**: The watcher daemon computes the active round based on epoch seconds:
  $$\text{round\_id} = \left\lfloor \frac{\text{unix\_timestamp}}{\text{ROUND\_LENGTH\_SECONDS}} \right\rfloor$$
- **Standard Round Duration**: Testnet configurations typically use a 60-second or 300-second round window.
- **Clock Authority**: The `@slasettle/indexer` service provides a synchronized reference clock via `/v1/clock` to ensure off-chain watchers and frontend status monitors remain aligned.

## Health Probing Pipeline

The Go watcher daemon (`services/watcher`) executes an autonomous pipeline each round:

```text
[Round Timer Fires]
        |
        v
[Duplicate Check Query] ---> has_watcher_voted(sla_id, round_id, watcher)
        |                    (If true, skip round to conserve gas/fees)
        v (If false)
[Execute HTTP Health Probe]
        |  - Target URL from SLA metadata
        |  - Configurable timeout (default: 5000ms)
        |  - Validate HTTP 2xx status code
        v
[Determine Attestation Status]
        |  - If 2xx and response within timeout -> CheckStatus::Up (1)
        |  - If timeout, connection error, or 5xx -> CheckStatus::Down (2)
        v
[Hash Target Endpoint]
        |  - SHA-256 hash of endpoint URL string
        v
[Sign & Submit Transaction]
        |  - submit_check(watcher, sla_id, round_id, endpoint_hash, status)
        v
[Stellar Network Confirmation]
```

## Check Submission Specification

Watchers invoke `submit_check` on the `watcher_registry` contract:

```rust
pub fn submit_check(
    env: Env,
    watcher: Address,
    sla_id: u64,
    round_id: u64,
    endpoint_hash: BytesN<32>,
    status: CheckStatus,
) -> Result<(), Error>
```

### Parameter Reference
- `watcher`: The public address of the submitting watcher node. Must match transaction signer.
- `sla_id`: Identifier of the SLA being evaluated.
- `round_id`: Current monitoring round.
- `endpoint_hash`: 32-byte cryptographic hash of the probed endpoint. Included in invocation data for auditability.
- `status`: Attestation enum (`CheckStatus::Up` or `CheckStatus::Down`).

### Validation Rules
- **Contract Active**: Rejects with `Error::ContractPaused` if the registry is paused.
- **Authorization**: Rejects with `Error::NotAWatcher` if `watcher` is not present in persistent storage.
- **Single Vote Enforcement**: Rejects with `Error::DuplicateCheck` if `DataKey::Check(sla_id, round_id, watcher)` already exists. Watchers cannot vote twice or modify a submitted vote.

## Operational Topology & Redundancy

For production reliability, watcher nodes should be deployed with geographical and infrastructure diversity:
- Distributed across multiple cloud providers (AWS, GCP, Azure) and independent bare-metal servers.
- Spanning multiple geographical regions (North America, Europe, Asia-Pacific) to mitigate regional routing or transit provider outages.
- Running autonomous monitoring loops with local SQLite/in-memory state persistence to prevent duplicate transaction submissions upon daemon restarts.
