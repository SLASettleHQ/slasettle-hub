# SLA Vault Contract

The `sla_vault` contract escrows token collateral, manages agreement configurations, cross-examines round tallies against `watcher_registry`, and executes automated penalty settlements.

- **Deployed Address**: `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`
- **Source Location**: `contracts/sla_vault/src/lib.rs`
- **SDK Version**: `soroban-sdk 28.0.0`

## Data Types

### `SLAStatus`
```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SLAStatus {
    Active = 1,
    Cancelled = 2,
}
```

### `SLAConfig`
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SLAConfig {
    pub provider: Address,
    pub token: Address,
    pub bond_amount: i128,
    pub uptime_target_bps: u32,
    pub quorum_threshold: u32,
    pub penalty_per_breach: i128,
    pub beneficiary: Address,
    pub status: SLAStatus,
}
```

## Storage Layout

- **Instance Storage**:
  - `DataKey::Admin`: Administrator address.
  - `DataKey::WatcherRegistry`: Bound `watcher_registry` contract address.
  - `DataKey::NextSlaId`: Monotonically incrementing SLA counter (`u64`).
  - `DataKey::Paused`: Circuit breaker flag (`bool`).
- **Persistent Storage**:
  - `DataKey::Sla(u64)`: Agreement configuration (`SLAConfig`).
  - `DataKey::BondBalance(u64)`: Remaining escrow balance (`i128`).
  - `DataKey::SettledRounds(u64, u64)`: Settlement flag for `(sla_id, round_id)` (`bool`).

## Public Functions

### `initialize`
```rust
pub fn initialize(env: Env, admin: Address, watcher_registry: Address) -> Result<(), Error>
```
- **Authorization**: `admin.require_auth()`.
- **Description**: Configures administrator and binds the companion `watcher_registry` contract address.
- **Errors**: `AlreadyInitialized` if called more than once.

---

### `create_sla`
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
- **Authorization**: `provider.require_auth()`.
- **Description**: Transfers `bond_amount` of `token` from provider to vault via Stellar Asset Contract. Creates an agreement with status `Active` and returns the allocated `sla_id`.
- **Validation Rules**:
  - `bond_amount > 0` (otherwise `Error::InvalidAmount`)
  - `penalty_per_breach > 0` (otherwise `Error::InvalidAmount`)
  - `penalty_per_breach <= bond_amount` (otherwise `Error::InvalidAmount`)
  - `quorum_threshold > 0` (otherwise `Error::InvalidAmount`)
- **Circuit Breaker**: Returns `Error::ContractPaused` if the contract is paused.
- **Events**: Emits `SlaCreated { sla_id, provider, token, bond_amount, beneficiary }`.

---

### `get_sla`
```rust
pub fn get_sla(env: Env, sla_id: u64) -> Result<SLAConfig, Error>
```
- **Authorization**: None (Public read).
- **Description**: Retrieves configuration record for `sla_id`.
- **Errors**: `Error::SlaNotFound` if agreement does not exist.

---

### `get_bond_balance`
```rust
pub fn get_bond_balance(env: Env, sla_id: u64) -> i128
```
- **Authorization**: None (Public read).
- **Description**: Returns current remaining escrow balance for `sla_id`. Returns 0 if not found.

---

### `top_up_bond`
```rust
pub fn top_up_bond(env: Env, caller: Address, sla_id: u64, amount: i128) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `config.provider`).
- **Description**: Deposits additional collateral into the agreement's bond balance.
- **Validation Rules**:
  - `amount > 0` (otherwise `Error::InvalidAmount`)
  - `caller == config.provider` (otherwise `Error::NotAuthorized`)
- **Events**: Emits `BondToppedUp { sla_id, amount }`.

---

### `trigger_settlement`
```rust
pub fn trigger_settlement(
    env: Env,
    caller: Address,
    sla_id: u64,
    round_id: u64
) -> Result<(), Error>
```
- **Authorization**: **Permissionless** (No `caller.require_auth()`). Anyone can execute settlement once quorum is verified.
- **Execution Pipeline**:
  1. Verifies agreement exists and status is `Active` (`SlaNotActive`).
  2. Confirms round is not already settled (`AlreadySettled`).
  3. Queries `watcher_registry.get_round_tally(sla_id, round_id)`.
  4. Confirms `votes_down >= quorum_threshold` (`QuorumNotMet`).
  5. Computes payout: `min(penalty_per_breach, remaining_balance)`. Rejects `BondExhausted` if payout is 0.
  6. Executes SAC token transfer to `beneficiary`.
  7. Updates balance and records `SettledRounds = true`.
- **Events**: Emits `SettlementPaid { sla_id, round_id, payout, beneficiary }`.

---

### `is_round_settled`
```rust
pub fn is_round_settled(env: Env, sla_id: u64, round_id: u64) -> bool
```
- **Authorization**: None (Public read).
- **Description**: Returns `true` if `(sla_id, round_id)` has already settled.

---

### `cancel_sla`
```rust
pub fn cancel_sla(env: Env, caller: Address, sla_id: u64) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `config.provider`).
- **Description**: Transitions agreement status from `Active` to `Cancelled`. Required prerequisite before withdrawing funds.
- **Events**: Emits `SlaCancelled { sla_id }`.

---

### `withdraw_remaining_bond`
```rust
pub fn withdraw_remaining_bond(env: Env, caller: Address, sla_id: u64) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `config.provider`).
- **Description**: Transfers remaining collateral back to the provider and sets balance to 0.
- **Validation Rules**:
  - Status must be `Cancelled` (`SlaNotActive` if still active).
  - Current balance must be greater than 0 (`InvalidAmount` if 0).
- **Events**: Emits `BondWithdrawn { sla_id, amount }`.

---

### `pause` / `unpause`
```rust
pub fn pause(env: Env, caller: Address) -> Result<(), Error>
pub fn unpause(env: Env, caller: Address) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `Admin`).
- **Description**: Pausing halts `create_sla` while allowing existing obligations (`top_up_bond`, `trigger_settlement`, `withdraw_remaining_bond`) to proceed.
