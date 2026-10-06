# Introduction

## What SLASettle is

SLASettle lets a service provider back an uptime promise with a real bond
of tokens. Registered watchers check the service each round and vote on
whether it was up or down. When enough watchers have voted it down and
anyone calls `trigger_settlement`, a fixed penalty is paid out of the bond
to a named beneficiary. Nothing in this repository triggers that call
automatically. Nobody needs to trust the provider's own uptime report, and
nobody needs to trust a single watcher either, since settlement requires
a quorum of votes. The watchers are independent of the provider by design; on
the current Testnet deployment the five registered watcher addresses were set
up by the project admin for evidence runs, not by independent operators.

## Who this is for

- A service provider who wants to make an uptime guarantee credible by
  putting real funds behind it.
- A beneficiary (a customer, a partner, an insurer) who wants an
  on-chain payout that anyone can trigger once that guarantee is voted
  broken, without relying on the provider's own word.
- A watcher who wants to independently verify a service's uptime and be
  part of the quorum that decides whether a breach happened.

## What the current implementation actually supports

- Two Soroban contracts (`watcher_registry`, `sla_vault`) implementing
  the watcher set, vote counting, bond accounting, and settlement.
- A Go watcher daemon that checks an endpoint once per round and submits
  its vote.
- An event indexer that turns on-chain history into a small read API.
- A TypeScript SDK and a Next.js frontend for creating and managing SLAs
  and viewing a public per-SLA status page.

## Current status, stated plainly

- **Testnet only.** Nothing here has been deployed to Stellar mainnet.
- **No independent security audit has been performed.** See
  [Security](/security) for the actual internal review that has been
  done.
- **The current contracts were built and deployed on 2026-10-01 with
  `soroban-sdk` 28.0.0 and `stellar-cli` 28.1.0 (Protocol 28).** The vault
  repository's current source uses the same SDK and the WASM hashes match. See
  [Current Testnet deployment](/testnet-deployment) for the IDs, hashes and
  evidence. Earlier deployments are kept there as historical evidence only.
- **Browser and Freighter wallet verification of the frontend, and a
  live watcher-daemon run against real Testnet RPC, were both performed
  on 2026-09-29** using a disposable watcher account against the earlier,
  superseded 2026-09-27 deployment. They have not been repeated on the
  current deployment. See [Limitations](/limitations) for what this
  covered and what a real, previously-undocumented indexer defect it
  surfaced along the way.

None of the above is hidden elsewhere in this documentation; each page
restates the relevant caveat where it's relevant, rather than assuming
you read this page first.
