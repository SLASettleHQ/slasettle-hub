# SLA Lifecycle

SLASettle enforces a deterministic, state-machine-driven lifecycle for all service level agreements.

## State Transitions

The core agreement status is defined by the `SLAStatus` enum in `sla_vault`:

```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SLAStatus {
    Active = 1,
    Cancelled = 2,
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
- **Collateral Transfer**: Transfers `bond_amount` of `token` from provider to `sla_vault` via the Stellar Asset Contract interface.
- **Initialization**: Assigns a monotonic `sla_id` (from instance key `NextSlaId`), sets initial bond balance, stores SLA parameters in persistent storage, and assigns status `Active`.
- **Event**: Emits `SlaCreated { sla_id, provider, token, bond_amount, beneficiary }`.

### 2. Round Health Attestation
- Each round (identified by an incremental `round_id`), registered watchers independently execute HTTP health checks against the target endpoint.
- Watchers call `watcher_registry.submit_check(watcher, sla_id, round_id, endpoint_hash, status)`.
- The registry increments `votes_up` or `votes_down` in the round's `RoundTally` record and marks `DataKey::Check(sla_id, round_id, watcher)` to prevent duplicate submissions.

### 3. Settlement Execution (`trigger_settlement`)
- When downtime occurs and `votes_down >= quorum_threshold`:
- Any caller (beneficiary, keeper, or public observer) invokes `sla_vault.trigger_settlement(caller, sla_id, round_id)`.
- **Validation Pipeline**:
  1. Verifies agreement is `Active` (`SlaNotActive` if cancelled).
  2. Checks idempotency: confirms the round has not already been settled (`AlreadySettled`).
  3. Queries `watcher_registry.get_round_tally(sla_id, round_id)`.
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
