# Lifecycle

## SLA status

`SLAStatus` (defined in `contracts/sla_vault/src/storage.rs`) has exactly
two variants:

```text
Active
Cancelled
```

There is no "Requested" or "Pending" state; `create_sla` transfers the
bond and creates the record as `Active` in the same call. There is no
"Settled" or "Completed" terminal status either: an `Active` SLA stays
`Active` through any number of settled rounds. Only `cancel_sla` moves it
to `Cancelled`, and that transition is one-way; there is no
un-cancelling.

```text
create_sla ──────────────► Active ──────────────► Cancelled
                              │                       │
                    trigger_settlement          withdraw_remaining_bond
                    (any number of times,        (only allowed once
                     one per distinct               Cancelled)
                     round_id)
```

## Round and settlement, the real unit of enforcement

There is no aggregate "uptime over the billing period" calculation
anywhere in the contracts. Settlement is purely per-round:

- A `round_id` is an arbitrary application-level integer key. The
  contracts never check it against real time; the watcher daemon
  computes it as `floor(now / ROUND_LENGTH_SECONDS)` on its own clock,
  and the indexer's `/v1/clock` endpoint is the authoritative source the
  frontend is supposed to read it from, never the browser's own clock.
- For one `(sla_id, round_id)` pair: each registered watcher may vote
  `Up` or `Down` exactly once (`watcher_registry.submit_check`,
  rejected with `DuplicateCheck` on a second attempt from the same
  watcher for the same round).
- `sla_vault.trigger_settlement(caller, sla_id, round_id)` reads that
  round's tally and requires `votes_down >= quorum_threshold`. If met, it
  pays `min(penalty_per_breach, remaining bond balance)` to the
  beneficiary and marks that exact `(sla_id, round_id)` settled forever
  (`AlreadySettled` on any later attempt for the same round). If not met,
  it fails with `QuorumNotMet` and nothing moves.
- A different round for the same SLA is a completely independent
  settlement opportunity; there is no limit on how many rounds can be
  settled over an SLA's lifetime, other than the bond running out
  (`BondExhausted`).

## `uptime_target_bps` is display-only

`SLAConfig.uptime_target_bps` (a `u32`, basis points, e.g. `9990` for
99.90%) is stored and can be shown in a UI. Nothing in either contract
computes an actual uptime percentage over any period, and nothing
compares a computed percentage against this value. It is not enforced.
This is not a bug; it is a real, current limitation, disclosed here and
in [Limitations](/limitations), not something a later phase quietly
fixed.
