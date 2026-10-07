# Overview

SLASettle is a decentralized Service Level Agreement (SLA) settlement system built on Stellar Soroban. It enables service providers to back uptime commitments with on-chain cryptographic token bonds, while a distributed quorum of watcher nodes independently evaluates service health each round and settles penalty payouts directly to beneficiaries when downtime thresholds are breached.

## Core Value Proposition

In traditional infrastructure agreements, SLA guarantees are paper promises. When an outage occurs, customers face bureaucratic claims processes, disputable proprietary monitoring metrics, and delayed credit notes issued at the provider's discretion.

SLASettle replaces subjective reporting with autonomous smart contracts:

- **Cryptographic Escrow**: Service providers lock token bonds (native XLM or Stellar assets) directly into the `sla_vault` smart contract upon agreement creation.
- **Independent Consensus**: A decentralized committee of registered watcher nodes monitors endpoints and submits signed health checks each round.
- **Deterministic Settlement**: When the number of verified `DOWN` checks reaches quorum (`floor(N/2) + 1`), anyone can trigger settlement on-chain. The vault transfers the penalty payout directly to the beneficiary's wallet.
- **Transparent Lifecycle**: Providers can top up active bonds, cancel unused SLAs, and reclaim remaining balances once commitments expire or terminate.

## Architecture at a Glance

The SLASettle ecosystem spans two primary repositories:

1. **[slasettle-vault](https://github.com/SLASettleHQ/slasettle-vault)**: Rust smart contracts compiled for the Soroban runtime on Stellar Protocol 28:
   - `watcher_registry`: Manages watcher authorization, check submissions, duplicate detection, and round tallying.
   - `sla_vault`: Escrows token collateral, manages SLA parameters, verifies consensus against the registry, and executes settlements.
2. **[slasettle-hub](https://github.com/SLASettleHQ/slasettle-hub)**: Off-chain infrastructure, client libraries, and interfaces:
   - `@slasettle/sdk`: TypeScript SDK for contract interactions, simulation, and transaction submission.
   - `apps/web`: Next.js 14 operations dashboard and public status portal with Freighter wallet support.
   - `services/indexer`: Serverless event indexing service deployed on Cloudflare Workers.
   - `services/watcher`: Autonomous Go daemon executing HTTP health probes and signing on-chain checks.
   - `apps/docs`: VitePress documentation site.

## Target Personas

- **Service Providers**: API companies, RPC node providers, cloud platforms, and oracle networks seeking to build customer trust through verifiable, bonded performance guarantees.
- **Beneficiaries & Customers**: Enterprises, decentralized applications, and protocol integrators requiring immediate financial compensation when mission-critical dependencies fail.
- **Watcher Operators**: Node operators and monitoring services participating in consensus by publishing cryptographically attested service health data.
- **Developers & Integrators**: Engineers embedding automated SLA escrow and status tracking into developer workflows, status pages, or billing systems.

## Current Network Status & Verification

- **Network**: Stellar Testnet (Protocol 28).
- **Contracts**:
  - `sla_vault`: `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`
  - `watcher_registry`: `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`
- **WASM Verification**: Local release builds match deployed Testnet WASM bytecode byte-for-byte with zero hash drift.
- **Wallet & Contract Operations**: Full lifecycle operations (create SLA, top up bond, cancel SLA, withdraw remaining bond) have been executed and verified live on Stellar Testnet using the Freighter browser extension on SLA #2.
- **Hosting Topology**:
  - Production Console: [slasettle-web.vercel.app](https://slasettle-web.vercel.app)
  - Hosted Indexer: [slasettle-indexer.slasettle-indexer.workers.dev](https://slasettle-indexer.slasettle-indexer.workers.dev)
  - Documentation: [slasettle-docs.vercel.app](https://slasettle-docs.vercel.app)
- **Security Audit Status**: Unaudited. The code has undergone extensive automated testing (416 tests across contract, SDK, indexer, and web suites) and internal static analysis, but has not yet completed a formal external third-party security audit. It is strictly intended for Testnet evaluation.
