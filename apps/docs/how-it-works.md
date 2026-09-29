# How SLASettle works

## The real lifecycle

```text
provider
  → create_sla (locks bond_amount of a token into sla_vault)
  → SLA is Active

each round:
  watcher daemon
    → checks the target endpoint once
    → submit_check(sla_id, round_id, endpoint_hash, status) on watcher_registry
    → watcher_registry counts the vote (votes_up or votes_down)

anyone (permissionless)
  → trigger_settlement(caller, sla_id, round_id) on sla_vault
    → sla_vault reads watcher_registry.get_round_tally(sla_id, round_id)
    → if votes_down >= quorum_threshold:
        pay min(penalty_per_breach, remaining bond) to beneficiary
        mark that round settled
        emit SettlementPaid
    → if not: reject with QuorumNotMet
```

## The five components and what each one actually does

- **`watcher_registry`** (Soroban contract). Tracks which addresses are
  eligible watchers and counts their votes for a given `(sla_id,
  round_id)`. It has no concept of a quorum threshold and is not meant
  to; it only counts.
- **`sla_vault`** (Soroban contract). Holds a provider's bonded funds per
  SLA. Reads the raw vote count from `watcher_registry`, applies its own
  quorum judgment, and pays the beneficiary when quorum is reached. It
  never modifies `watcher_registry`'s state.
- **Watcher daemon** (Go). One process per SLA. Once per round: checks
  `has_watcher_voted` first (so it doesn't waste a transaction on a
  duplicate), then does one HTTP GET against the target endpoint, then
  signs and submits `submit_check` with its own key. It never touches
  `sla_vault`.
- **Indexer** (Node/TypeScript). Watches both contracts' events, stores
  them in SQLite, and serves a small read API
  (see [Indexer API](/api)). It never writes to either contract; it is a
  read-side history cache, not a source of truth.
- **SDK + frontend** (TypeScript/Next.js). The SDK builds unsigned
  transactions and reads live contract state directly from Soroban RPC.
  The frontend signs those transactions with a connected Freighter wallet
  and submits them. Neither the SDK nor the frontend ever holds a private
  key.

## What "permissionless settlement" actually means

`trigger_settlement`'s `caller` parameter is never passed to
`require_auth()` in the contract source, and is not checked against any
role. Anyone who believes quorum has been reached can call it; nobody's
funds move because of who calls it, only because the on-chain vote count
already satisfies `quorum_threshold`. This was verified live on Testnet:
the real settlement recorded in this project's evidence was triggered by
an account that was not the admin, the provider, or the beneficiary
(see [Current Testnet deployment](/testnet-deployment)).
