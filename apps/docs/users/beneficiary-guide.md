# Beneficiary Guide

This guide explains how customers, infrastructure consumers, and enterprise beneficiaries verify on-chain SLA agreements, monitor uptime, and collect automated penalty payouts.

## Role of the Beneficiary

As a beneficiary, you are designated in an SLA configuration to receive penalty transfers whenever a provider breaches availability commitments. Unlike traditional SLAs:
- You do not need to submit support tickets or claim forms.
- Compensation is paid directly to your on-chain address in liquid tokens (e.g. XLM or Stellar assets).
- Payouts are enforced by smart contracts rather than provider discretion.

## 1. Verifying Agreement Terms

Before relying on an infrastructure provider's SLA guarantee, inspect the agreement on the public status page (`/status/[slaId]`):

1. **Beneficiary Address**: Ensure the configured `beneficiary` address matches your Stellar account.
2. **Escrow Balance**: Verify the `bond_balance` holds sufficient collateral to cover anticipated downtime penalties.
3. **Penalty Per Breach**: Confirm the compensation amount matches your commercial contract.
4. **Quorum Threshold**: Verify the quorum requirement (e.g. 3 of 5 watchers) represents a robust majority of the active committee.
5. **Contract Addresses**: Confirm the SLA is created on the official verified `sla_vault` contract.

## 2. Real-Time Availability Monitoring

On the SLA status page:
- **Round Clock**: Displays the active round timer powered by `/v1/clock`.
- **Watcher Committee Grid**: Displays each registered watcher node and its attestation (`UP` or `DOWN`) for the current round.
- **Quorum Meter**: Visual progress bar indicating how many `DOWN` votes have been recorded against the required `quorum_threshold`.
- **Historical Settlements**: A chronological log of past payouts, including ledger timestamps and direct links to Stellar Testnet transaction explorers.

## 3. Triggering Settlement

When downtime occurs and registered watchers vote `DOWN`:

1. As soon as `DOWN` votes meet or exceed `quorum_threshold`, the **Trigger Settlement** button activates on the status page.
2. Connect your Freighter wallet (or any funded Stellar account).
3. Click **Trigger Settlement** and confirm the transaction.
4. **Instant Transfer**: The smart contract transfers `min(penalty_per_breach, remaining_bond)` directly to your beneficiary wallet.
5. **Permissionless Execution**: Anyone can call this function. Even if you are offline, automated bots or keepers can execute the settlement on your behalf, and funds will still land directly in your wallet.
