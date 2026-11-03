# Watcher Registry Contract

The `watcher_registry` contract manages authorized watcher identities, records signed health checks, and computes round-level vote tallies for each monitored agreement.

- **Deployed Address**: `CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY`
- **Source Location**: `contracts/watcher_registry/src/lib.rs`
- **SDK Version**: `soroban-sdk 29.0.1`

## Data Types

### `CheckStatus`
```rust
#[contracttype]
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum CheckStatus {
    Up,
    Down,
}
```

### `RoundTally`
```rust
#[contracttype]
#[derive(Clone, Default, Debug)]
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
  - `DataKey::Check(u64, u64, Address)`: `CheckRecord { endpoint_hash, status }`, keyed by `(sla_id, round_id, watcher)`.
  - `DataKey::Tally(u64, u64, BytesN<32>)`: Aggregate `RoundTally`, keyed by `(sla_id, round_id, endpoint_hash)`.

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

### `get_current_round`
```rust
pub fn get_current_round(env: Env) -> u64
```
- **Authorization**: None (Public read).
- **Description**: Returns `ledger.timestamp() / 60`. Observation rounds have a fixed 60-second schedule.

### `extend_contract_ttl`
```rust
pub fn extend_contract_ttl(env: Env)
```
- **Authorization**: None (Public maintenance entrypoint).
- **Description**: Extends the contract instance and code TTL. It does not blanket-extend persistent watcher, check, or tally entries.

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
- **Description**: Submits an attestation for `sla_id`, `round_id`, and a 32-byte `endpoint_hash`. Increments the tally for exactly that endpoint commitment.
- **Round Freshness**: Accepts only the current ledger-derived round or the immediately preceding round. Other round IDs return `InvalidRound` (code 6). The fixed round length is 60 seconds.
- **Single Vote Rule**: The uniqueness key is `(sla_id, round_id, watcher)`, independent of endpoint hash. A vote for a mismatched endpoint commitment consumes the watcher's one submission for that SLA and round, but affects only that hash's tally.
- **Endpoint Commitment Limit**: The hash binds the tally to a commitment; it does not prove that a watcher made a real HTTP request or reported honestly.
- **Events**: Emits `CheckSubmitted`; `sla_id` and `watcher` are topic fields. The data fields are `round_id`, `endpoint_hash`, and `status`.
- **Errors**:
  - `ContractPaused`: If the registry is currently paused.
  - `NotAWatcher`: If the caller is not an authorized watcher.
  - `DuplicateCheck`: If the watcher has already submitted for this round.
  - `InvalidRound`: If the round is neither current nor immediately previous.

---

### `get_round_tally`
```rust
pub fn get_round_tally(
    env: Env,
    sla_id: u64,
    round_id: u64,
    endpoint_hash: BytesN<32>,
) -> RoundTally
```
- **Authorization**: None (Public read).
- **Description**: Returns the `RoundTally` for `(sla_id, round_id, endpoint_hash)`. Tallies for distinct endpoint commitments are isolated. Returns a zero tally if no checks have been submitted for that tuple.

---

### `has_watcher_voted`
```rust
pub fn has_watcher_voted(env: Env, sla_id: u64, round_id: u64, watcher: Address) -> bool
```
- **Authorization**: None (Public read).
- **Description**: Returns `true` if the specified watcher has already recorded an attestation for `(sla_id, round_id)`.
