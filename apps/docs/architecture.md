# Architecture

```text
                       Stellar Testnet
                             │
              ┌──────────────┴──────────────┐
              │                              │
      watcher_registry                   sla_vault
      (votes per round)          (bonds, quorum judgment,
              │                     settlement, token transfer)
              │                              │
       watcher daemon                   SEP-41 token
      (one process per                  (native XLM SAC
       SLA, submits votes)                on Testnet)
              │                              │
              └──────────────┬───────────────┘
                              │
                          Indexer
                    (reads events, writes SQLite)
                              │
                          HTTP API
                              │
                          Frontend
                    (Next.js, reads API + reads
                     Soroban directly via the SDK)
                              │
                          Freighter
                    (signs, in the user's browser)
```

Two repositories, not one: `slasettle-vault` is exactly the two contracts.
`slasettle-hub` is the watcher, indexer, SDK, and frontend. Neither
repository's build depends on the other at build time; the hub's services
are configured with the vault's deployed contract IDs as environment
variables, not a source dependency.

## What state is authoritative

- **On-chain contract state (both contracts) is the only authoritative
  state.** Bond balances, SLA status, vote tallies, and settlement
  history all live there and nowhere else.
- **The indexer's database is a derived, read-only cache.** It exists so
  the frontend doesn't have to scan the whole event history itself, and
  so the public status page can show settlement history without a
  wallet. If the indexer disappears or falls behind, the contracts'
  actual state is unaffected; only the indexer's own read API is stale
  or unavailable.
- **The frontend never stores state of its own that matters.** It reads
  the indexer for history and reads Soroban RPC directly (via the SDK)
  for anything that must be current right now (bond balance, SLA status,
  live vote tally). It never infers "confirmed" from a transaction
  submission succeeding; it polls for a definitive on-chain result.

## The wallet signing boundary

The frontend and the SDK never construct, hold, or have access to a
private key, anywhere. Every write action (create/top-up/cancel/withdraw
an SLA, trigger settlement) is built by the SDK as an **unsigned**
transaction, then handed to `@stellar/freighter-api`, which prompts the
user's own browser extension to sign it. Signing happens entirely inside
Freighter; this codebase never sees the key material. See
[SDK](/sdk) for the exact function names and [Security](/security) for
how this boundary was verified (a full grep across the frontend and SDK
source for any private-key or secret-signing code found none).
