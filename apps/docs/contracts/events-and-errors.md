# Events & Errors

A comprehensive reference for all contract events emitted to the Stellar ledger and numeric error codes returned by Soroban contract executions.

## Events Reference

Events emitted by SLASettle follow standard Soroban event structures:
- **Topic 0**: Symbol representing the snake_case event name.
- **Additional Topics**: Indexed identifiers for efficient ledger filtering.
- **Data Payload**: Struct or value containing event details.

### `watcher_registry` Events

| Event Name | Topics | Data Payload | Emitted When |
| :--- | :--- | :--- | :--- |
| `watcher_registered` | `[Symbol("watcher_registered"), watcher: Address]` | `()` | Admin authorizes a new watcher address. |
| `watcher_removed` | `[Symbol("watcher_removed"), watcher: Address]` | `()` | Admin removes an authorized watcher. |
| `check_submitted` | `[Symbol("check_submitted"), sla_id: u64, watcher: Address]` | `CheckSubmittedData { round_id: u64, status: CheckStatus }` | Watcher submits a health attestation. |

### `sla_vault` Events

| Event Name | Topics | Data Payload | Emitted When |
| :--- | :--- | :--- | :--- |
| `sla_created` | `[Symbol("sla_created"), sla_id: u64, provider: Address]` | `SlaCreatedData { token: Address, bond_amount: i128, beneficiary: Address }` | Service provider creates agreement and escrows bond. |
| `bond_topped_up` | `[Symbol("bond_topped_up"), sla_id: u64]` | `BondToppedUpData { amount: i128 }` | Provider deposits additional collateral into bond. |
| `settlement_paid` | `[Symbol("settlement_paid"), sla_id: u64, round_id: u64]` | `SettlementPaidData { payout: i128, beneficiary: Address }` | Quorum is met and penalty transfer is completed. |
| `sla_cancelled` | `[Symbol("sla_cancelled"), sla_id: u64]` | `()` | Provider transitions agreement status to Cancelled. |
| `bond_withdrawn` | `[Symbol("bond_withdrawn"), sla_id: u64]` | `BondWithdrawnData { amount: i128 }` | Provider withdraws remaining collateral after cancellation. |

---

## Contract Errors Reference

Soroban contract errors are represented as integer codes conforming to the `#[contracterror]` specification.

### `watcher_registry` Error Codes

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    NotAWatcher = 3,
    DuplicateCheck = 4,
    ContractPaused = 5,
}
```

| Code | Identifier | Description | Remediation |
| :--- | :--- | :--- | :--- |
| `1` | `NotAuthorized` | Caller does not match the configured admin address. | Confirm transaction is signed by the contract administrator. |
| `2` | `AlreadyInitialized` | Attempted to call `initialize` on an already configured contract. | Initialization can only occur once; no further action required. |
| `3` | `NotAWatcher` | Caller invoking `submit_check` is not in the authorized watcher set. | Ensure address is registered via `register_watcher` by admin. |
| `4` | `DuplicateCheck` | Watcher has already submitted a check for `(sla_id, round_id)`. | Do not re-submit. Check `has_watcher_voted` prior to broadcast. |
| `5` | `ContractPaused` | Operations are halted via administrative pause. | Wait for administrator to invoke `unpause`. |

### `sla_vault` Error Codes

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    AlreadyInitialized = 2,
    SlaNotActive = 3,
    AlreadySettled = 4,
    QuorumNotMet = 5,
    BondExhausted = 6,
    InvalidAmount = 7,
    ContractPaused = 8,
    SlaNotFound = 9,
}
```

| Code | Identifier | Description | Remediation |
| :--- | :--- | :--- | :--- |
| `1` | `NotAuthorized` | Caller is not authorized for the requested action (e.g. non-provider top-up or non-admin pause). | Ensure caller matches provider address stored in `SLAConfig`. |
| `2` | `AlreadyInitialized` | Attempted to re-initialize an active vault. | Initialization can only occur once. |
| `3` | `SlaNotActive` | Agreement is cancelled or in an invalid state for the operation. | For `trigger_settlement`, SLA must be Active. For `withdraw_remaining_bond`, SLA must be Cancelled. |
| `4` | `AlreadySettled` | Settlement for `(sla_id, round_id)` has already executed. | Rounds can only settle once. Check `is_round_settled` before calling. |
| `5` | `QuorumNotMet` | Number of `DOWN` votes in `watcher_registry` is below `quorum_threshold`. | Wait for more watchers to submit checks, or round does not warrant settlement. |
| `6` | `BondExhausted` | Escrow balance is 0. Penalty cannot be paid. | Provider must call `top_up_bond` to replenish collateral. |
| `7` | `InvalidAmount` | Parameter validation failure: zero/negative amount, penalty exceeding bond, or zero withdrawal. | Check numerical inputs. Ensure amounts are > 0 and penalty <= bond. |
| `8` | `ContractPaused` | Vault agreement creation is paused by administrator. | Existing agreements and settlements continue, but new SLAs cannot be created. |
| `9` | `SlaNotFound` | Requested `sla_id` does not exist in persistent storage. | Verify SLA identifier. |
