# Events & Errors

This reference follows the event structs and `#[contracterror]` enums in the current v0.2 Vault source. Event topic fields below are exactly the fields marked `#[topic]`; payload fields are the other declared struct fields. The table does not invent a raw XDR serialization. Use the generated contract spec and a Stellar SDK when encoding or decoding ledger events.

## Events

### `watcher_registry`

| Event struct | Topic fields | Data fields |
| --- | --- | --- |
| `WatcherRegistered` | `watcher: Address` | None |
| `WatcherRemoved` | `watcher: Address` | None |
| `CheckSubmitted` | `sla_id: u64`, `watcher: Address` | `round_id: u64`, `endpoint_hash: BytesN<32>`, `status: CheckStatus` |

### `sla_vault`

| Event struct | Topic fields | Data fields |
| --- | --- | --- |
| `SlaCreated` | `sla_id: u64`, `provider: Address` | `token: Address`, `endpoint_hash: BytesN<32>`, `bond_amount: i128`, `uptime_target_bps: u32`, `quorum_threshold: u32`, `penalty_per_breach: i128`, `beneficiary: Address` |
| `BondToppedUp` | `sla_id: u64` | `amount: i128` |
| `SettlementPaid` | `sla_id: u64`, `round_id: u64` | `payout: i128`, `beneficiary: Address` |
| `SlaCancelled` | `sla_id: u64` | None |
| `BondWithdrawn` | `sla_id: u64` | `amount: i128` |

`CheckSubmitted.endpoint_hash` identifies the endpoint commitment used for the tally. `SlaCreated.endpoint_hash` records the SLA's commitment. Neither event proves that an HTTP observation was honest.

## Contract Errors

Soroban contract error values below match the explicit `#[repr(u32)]` values in the current contract source. Transaction authorization failures raised by the host may appear separately from these contract errors.

### `watcher_registry`

| Code | Variant | Meaning |
| ---: | --- | --- |
| 1 | `NotAuthorized` | Caller does not match the configured administrator. |
| 2 | `AlreadyInitialized` | `initialize` was called after initialization. |
| 3 | `NotAWatcher` | The submitting address is not registered. |
| 4 | `DuplicateCheck` | The watcher already submitted for `(sla_id, round_id)`, regardless of endpoint hash. |
| 5 | `ContractPaused` | Check submission is paused. |
| 6 | `InvalidRound` | The round is neither the current round nor the immediately previous round. |

### `sla_vault`

| Code | Variant | Meaning |
| ---: | --- | --- |
| 1 | `NotAuthorized` | Caller does not match the provider or administrator required by the operation. |
| 2 | `AlreadyInitialized` | `initialize` was called after initialization. |
| 3 | `SlaNotActive` | Operation requires a different SLA lifecycle state. |
| 4 | `AlreadySettled` | `(sla_id, round_id)` has already settled. |
| 5 | `QuorumNotMet` | Endpoint-bound `votes_down` is below the configured threshold. |
| 6 | `BondExhausted` | No positive bond balance remains to pay a settlement. |
| 7 | `InvalidAmount` | A bond, penalty, top-up, or withdrawal amount violates its positive-value or bond-bound checks. |
| 8 | `ContractPaused` | New SLA creation is paused. |
| 9 | `SlaNotFound` | The requested SLA does not exist in persistent storage. |
| 10 | `InvalidUptimeTarget` | `uptime_target_bps` is outside `1..=10_000`. |
| 11 | `InvalidQuorum` | Threshold is zero, exceeds the registered watcher count, or the registry has no watchers. |
