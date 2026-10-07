# Economic Model

All value accounting in SLASettle smart contracts is handled using exact 128-bit signed integers (`i128`) denominated in the token's smallest divisible unit. For Stellar Lumens (XLM) via the Stellar Asset Contract (SAC), amounts are denominated in stroops:

$$1\text{ XLM} = 10{,}000{,}000\text{ stroops}$$

The contracts execute zero floating-point operations, preventing rounding drift or precision loss.

## Agreement Parameters

When invoking `create_sla`, the service provider configures four economic parameters:

```rust
pub fn create_sla(
    env: Env,
    provider: Address,
    token: Address,
    bond_amount: i128,
    uptime_target_bps: u32,
    quorum_threshold: u32,
    penalty_per_breach: i128,
    beneficiary: Address,
) -> Result<u64, Error>
```

1. **`bond_amount` (`i128`)**:
   - Total initial collateral escrowed by the provider.
   - Must be strictly positive (`bond_amount > 0`).
   - Transferred from provider to the `sla_vault` contract during agreement creation.
2. **`penalty_per_breach` (`i128`)**:
   - Fixed compensation transferred to the beneficiary for each settled downtime round.
   - Must satisfy `0 < penalty_per_breach <= bond_amount`. (Rejects `InvalidAmount` if penalty exceeds bond).
3. **`quorum_threshold` (`u32`)**:
   - Number of verified `DOWN` checks required to trigger settlement.
   - Must be strictly positive (`quorum_threshold > 0`).
4. **`uptime_target_bps` (`u32`)**:
   - Contractually recorded target in basis points (e.g., `9990` represents 99.90%).
   - Stored on-chain for verification and UI presentation. Settlement evaluation occurs per round.

## Settlement Payout Mechanics

When `trigger_settlement` is executed for a round that meets quorum:

```rust
let balance_key = DataKey::BondBalance(sla_id);
let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);

let payout = if config.penalty_per_breach < balance {
    config.penalty_per_breach
} else {
    balance
};

if payout <= 0 {
    return Err(Error::BondExhausted);
}

token_client.transfer(&env.current_contract_address(), &config.beneficiary, &payout);
env.storage().persistent().set(&balance_key, &(balance - payout));
```

### Full vs. Partial Settlements
- **Standard Settlement**: If `current_balance >= penalty_per_breach`, the contract transfers exactly `penalty_per_breach` to the beneficiary.
- **Partial Settlement (Exhaustion)**: If multiple breaches have depleted the bond such that $0 < \text{current\_balance} < \text{penalty\_per\_breach}$, the contract transfers all remaining funds (`balance`) to the beneficiary.
- **Depleted Bond**: If `current_balance == 0`, settlement fails with `Error::BondExhausted`. The provider must top up the bond to restore settlement coverage.

## Live Testnet Evidence

### Current Testnet SLA #2 (Verified Live 2026-10-07)
During the Phase 7 live verification on the Protocol 28 Testnet deployment:
- **Contract**: `sla_vault` (`CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`)
- **Initial Bond**: `10,000,000` stroops (1.0 XLM)
- **Penalty Per Breach**: `1,000,000` stroops (0.1 XLM)
- **Quorum Threshold**: `3` watchers
- **Top-Up Executed**: `5,000,000` stroops (0.5 XLM) via Freighter, increasing balance to `15,000,000` stroops.
- **Cancellation & Withdrawal**: SLA #2 was cancelled and all `15,000,000` stroops were returned to the provider's wallet.

## Collateral Management

### Topping Up Collateral
- Function: `top_up_bond(caller, sla_id, amount)`
- Authorization: Restricted strictly to the original `provider` (`config.provider == caller`).
- Timing: Can be called at any time to maintain sufficient coverage against future breaches.
- Invariance: Can top up any valid SLA.

### Reclaiming Collateral
- Function: `cancel_sla(caller, sla_id)` followed by `withdraw_remaining_bond(caller, sla_id)`
- Authorization: Restricted strictly to the original `provider`.
- Security Control: Providers cannot withdraw collateral while an SLA is `Active`. The agreement must first transition to `Cancelled`, signaling to the beneficiary and watchers that the agreement is concluded.
- Zero-Balance Protection: If remaining balance is zero, `withdraw_remaining_bond` rejects with `Error::InvalidAmount`.

## Protocol Fee Policy
- **Zero Protocol Tax**: Neither `sla_vault` nor `watcher_registry` levies protocol fees, transaction taxes, or admin cuts.
- 100% of escrowed collateral is disbursed either to the beneficiary (as penalties) or returned to the provider (upon withdrawal).
