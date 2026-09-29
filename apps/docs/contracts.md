# Contracts

Two Soroban contracts, in `slasettle-vault/contracts/`. `sla_vault`
depends on `watcher_registry` at both build time (via
`soroban_sdk::contractimport!` against a pre-built WASM file) and
runtime (a stored contract address, set at `initialize`, called via a
generated cross-contract client). `watcher_registry` has no dependency
on `sla_vault` at all.

## `watcher_registry`

Tracks which addresses may vote, and counts votes. Has no concept of a
quorum threshold — that judgment belongs entirely to `sla_vault`.

| Function | Auth | Behavior |
|---|---|---|
| `initialize(admin)` | `admin` | One-time. Fails `AlreadyInitialized` if called twice. |
| `register_watcher(caller, watcher)` | `admin` | Adds `watcher`. No-op (not an error) if already registered. |
| `remove_watcher(caller, watcher)` | `admin` | Removes `watcher`. No-op if not registered. |
| `is_watcher(watcher)` | none (view) | `bool`. |
| `get_watcher_count()` | none (view) | `u32`, current eligible-set size. |
| `pause(caller)` / `unpause(caller)` | `admin` | Gates `submit_check` only; registration and views are unaffected. |
| `submit_check(watcher, sla_id, round_id, endpoint_hash, status)` | `watcher` | One vote, once, per `(sla_id, round_id, watcher)`. |
| `get_round_tally(sla_id, round_id)` | none (view) | `RoundTally { votes_up: u32, votes_down: u32 }`, zeros if nothing submitted yet. |
| `has_watcher_voted(sla_id, round_id, watcher)` | none (view) | `bool`. |

`submit_check` rejects with `ContractPaused` while paused, `NotAWatcher`
if the caller isn't currently registered, and `DuplicateCheck` on a
second vote for the same `(sla_id, round_id, watcher)` — the vote is
never overwritten, only rejected. `endpoint_hash` (`BytesN<32>`) is
accepted but not stored and not emitted: the check record holds only the
status, and `check_submitted` carries no hash. It is visible only as an
argument of the submitting transaction, so a dispute could read it from
transaction history, but the contract neither validates nor keeps it.

**Known, disclosed limitation:** contract state is public, so a watcher
who submits late in a round can see how earlier watchers voted before
submitting. A dishonest watcher could copy the emerging majority instead
of reporting what it actually observed. There is no commit-reveal
scheme in this version — see [Limitations](/limitations).

### Errors (`Error`, `#[repr(u32)]`)

| Code | Name |
|---|---|
| 1 | `NotAuthorized` |
| 2 | `AlreadyInitialized` |
| 3 | `NotAWatcher` |
| 4 | `DuplicateCheck` |
| 5 | `ContractPaused` |

### Events

On the wire, topic 0 of every event is the event's own name as a
snake_case symbol; the tables below list the topics that follow it.

| Event | Topics | Data |
|---|---|---|
| `watcher_registered` | `[watcher]` | `{}` |
| `watcher_removed` | `[watcher]` | `{}` |
| `check_submitted` | `[sla_id, watcher]` | `{round_id, status}` |

## `sla_vault`

Holds each SLA's bonded funds, owns quorum judgment, pays out.

| Function | Auth | Behavior |
|---|---|---|
| `initialize(admin, watcher_registry)` | `admin` | One-time. `watcher_registry` must already be deployed and initialized. |
| `create_sla(provider, token, bond_amount, uptime_target_bps, quorum_threshold, penalty_per_breach, beneficiary)` | `provider` | Transfers `bond_amount` of `token` from `provider` into the vault, creates the record as `Active`, returns the new `sla_id: u64`. |
| `get_sla(sla_id)` | none (view) | `SLAConfig`. Errors `SlaNotFound` if it doesn't exist. |
| `get_bond_balance(sla_id)` | none (view) | `i128`, `0` if not found. |
| `top_up_bond(caller, sla_id, amount)` | `caller`, must equal `config.provider` | Adds `amount` of the SLA's token to its balance. Works regardless of `Active`/`Cancelled` status. |
| `trigger_settlement(caller, sla_id, round_id)` | none — `caller` is never passed to `require_auth` | See below. |
| `is_round_settled(sla_id, round_id)` | none (view) | `bool`. |
| `cancel_sla(caller, sla_id)` | `caller`, must equal `config.provider` | One-way: `Active` → `Cancelled`. Required before `withdraw_remaining_bond`. |
| `withdraw_remaining_bond(caller, sla_id)` | `caller`, must equal `config.provider` | Requires `Cancelled`. Transfers the entire remaining balance to the provider and zeroes it. |
| `pause(caller)` / `unpause(caller)` | `admin` | Gates `create_sla` only. `top_up_bond` and `trigger_settlement` keep working while paused — existing obligations are never frozen by a pause. |

