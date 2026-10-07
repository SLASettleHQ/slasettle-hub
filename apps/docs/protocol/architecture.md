# System Architecture

SLASettle is structured as an end-to-end decentralized settlement stack spanning Stellar Soroban smart contracts, off-chain monitoring nodes, indexing infrastructure, client libraries, and a web console.

## Architecture Diagram

```text
                               +------------------------------------------+
                               |              Stellar Testnet             |
                               |               (Protocol 28)              |
                               +------------------------------------------+
                                     |                              |
                                     v                              v
                    +--------------------------------+   +--------------------+
                    |        watcher_registry        |   |     sla_vault      |
                    | (Identity, Attestation Checks, |   | (Collateral Escrow,|
                    |        Round Tallies)          |   |  Quorum Logic,     |
                    +--------------------------------+   |  Payout Execution) |
                                     ^                   +--------------------+
                                     |                              ^
                                     | submit_check(...)            | Cross-contract read:
                                     |                              | get_round_tally(...)
                                     |                              |
               +--------------------------------------+             | trigger_settlement(...)
               |          Independent Watchers        |             |
               | (Autonomous Go Node Daemons probing) |             |
               +--------------------------------------+             |
                                     |                              |
                                     | Contract Events              |
                                     v                              |
                    +--------------------------------+              |
                    |        slasettle-indexer       |              |
                    |      (Cloudflare Workers /     |              |
                    |        D1 Event Cache)         |              |
                    +--------------------------------+              |
                                     |                              |
                                     | REST API                     |
                                     v                              |
                    +--------------------------------+              |
                    |         slasettle-web          |              |
                    |    (Next.js 14 Console &       |--------------+
                    |     Public Status Portal)      |  Direct RPC Read & Unsigned Tx
                    +--------------------------------+
                                     |
                                     v
                    +--------------------------------+
                    |        Freighter Wallet        |
                    |     (Browser Extension Signer) |
                    +--------------------------------+
```

## Repository Boundary

The project is strictly separated across two repositories:

1. **`SLASettleHQ/slasettle-vault`**:
   - Contains pure Rust smart contracts for the Soroban runtime.
   - Deploys `watcher_registry` and `sla_vault`.
   - Has zero runtime dependencies on web or off-chain packages.
   - Compiles via `stellar contract build` against `soroban-sdk 28.0.0`.

2. **`SLASettleHQ/slasettle-hub`**:
   - Monorepo containing:
     - `@slasettle/sdk`: TypeScript SDK for contract interactions, simulation, and types.
     - `apps/web`: Next.js 14 dashboard and public status portal.
     - `services/indexer`: Serverless event indexing service deployed on Cloudflare Workers.
     - `services/watcher`: Autonomous Go daemon performing HTTP probing and signing check transactions.
     - `apps/docs`: VitePress documentation portal.
   - Integrates with the contracts exclusively via RPC endpoints and contract addresses supplied via environment configuration.

## Authoritative State Hierarchy

1. **On-Chain Soroban State (Authoritative Source of Truth)**:
   - All balance accounting, SLA parameters, active/cancelled states, registered watcher keys, round tallies, and settlement flags reside exclusively on the Stellar ledger.
   - No off-chain component can modify, simulate, or override state without an on-chain transaction confirmed by Stellar consensus validators.

2. **Off-Chain Indexer Database (Derived Read Cache)**:
   - Consumes Soroban ledger events (`CheckSubmitted`, `SlaCreated`, `BondToppedUp`, `SettlementPaid`, `SlaCancelled`, `BondWithdrawn`).
   - Maintains an indexed cache for fast UI loading, round timeline graphs, and historic analytics.
   - **Fault Tolerance**: If the indexer is offline or lagging, the web console falls back to direct Soroban RPC queries via `@slasettle/sdk`. The integrity of funds and settlement is completely decoupled from indexer uptime.

3. **Client Frontend State (Ephemeral View Model)**:
   - The web console does not persist private user state or custom databases.
   - Uses React Query and direct RPC reads to guarantee zero client-side state divergence.
   - Does not assume transaction success from submission receipt; polls Soroban RPC until transaction execution is finalized.

## Wallet Security Boundary

To protect user collateral and operational integrity:
- **Zero Private Keys in Frontend/SDK**: The web dashboard and TypeScript SDK never generate, store, transmit, or ingest private keys or secret seeds.
- **Unsigned Transaction Pipeline**: All write operations (`createSla`, `topUpBond`, `cancelSla`, `withdrawRemainingBond`, `triggerSettlement`) are constructed as unsigned XDR transaction envelopes by the SDK.
- **Hardware/Extension Signing**: The unsigned XDR is passed to `@stellar/freighter-api`. The user reviews the decoded operation parameters and signs inside the sandboxed Freighter browser extension.
