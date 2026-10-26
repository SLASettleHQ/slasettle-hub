# Overview

SLASettle is a bonded Service Level Agreement (SLA) settlement protocol built on Stellar Soroban. Service providers back uptime commitments with on-chain token bonds, while a registered watcher quorum submits service-health votes and anyone may trigger a penalty payout after a qualifying breach.

## Core Value Proposition

In traditional infrastructure agreements, SLA guarantees are paper promises. When an outage occurs, customers face bureaucratic claims processes, disputable proprietary monitoring metrics, and delayed credit notes issued at the provider's discretion.

SLASettle replaces subjective reporting with autonomous smart contracts:

- **Cryptographic Escrow**: Service providers lock token bonds (native XLM or Stellar assets) directly into the `sla_vault` smart contract upon agreement creation.
- **Registered Watcher Quorum**: Authorized watcher daemons can be operated independently and submit signed health checks each round. Current Testnet verification uses three project-controlled watcher identities.
- **Deterministic Settlement**: When the number of verified `DOWN` checks reaches quorum (`floor(N/2) + 1`), anyone can trigger settlement on-chain. The vault transfers the penalty payout directly to the beneficiary's wallet.
- **Transparent Lifecycle**: Providers can top up active bonds, cancel unused SLAs, and reclaim remaining balances once commitments expire or terminate.

## Architecture at a Glance

The SLASettle ecosystem spans two primary repositories:

1. **[slasettle-vault](https://github.com/SLASettleHQ/slasettle-vault)**: Rust smart contracts using `soroban-sdk 29.0.1`:
   - `watcher_registry`: Manages watcher authorization, check submissions, duplicate detection, and round tallying.
   - `sla_vault`: Escrows token collateral, manages SLA parameters, verifies consensus against the registry, and executes settlements.
2. **[slasettle-hub](https://github.com/SLASettleHQ/slasettle-hub)**: Off-chain infrastructure, client libraries, and interfaces:
   - `@slasettle/sdk`: TypeScript SDK for contract interactions, simulation, and transaction submission.
   - `apps/web`: Next.js 16.4.2 operations dashboard and public status portal with Freighter wallet support.
   - `indexer`: Serverless event indexing service deployed on Cloudflare Workers.
   - `watcher`: Autonomous Go daemon executing HTTP health probes and signing on-chain checks.
   - `apps/docs`: VitePress documentation site.

## Target Personas

- **Service Providers**: API companies, RPC node providers, cloud platforms, and oracle networks seeking to build customer trust through verifiable, bonded performance guarantees.
- **Beneficiaries & Customers**: Enterprises, decentralized applications, and protocol integrators requiring immediate financial compensation when mission-critical dependencies fail.
- **Watcher Operators**: Node operators and monitoring services participating in consensus by publishing cryptographically attested service health data.
- **Developers & Integrators**: Engineers embedding automated SLA escrow and status tracking into developer workflows, status pages, or billing systems.

## Current Network Status & Verification

- **Network**: Stellar Testnet (Protocol 29 at v0.2 deployment/cutover verification).
- **Contracts**:
  - `sla_vault`: `CA5R7V5IGMYOBRSAMP4R5MWURSNTY6565NSKEEVR6626PLC3VM2A3EZ2`
  - `watcher_registry`: `CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY`
- **WASM Verification**: Local release builds match deployed Testnet WASM bytecode byte-for-byte with zero hash drift.
- **Wallet & Contract Operations**: Full lifecycle operations (create SLA, top up bond, cancel SLA, withdraw remaining bond) have been executed and verified live on Stellar Testnet using the Freighter browser extension on SLA #2.
- **Hosting Topology**:
  - Production Console: [slasettle-web.vercel.app](https://slasettle-web.vercel.app)
  - Hosted Indexer: [slasettle-indexer-v02.slasettle-indexer.workers.dev](https://slasettle-indexer-v02.slasettle-indexer.workers.dev)
  - Documentation: [slasettle-docs.vercel.app](https://slasettle-docs.vercel.app)
- **Security Audit Status**: Unaudited. All 595 automated tests pass across Vault, SDK, Web, indexer, and watcher, but no independent third-party security audit has been completed. This deployment is Testnet only.
