# SLA Lifecycle

SLASettle enforces a deterministic, state-machine-driven lifecycle for all service level agreements.

## State Transitions

The core agreement status is defined by the `SLAStatus` enum in `sla_vault`:

```rust
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum SLAStatus {
    Active,
    Cancelled,
}
```

```text
       +-------------------------------------------------------------+
       |                                                             |
       |  Provider calls create_sla()                                |
       |  - Escrows initial bond                                     |
       |  - Configures quorum, penalty, and beneficiary              |
       v                                                             |
+--------------+                                                     |
|    Active    | <------------------------------------+              |
+--------------+                                      |              |
       |                                              |              |
       |  Per-Round Monitoring:                       |              |
       |  - Watchers probe endpoint                   |              |
       |  - submit_check(UP/DOWN)                     | Top Up Bond: |
       |                                              | provider adds|
       |  If votes_down >= quorum_threshold:          | funds        |
       |  - trigger_settlement()                      |              |
       |  - Penalty paid to beneficiary               |              |
       |  - Bond balance decremented                  |              |
       |                                              |              |
       +----------------------------------------------+              |
       |                                                             |
       | Provider calls cancel_sla()                                 |
       v                                                             |
+--------------+                                                     |
|  Cancelled   |                                                     |
+--------------+                                                     |
       |                                                             |
       | Provider calls withdraw_remaining_bond()                    |
       v                                                             |
+--------------------------+                                         |
| Collateral Returned to   |                                         |
| Provider Wallet (Closed) |                                         |
+--------------------------+                                         |
```

## Detailed Lifecycle Steps

### 1. Agreement Creation (`create_sla`)
- **Caller**: Service Provider (`provider.require_auth()`).
- **Endpoint**: `create_sla` requires `endpoint_hash: BytesN<32>`, which is stored in `SLAConfig` and used to select the SLA's watcher tally.
- **Collateral Transfer**: Transfers `bond_amount` of `token` from provider to `sla_vault` via the Stellar Asset Contract interface.
- **Initialization**: Assigns a monotonic `sla_id` (from instance key `NextSlaId`), sets initial bond balance, stores SLA parameters in persistent storage, and assigns status `Active`.
- **Event**: Emits `SlaCreated`; topic fields are `sla_id` and `provider`. Data fields include `endpoint_hash`, `uptime_target_bps`, and `quorum_threshold` along with the token, bond, penalty, and beneficiary values.

### 2. Round Health Attestation
- Rounds are derived from the ledger timestamp using a fixed 60-second interval: `round_id = ledger.timestamp() / 60`. The schedule is not provider-configurable. The contract accepts the current round and the immediately preceding round as a grace window.
- Registered watchers independently execute HTTP health checks against the committed endpoint.
- Watchers call `watcher_registry.submit_check(watcher, sla_id, round_id, endpoint_hash, status)`.
- The registry increments `votes_up` or `votes_down` in the tally keyed by `(sla_id, round_id, endpoint_hash)` and records the check at `DataKey::Check(sla_id, round_id, watcher)`. That uniqueness key prevents a watcher from submitting again under another endpoint hash for the same SLA round.
- The commitment partitions tallies but does not prove that a watcher made an HTTP request or reported honestly.

### 3. Settlement Execution (`trigger_settlement`)
- When downtime occurs and `votes_down >= quorum_threshold`:
- Any caller (beneficiary, keeper, or public observer) invokes `sla_vault.trigger_settlement(caller, sla_id, round_id)`.
- **Validation Pipeline**:
  1. Verifies agreement is `Active` (`SlaNotActive` if cancelled).
  2. Checks idempotency: confirms the round has not already been settled (`AlreadySettled`).
  3. Queries `watcher_registry.get_round_tally(sla_id, round_id, config.endpoint_hash)`.
  4. Verifies `tally.votes_down >= config.quorum_threshold` (`QuorumNotMet` if false).
  5. Determines payout: `payout = min(config.penalty_per_breach, current_bond_balance)`. If balance is 0, rejects with `BondExhausted`.
  6. Executes transfer from vault to `beneficiary`.
  7. Decrements bond balance and marks `DataKey::SettledRounds(sla_id, round_id) = true`.
  8. Emits `SettlementPaid { sla_id, round_id, payout, beneficiary }`.

### 4. Bond Top-Up (`top_up_bond`)
- As penalties deplete the escrow, the original provider can replenish collateral by calling `top_up_bond(caller, sla_id, amount)`.
- The vault transfers tokens into escrow and extends persistent storage TTLs.
- Emits `BondToppedUp { sla_id, amount }`.

### 5. Agreement Cancellation (`cancel_sla`)
- To conclude service or decommission an agreement, the provider calls `cancel_sla(caller, sla_id)`.
- Sets status to `Cancelled`.
- **Irreversibility**: Cancellation is one-way. An SLA cannot be un-cancelled.
- Emits `SlaCancelled { sla_id }`.

### 6. Bond Withdrawal (`withdraw_remaining_bond`)
- Once cancelled, the provider calls `withdraw_remaining_bond(caller, sla_id)`.
- The contract confirms the SLA is `Cancelled`, ensures remaining balance is positive, transfers all remaining tokens to the provider, sets the balance to 0, and emits `BondWithdrawn`.
- Escrow funds cannot be quietly drained while the SLA remains active.
