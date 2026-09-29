# Introduction

## What SLASettle is

SLASettle lets a service provider back an uptime promise with a real bond
of tokens. Independent watchers check the service each round and vote on
whether it was up or down. When enough watchers agree it was down, a
fixed penalty is paid automatically out of the bond to a named
beneficiary. Nobody needs to trust the provider's own uptime report, and
nobody needs to trust a single watcher either, since settlement requires
a quorum of independent votes.

## Who this is for

- A service provider who wants to make an uptime guarantee credible by
  putting real funds behind it.
- A beneficiary (a customer, a partner, an insurer) who wants an
  automatic, on-chain payout when that guarantee is broken, without
  relying on the provider's own word.
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
- **The currently deployed, live-verified contracts were built with
  `soroban-sdk` 27.0.6.** The vault repository's current source has since
  moved to `soroban-sdk` 28.0.0. These are not the same build. See
  [Current Testnet deployment](/testnet-deployment) for the exact detail.
  This mismatch is real and has not been resolved as of this writing.
- **Browser and Freighter wallet verification of the frontend has not
  been performed** in any environment this project has been built in so
  far. See [Limitations](/limitations).
- **The watcher daemon has been tested locally against a mocked RPC
  transport, but has not been run as a live process against Testnet
  RPC.** The real votes referenced throughout this documentation were
  submitted directly via the Stellar CLI, not by running the daemon.

None of the above is hidden elsewhere in this documentation; each page
restates the relevant caveat where it's relevant, rather than assuming
you read this page first.
