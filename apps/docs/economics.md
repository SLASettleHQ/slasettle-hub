# Economics

All money in the contracts is an `i128` in the token's smallest unit
(stroops for the native XLM Stellar Asset Contract used in the current
Testnet deployment). There is no floating-point arithmetic anywhere in
`sla_vault`, and this documentation follows the same rule: every amount
below is a whole integer of smallest units, never a decimal.

## The four numbers a provider sets at `create_sla`

```text
create_sla(provider, token, bond_amount, uptime_target_bps,
           quorum_threshold, penalty_per_breach, beneficiary)
```

- **`bond_amount`** (`i128`, must be `> 0`) — transferred from the
  provider to the contract in the same transaction, before the SLA
  record even exists. This is the maximum total the SLA can ever pay
  out over its lifetime, not a per-round figure.
- **`penalty_per_breach`** (`i128`, must be `> 0` and `<= bond_amount`)
  — the amount paid out for one settled round's breach. `create_sla`
  rejects a `penalty_per_breach` larger than `bond_amount` outright
  (`Error::InvalidAmount`); there is no way to configure a bond that
  can't cover at least one breach.
- **`quorum_threshold`** (`u32`, must be `> 0`) — the minimum number of
  `Down` votes in a single round required for `trigger_settlement` to
  pay out. A value of `0` is rejected with `Error::InvalidAmount`: with
  the contract's actual comparison (`votes_down < quorum_threshold`), a
  threshold of `0` would make settlement always succeed with zero votes,
  which defeats quorum entirely. This was a real fix made to the
  contract; see [Contracts](/contracts).
- **`uptime_target_bps`** (`u32`, basis points) — stored and returned by
  `get_sla`, but not used in any calculation. See
  [Lifecycle](/lifecycle) for why.

## A worked example, using the real numbers from this project's own Testnet evidence

The live evidence in `slasettle-vault/evidence/testnet-2026-09-27.md`
recorded a real `create_sla` call with:

```text
bond_amount:         50000000   (5 XLM, at 10,000,000 stroops per XLM)
penalty_per_breach:  10000000   (1 XLM)
quorum_threshold:    3
uptime_target_bps:   9990       (display only, not enforced)
```

With a `50000000`-stroop bond and a `10000000`-stroop
`penalty_per_breach`, this SLA can absorb at most 5 settled breaches
before `trigger_settlement` starts failing with `Error::BondExhausted`
(step 5 in `trigger_settlement`: the payout is `min(penalty_per_breach,
remaining balance)`, and a payout of `0` — meaning the balance is
already fully drained — is itself rejected rather than silently
returning success).

In the real evidence, a `top_up_bond` of `5000000` was submitted first,
bringing the balance to `55000000`. The real settlement recorded in
that same evidence file then paid out `10000000` stroops (one
`penalty_per_breach`) to beneficiary
`GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2`, leaving
`45000000` stroops of bond remaining, from a settlement triggered by
`alice` (`GAD7M6PM5XZVL2ASJBVASANMUQYLLGBCJDVQSDYIH66ORNARG2DDPNGB`) —
an account that was not the provider, the beneficiary, or the admin.
See [Current Testnet deployment](/testnet-deployment) for the full
transaction hash and contract IDs.

## What is not modeled

- **No pro-rated or partial payout.** A settled round pays exactly
  `min(penalty_per_breach, remaining balance)` — never a fraction of
  `penalty_per_breach` based on how bad the breach was.
- **No interest, yield, or time-value treatment of a bonded amount.**
  A bond sitting in the contract earns nothing and costs nothing beyond
  whatever the token itself does.
- **No fee taken by the protocol.** Every stroop that leaves the bond on
  settlement goes to the beneficiary; every stroop returned by
  `withdraw_remaining_bond` goes to the provider. There is no third
  party fee, treasury, or admin cut anywhere in `sla_vault`.
- **No price or exchange-rate logic.** The bond, the penalty, and any
  top-up must be the same token (`config.token`, fixed at `create_sla`
  time); the contract never converts between tokens or reads a price
  feed.

## Topping up and withdrawing

`top_up_bond(caller, sla_id, amount)` lets only the original provider
(`config.provider != caller` is rejected with `Error::NotAuthorized`)
add more of the SLA's token to its balance at any time, active or not.
There is no cap on how many times or how much can be added.

`withdraw_remaining_bond(caller, sla_id)` returns the entire current
balance to the provider in one call, and only once the SLA has been
explicitly `cancel_sla`'d first (`Error::SlaNotActive` otherwise). A
zero balance is rejected with `Error::InvalidAmount` rather than
succeeding as a no-op — see [Contracts](/contracts) for why this was
changed.
