---
layout: home
hero:
  name: SLASettle
  text: Decentralized Service Level Agreement Settlement on Stellar Soroban
  tagline: Autonomous uptime verification, multi-watcher consensus, and automated bond penalties on Stellar Testnet.
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
  - title: Autonomous Bond Settlement
    details: Service providers lock native XLM or token bonds in Soroban smart contracts. Breaches trigger immediate on-chain settlement to beneficiaries without human intermediaries.
  - title: Multi-Watcher Consensus
    details: Independent watcher nodes probe endpoints every round and submit cryptographically signed observations. A strict quorum (floor(N/2) + 1) guarantees fault tolerance.
  - title: Modular Soroban Contracts
    details: Clean separation of concerns between WatcherRegistry (identity, check collection, round tallies) and SLAVault (lifecycle, escrow, payouts, cancellations).
  - title: Full-Stack Developer Ecosystem
    details: Complete TypeScript SDK, event indexer on Cloudflare Workers, autonomous Go watcher daemon, and Next.js operations console with Freighter wallet integration.
---
