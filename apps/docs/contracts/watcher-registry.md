# Watcher Registry Contract

The `watcher_registry` contract manages authorized watcher identities, records signed health checks, and computes round-level vote tallies for each monitored agreement.

- **Deployed Address**: `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`
- **Source Location**: `contracts/watcher_registry/src/lib.rs`
- **SDK Version**: `soroban-sdk 28.0.0`

## Data Types

### `CheckStatus`
```rust
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CheckStatus {
    Up = 1,
    Down = 2,
}
```

### `RoundTally`
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoundTally {
    pub votes_up: u32,
    pub votes_down: u32,
}
```

## Storage Layout

- **Instance Storage**:
  - `DataKey::Admin`: The contract administrator address.
  - `DataKey::WatcherCount`: Total count of active watchers (`u32`).
  - `DataKey::Paused`: Circuit breaker flag (`bool`).
- **Persistent Storage**:
  - `DataKey::Watcher(Address)`: Authorization boolean (`bool`).
  - `DataKey::Check(u64, u64, Address)`: Recorded vote per `(sla_id, round_id, watcher)` (`CheckStatus`).
  - `DataKey::Tally(u64, u64)`: Aggregate round tallies (`RoundTally`).

## Public Functions

### `initialize`
```rust
pub fn initialize(env: Env, admin: Address) -> Result<(), Error>
```
- **Authorization**: `admin.require_auth()`.
- **Description**: One-time contract initialization. Sets the admin address and initializes `WatcherCount` to 0.
- **Errors**: `AlreadyInitialized` if called more than once.

---

### `register_watcher`
```rust
pub fn register_watcher(env: Env, caller: Address, watcher: Address) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `Admin`).
- **Description**: Adds `watcher` to the authorized watcher set. Increments `WatcherCount`. If `watcher` is already registered, this function is a safe no-op to prevent duplicate count inflation.
- **Events**: Emits `WatcherRegistered { watcher }`.
- **Errors**: `NotAuthorized` if caller is not the contract administrator.

---

### `remove_watcher`
```rust
pub fn remove_watcher(env: Env, caller: Address, watcher: Address) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `Admin`).
- **Description**: Revokes authorization for `watcher`. Removes the persistent entry and decrements `WatcherCount` (saturating at 0). If the address was not registered, executes as a safe no-op.
- **Events**: Emits `WatcherRemoved { watcher }`.
- **Errors**: `NotAuthorized` if caller is not the contract administrator.

---

### `is_watcher`
```rust
pub fn is_watcher(env: Env, watcher: Address) -> bool
```
- **Authorization**: None (Public read).
- **Description**: Returns `true` if `watcher` is currently registered and authorized.

---

### `get_watcher_count`
```rust
pub fn get_watcher_count(env: Env) -> u32
```
- **Authorization**: None (Public read).
- **Description**: Returns the total number of currently registered watchers.

---

### `pause` / `unpause`
```rust
pub fn pause(env: Env, caller: Address) -> Result<(), Error>
pub fn unpause(env: Env, caller: Address) -> Result<(), Error>
```
- **Authorization**: `caller.require_auth()` (Must match `Admin`).
- **Description**: Sets the emergency circuit breaker. Pausing halts `submit_check` invocations while leaving read views and administrative registration intact.
- **Errors**: `NotAuthorized` if caller is not administrator.

---

### `submit_check`
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
- **Authorization**: `watcher.require_auth()`.
- **Description**: Submits an attestation for `sla_id` during `round_id`. Increments `votes_up` or `votes_down` on the round's tally.
- **Single Vote Rule**: A watcher can submit only once per `(sla_id, round_id)`. Subsequent attempts reject with `DuplicateCheck`.
- **Endpoint Hash**: The `endpoint_hash` argument is accepted as part of transaction invocation history, making the target URL verifiable from historical transaction envelopes without storing redundant bytes in on-chain state.
- **Events**: Emits `CheckSubmitted { sla_id, round_id, watcher, status }`.
- **Errors**:
  - `ContractPaused`: If the registry is currently paused.
  - `NotAWatcher`: If the caller is not an authorized watcher.
  - `DuplicateCheck`: If the watcher has already submitted for this round.

---

### `get_round_tally`
```rust
pub fn get_round_tally(env: Env, sla_id: u64, round_id: u64) -> RoundTally
```
- **Authorization**: None (Public read).
- **Description**: Returns `RoundTally { votes_up, votes_down }` for the specified round. Returns `{ votes_up: 0, votes_down: 0 }` if no checks have been submitted.

---

### `has_watcher_voted`
```rust
pub fn has_watcher_voted(env: Env, sla_id: u64, round_id: u64, watcher: Address) -> bool
```
- **Authorization**: None (Public read).
- **Description**: Returns `true` if the specified watcher has already recorded an attestation for `(sla_id, round_id)`.
