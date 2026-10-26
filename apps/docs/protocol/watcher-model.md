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
- **Authoritative Round Source**: The watcher daemon calls `watcher_registry.get_current_round()` before every submission and uses that value as `round_id`. The contract derives this from the ledger's own close-time timestamp, not any off-chain clock — `submit_check` validates `round_id` against that same authoritative value (with a grace window accepting the current or immediately previous round), so reading it directly means the daemon's round always matches what the contract will accept, including right at a round boundary.
- **Local Clock Role**: The daemon's local wall clock is used only for scheduling/pacing between rounds (deciding when to wake up and probe next). It never determines which `round_id` gets submitted.
- **Standard Round Duration**: Testnet configurations typically use a 60-second or 300-second round window.

## Health Probing Pipeline

The Go watcher daemon (`watcher/`) executes an autonomous pipeline each round:

```text
[Round Timer Fires]
        |
        v
[Read Authoritative Round] ---> watcher_registry.get_current_round()
        |
        v
[Duplicate Check Query] ---> has_watcher_voted(sla_id, round_id, watcher)
        |                    (If true, skip round to conserve gas/fees)
        v (If false)
[Read SLA's Committed Endpoint Hash] ---> sla_vault.get_sla(sla_id).endpoint_hash
        |
        v
[Compare Against Locally Configured Endpoint's Commitment]
        |  - If it does not match, skip this round entirely — do not probe,
        |    do not submit. A watcher gets exactly one submission per
        |    (sla_id, round_id) regardless of endpoint hash, so submitting
        |    under a mismatched commitment would burn that round's vote on
        |    a tally the SLA will never settle against.
        v (If it matches)
[Execute HTTP Health Probe]
        |  - Target URL comes from this watcher's own TARGET_URL configuration
        |  - Configurable timeout (default: 5000ms)
        |  - Validate HTTP 2xx status code
        v
[Determine Attestation Status]
        |  - If 2xx and response within timeout -> CheckStatus::Up
        |  - If timeout, connection error, or non-2xx -> CheckStatus::Down
        v
[Sign & Submit Transaction]
        |  - submit_check(watcher, sla_id, round_id, endpoint_hash, status)
        v
[Stellar Network Confirmation]
```

## Endpoint Commitment

The endpoint commitment is computed identically across the TypeScript SDK, Web, and the Go watcher:

```text
endpoint_hash = SHA-256("slasettle:endpoint:v1:" + ASCII_TRIM(endpoint))
```

- **ASCII trim only**: leading/trailing ASCII whitespace (space, tab, LF, CR, form feed, vertical tab) is stripped. This is the *only* normalization ever applied — the trimmed string is hashed exactly as given, never canonicalized, lowercased, or otherwise rewritten. `https://api.example.com/health` and `https://api.example.com/health/` are deliberately different commitments.
- This is **not** a plain `SHA-256(endpoint URL)` — the fixed domain-separation prefix `slasettle:endpoint:v1:` is part of the preimage in every implementation and must never be dropped from any one of them without updating all the others together.

### What the commitment does and does not prove

The endpoint commitment proves which endpoint commitment a given vote belongs to — i.e., that this watcher's submission is tied to the same `endpoint_hash` as the SLA being evaluated, and that tallies for different endpoints are never mixed. **It does not prove the watcher honestly made the HTTP request.** A watcher could, in principle, submit a vote without ever probing the endpoint; the commitment binds *which* endpoint a vote is about, not that the probe actually happened or was performed faithfully.

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
- `round_id`: Current monitoring round, read from `get_current_round()`.
- `endpoint_hash`: 32-byte endpoint commitment (see above). Tallies are partitioned per `(sla_id, round_id, endpoint_hash)` — a vote submitted under the wrong endpoint hash never contributes to the SLA's real settlement tally.
- `status`: Attestation enum (`CheckStatus::Up` or `CheckStatus::Down`).

### Validation Rules
- **Contract Active**: Rejects with `Error::ContractPaused` if the registry is paused.
- **Authorization**: Rejects with `Error::NotAWatcher` if `watcher` is not present in persistent storage.
- **Round Freshness**: Rejects with `Error::InvalidRound` if `round_id` is neither the current round nor the one immediately before it.
- **Single Vote Enforcement (one-vote invariant)**: Rejects with `Error::DuplicateCheck` if this watcher has already submitted a check for `(sla_id, round_id)` — **regardless of which `endpoint_hash` was used**. One watcher gets exactly one vote per `(sla_id, round_id)`, not one vote per endpoint hash.

## Operational Topology & Redundancy

For production reliability, watcher nodes should be deployed with geographical and infrastructure diversity:
- Distributed across multiple cloud providers (AWS, GCP, Azure) and independent bare-metal servers.
- Spanning multiple geographical regions (North America, Europe, Asia-Pacific) to mitigate regional routing or transit provider outages.
- Running autonomous monitoring loops with local SQLite/in-memory state persistence to prevent duplicate transaction submissions upon daemon restarts.
