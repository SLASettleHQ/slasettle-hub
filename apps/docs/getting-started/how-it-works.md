# How It Works

SLASettle provides deterministic, permissionless smart contract settlement on Stellar Soroban. Settlement is not automatically scheduled; a party must submit `trigger_settlement` after quorum is reached.

## End-to-End System Flow

```text
+------------------+         Locks Bond          +-------------------------+
| Service Provider | --------------------------> |        sla_vault        |
+------------------+ create_sla(..., endpoint_hash, bond) +---------------+
                                                              ^
                                                              | Cross-contract read:
                                                              | get_round_tally(sla_id, round_id, endpoint_hash)
                                                              v
+------------------+     HTTP Health Probe       +-------------------------+
|  Watcher Nodes   | --------------------------> |    watcher_registry     |
| (Registered Set)  |     submit_check(..., vote) +-------------------------+
+------------------+
         |
         | Downtime Detected & Quorum Reached (votes_down >= quorum_threshold)
         v
+------------------+   trigger_settlement(...)   +-------------------------+
| Anyone / Keeper  | --------------------------> |        sla_vault        |
+------------------+      (Permissionless)       +-------------------------+
                                                              |
                                                              | Payout penalty
                                                              v
                                                 +-------------------------+
                                                 |       Beneficiary       |
                                                 |     (Direct Transfer)   |
                                                 +-------------------------+
```

## The Five Core Components

### 1. `watcher_registry` (Soroban Smart Contract)
- **Role**: Maintains watcher authorization and collects per-round health attestations.
- **State**: Tracks registered watcher addresses, checks, and raw tallies (`votes_up`, `votes_down`) for each `(sla_id, round_id, endpoint_hash)` tuple.
- **Responsibilities**:
  - Validates caller authorization: Only registered watchers can submit checks.
  - Enforces duplicate prevention: One check per watcher per SLA round, regardless of the endpoint hash submitted.
  - Accepts only the ledger-derived current round or the immediately preceding round. Rounds have a fixed 60-second schedule.
  - Implements contract pause controls for emergency operations.
- **Design Boundary**: The registry has no knowledge of quorum requirements, token transfers, or penalty amounts; it is strictly an attestation and vote tallying engine.

### 2. `sla_vault` (Soroban Smart Contract)
- **Role**: Manages SLA configurations, escrows token collateral, and executes payouts.
- **State**: Stores the provider, token, endpoint commitment, bond, descriptive uptime target, quorum, fixed per-round penalty, beneficiary, status, bond balance, and settled-round records.
- **Responsibilities**:
  - Escrows tokens upon SLA creation via Stellar Asset Contract (SAC) transfers.
  - Accepts bond top-ups from the provider.
  - Reads `watcher_registry.get_watcher_count` when validating SLA creation and `get_round_tally(sla_id, round_id, endpoint_hash)` when settling.
  - Determines if `votes_down >= quorum_threshold`.
  - Executes immediate token transfers to the beneficiary when quorum is satisfied.
  - Enforces strict two-step cancellation (`cancel_sla` followed by `withdraw_remaining_bond`).

### 3. Watcher Daemon (Go Autonomous Node)
- **Role**: Off-chain monitoring agent run by watcher operators.
- **Operation**:
  - Queries `watcher_registry.has_watcher_voted(sla_id, round_id, watcher_address)` to avoid duplicate transactions.
  - Makes one HTTP GET request per check. `HTTP_TIMEOUT_SECONDS` bounds the request (10 seconds by default).
  - Classifies a response as `Up` when its status code is below `HTTP_EXPECT_MAX_STATUS` (400 by default); a status at or above the configured threshold is `Down`.
  - Classifies timeouts and other request failures as `Down`. It does not inspect response-body content or use response latency as a classification input.
  - Signs and broadcasts `submit_check(watcher, sla_id, round_id, endpoint_hash, status)` on Stellar Testnet using its registered Stellar keypair.

### 4. Indexer Service (Cloudflare Workers / Serverless)
- **Role**: Off-chain event ingestion and fast query cache.
- **Operation**:
  - Polls Soroban RPC for events emitted by `watcher_registry` and `sla_vault` (`SlaCreated`, `BondToppedUp`, `CheckSubmitted`, `SettlementPaid`, `SlaCancelled`, `BondWithdrawn`).
  - Stores structured event records in D1 / SQLite database.
  - Exposes RESTful endpoints for SLA status, round history, watcher activity, and settlement logs.
  - Serves as a read optimization layer; it never writes to contracts or holds signing keys.

### 5. SDK & Web Console (TypeScript / Next.js)
- **Role**: Developer library and human operator interface.
- **Operation**:
  - `@slasettle/sdk` abstracts XDR encoding, simulation, contract invocation, and RPC interaction.
  - `apps/web` lets providers create and top up SLAs, registered watchers inspect rounds, and beneficiaries monitor status and trigger settlements via Freighter.
  - Watcher registration is an administrator-authorized `watcher_registry.register_watcher` contract operation. The Web console has no registration workflow, and watchers cannot self-register.

## Permissionless Settlement Execution

Settlement execution is intentionally **permissionless**:

```rust
pub fn trigger_settlement(
    env: Env,
    caller: Address,
    sla_id: u64,
    round_id: u64
) -> Result<(), Error>
```

- The `caller` parameter is not authenticated with `caller.require_auth()`.
- Anyone (the beneficiary, an automated keeper bot, a watcher, or any third party) can invoke `trigger_settlement`.
- Settlement criteria are strictly evaluated on-chain:
  1. The SLA must be in `Active` status.
  2. The round must not have been previously settled (`is_round_settled == false`).
  3. `votes_down` retrieved from the registry must be greater than or equal to `quorum_threshold`.
  4. The bond balance must be greater than zero.
- If all conditions pass, `min(penalty_per_breach, remaining_bond)` is transferred directly from the vault to the beneficiary.

The Web application requires a service endpoint and commits its 32-byte endpoint hash when creating an SLA. The raw URL is not stored on-chain. Endpoint commitments isolate tally counts but do not prove honest HTTP observations. The `uptime_target_bps` field is descriptive; it does not calculate monthly aggregate uptime. Contract rounds are fixed at 60 seconds.
