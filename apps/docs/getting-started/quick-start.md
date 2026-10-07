# Quick Start Guide

Get started with SLASettle in under 5 minutes. This guide walks through setting up a wallet on Stellar Testnet, creating your first bonded SLA, verifying watcher checks, and triggering an on-chain settlement.

## Prerequisites

1. **Freighter Wallet Extension**: Install the [Freighter browser extension](https://www.freighter.app/).
2. **Switch to Testnet**: Open Freighter settings and switch network to **Testnet**.
3. **Fund Testnet Account**: Request test XLM from the [Stellar Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

## 1. Access the Production Console

Navigate to the live dashboard at:
👉 **[https://slasettle-web.vercel.app](https://slasettle-web.vercel.app)**

Click **Connect Wallet** in the top right corner. Authorize the connection in Freighter.

## 2. Create an SLA Agreement

1. From the dashboard, navigate to **Create SLA**.
2. Provide the following parameters:
   - **Beneficiary Address**: Enter the Stellar account (`G...`) that will receive payouts if an outage occurs.
   - **Collateral Token**: Enter the Stellar Asset Contract address (for native XLM on Testnet, use `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` or leave default).
   - **Bond Amount**: Collateral amount in stroops or display tokens (e.g., `100 XLM`).
   - **Penalty per Breach**: Amount paid out per breached round (e.g., `10 XLM`).
   - **Quorum Threshold**: Minimum number of `DOWN` votes required to trigger settlement (e.g., `3` for a 5-watcher committee).
   - **Uptime Target (bps)**: Basis points target (e.g., `9990` for 99.9%).
3. Click **Create SLA & Escrow Bond**.
4. Sign the transaction in Freighter. Once confirmed on Stellar, your new SLA ID (e.g., `SLA #2`) will appear in the dashboard.

## 3. Verify Health Checks in the Status Portal

Every round, registered watcher nodes probe the endpoint and submit checks to the `watcher_registry` contract.

- View the public status page at `/sla/[id]`.
- The interface queries both the on-chain contracts and the hosted indexer at `https://slasettle-indexer.slasettle-indexer.workers.dev`.
- Inspect:
  - Current round tallies (`votes_up` vs `votes_down`).
  - Active bond balance.
  - Historic settlement events.

## 4. Trigger Settlement

When an outage is detected and the number of `DOWN` votes meets or exceeds the quorum threshold:

1. Click the **Trigger Settlement** button on the SLA detail page for that round.
2. Sign the transaction with your wallet. (Settlement is permissionless; anyone can call it).
3. The `sla_vault` contract validates the round tally against `watcher_registry`, transfers the penalty to the beneficiary, and emits a `SettlementPaid` event.

## 5. Top Up or Close Out the Agreement

- **Top Up**: As penalties are deducted, the provider can top up the bond balance by selecting **Top Up Bond** and transferring additional tokens.
- **Cancel**: When the service commitment concludes, the provider clicks **Cancel SLA**.
- **Withdraw**: Once cancelled, the provider clicks **Withdraw Remaining Bond** to safely return remaining collateral to their account.