### `create_sla` validation, exactly as implemented

Rejected with `InvalidAmount` if any of: `bond_amount <= 0`,
`penalty_per_breach <= 0`, `penalty_per_breach > bond_amount`, or
`quorum_threshold == 0`.

The `quorum_threshold == 0` rejection is a real fix, not the original
behavior.
`trigger_settlement` compares `votes_down < quorum_threshold`; since
`votes_down` is an unsigned `u32`, a `quorum_threshold` of `0` would
make that comparison always false, so settlement would succeed with
zero votes — defeating quorum entirely. This was caught and fixed
before the current live Testnet deployment (see
[Current Testnet deployment](/testnet-deployment)); it is not a
hypothetical.

### `trigger_settlement`, step by step

This function has no auth check on `caller` — it is deliberately
permissionless. Its safety comes from every other step, not from who
calls it:

1. Load the SLA's config; must exist (`SlaNotFound`) and be `Active`
   (`SlaNotActive`).
2. Check the `(sla_id, round_id)` idempotency flag; if already settled,
   reject with `AlreadySettled`. This makes repeat calls harmless.
3. Cross-contract call to `watcher_registry.get_round_tally(sla_id,
   round_id)` for the raw vote count.
4. Reject with `QuorumNotMet` if `votes_down < quorum_threshold`.
5. Compute `payout = min(penalty_per_breach, remaining_balance)`;
   reject with `BondExhausted` if that payout is `0` (rather than
   silently succeeding with a zero transfer).
6. Transfer `payout` to the beneficiary, decrement the stored balance,
   set the settled flag, then emit `settlement_paid`, in that order —
   so a reader of the event can trust both writes already happened
   on-chain.

### `withdraw_remaining_bond`'s zero-balance fix

This is in the current source, not in the live Testnet deployment (see
[Current Testnet deployment](/testnet-deployment)).

Rejects with `InvalidAmount` if the balance is already `0`, rather than
succeeding as a no-op. Real Testnet evidence
(`slasettle-vault/evidence/testnet-2026-09-27.md`) showed the
pre-fix contract would still submit a real transaction and emit a
`bond_withdrawn` event with `amount: 0` on a repeat call — moving no
funds, but wasting a fee and emitting a misleading event. This matches
the zero-value rejection pattern already used by `create_sla` and
`top_up_bond`.

### Errors (`Error`, `#[repr(u32)]`)

| Code | Name |
|---|---|
| 1 | `NotAuthorized` |
| 2 | `AlreadyInitialized` |
| 3 | `SlaNotActive` |
| 4 | `AlreadySettled` |
| 5 | `QuorumNotMet` |
| 6 | `BondExhausted` |
| 7 | `InvalidAmount` |
| 8 | `ContractPaused` |
| 9 | `SlaNotFound` |

### Events

| Event | Topics | Data |
|---|---|---|
| `sla_created` | `[sla_id, provider]` | `{token, bond_amount, beneficiary}` |
| `bond_topped_up` | `[sla_id]` | `{amount}` |
| `settlement_paid` | `[sla_id, round_id]` | `{payout, beneficiary}` |
| `sla_cancelled` | `[sla_id]` | `{}` |
| `bond_withdrawn` | `[sla_id]` | `{amount}` |

### `SLAConfig`

```rust
pub struct SLAConfig {
    pub provider: Address,
    pub token: Address,
    pub bond_amount: i128,
    pub uptime_target_bps: u32,   // display only, see Lifecycle
    pub quorum_threshold: u32,
    pub penalty_per_breach: i128,
    pub beneficiary: Address,
    pub status: SLAStatus,        // Active | Cancelled
}
```

### Storage TTL

Persistent entries (`Sla`, `BondBalance`, `SettledRounds` in
`sla_vault`; `Watcher`, `Check`, `Tally` in `watcher_registry`) extend
their TTL to `518_400` ledgers (roughly 30 days at Stellar's ~5-second
ledger close time) once they come within `17_280` ledgers of expiry.
This constant is a v1 default, not tuned against real storage-rent
usage data — see [Limitations](/limitations).

Instance storage (`Admin`, `Paused`, `NextSlaId`, `WatcherCount`,
`WatcherRegistry`) is **not** extended by the contract code at all, and
entries that are only read (a watcher's registration, an SLA's config) are
not refreshed by the read. The live instances were extended by hand on
2026-09-29 (see [Current Testnet deployment](/testnet-deployment)).
