# How It Works

SLASettle replaces manual claim adjudication and disputed logs with autonomous smart contract settlement on Stellar Soroban.

## End-to-End System Flow

```text
+------------------+         Locks Bond          +-------------------------+
| Service Provider | --------------------------> |        sla_vault        |
+------------------+     create_sla(..., bond)   +-------------------------+
                                                              ^
                                                              | Cross-contract read:
                                                              | get_round_tally(sla_id, round_id)
                                                              v
+------------------+     HTTP Health Probe       +-------------------------+
|  Watcher Nodes   | --------------------------> |    watcher_registry     |
| (Independent Set)|     submit_check(..., vote) +-------------------------+
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
- **State**: Tracks registered watcher addresses and raw tallies (`votes_up`, `votes_down`) for each `(sla_id, round_id)` pair.
- **Responsibilities**:
  - Validates caller authorization: Only registered watchers can submit checks.
  - Enforces duplicate prevention: Exactly one check per watcher per round.
  - Implements contract pause controls for emergency operations.
- **Design Boundary**: The registry has no knowledge of quorum requirements, token transfers, or penalty amounts; it is strictly an attestation and vote tallying engine.

### 2. `sla_vault` (Soroban Smart Contract)
- **Role**: Manages SLA configurations, escrows token collateral, and executes payouts.
- **State**: Stores SLA parameters (`provider`, `token`, `bond_amount`, `uptime_target_bps`, `quorum_threshold`, `penalty_per_breach`, `beneficiary`, `status`), current bond balances, and settlement records per round.
- **Responsibilities**:
  - Escrows tokens upon SLA creation via Stellar Asset Contract (SAC) transfers.
  - Accepts bond top-ups from the provider.
  - Performs cross-contract reads to `watcher_registry.get_round_tally`.
  - Determines if `votes_down >= quorum_threshold`.
  - Executes immediate token transfers to the beneficiary when quorum is satisfied.
  - Enforces strict two-step cancellation (`cancel_sla` followed by `withdraw_remaining_bond`).

### 3. Watcher Daemon (Go Autonomous Node)
- **Role**: Off-chain monitoring agent run by watcher operators.
- **Operation**:
  - Queries `watcher_registry.has_watcher_voted(sla_id, round_id, watcher_address)` to avoid duplicate transactions.
  - Conducts HTTP GET/HEAD health checks against the provider's target endpoint within a configured timeout window.
  - Evaluates status code, latency, and response body against SLA criteria.
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
  - `apps/web` provides an intuitive user interface for providers to create and top up SLAs, watchers to register and inspect rounds, and beneficiaries to monitor live uptime and trigger settlements via Freighter browser wallet.

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
