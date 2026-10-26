---
layout: home
hero:
  name: SLASettle
  text: Bonded, Per-Round Service Level Agreements on Stellar Soroban
  tagline: Providers lock collateral; registered watchers submit endpoint-bound availability votes; a quorum of Down attestations permits a deterministic, capped penalty payment. Stellar Testnet prototype, not audited.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/overview
    - theme: alt
      text: How It Works
      link: /getting-started/how-it-works
    - theme: alt
      text: Protocol Architecture
      link: /protocol/architecture
    - theme: alt
      text: Testnet Deployment
      link: /testnet-deployment

features:
  - title: Bonded Settlement
    details: Service providers lock native XLM or token bonds in Soroban smart contracts. Once a round reaches quorum, settlement is permissionless — anyone can trigger the on-chain payout to the beneficiary, but it is not automatically scheduled.
  - title: Registered Watcher Quorum
    details: Watcher daemons probe an endpoint-bound commitment every round and submit signed observations. A quorum of registered watchers (currently 3 project-controlled Testnet identities, 2-of-3) must attest Down before settlement is possible — this does not prove independent, Byzantine-fault-tolerant observation.
  - title: Modular Soroban Contracts
    details: Clean separation of concerns between WatcherRegistry (identity, check collection, round tallies) and SLAVault (lifecycle, escrow, payouts, cancellations).
  - title: Full-Stack Developer Ecosystem
    details: Complete TypeScript SDK, event indexer on Cloudflare Workers, autonomous Go watcher daemon, and Next.js operations console with Freighter wallet integration.
---
