# Service Provider Guide

This guide walks service providers through deploying, funding, managing, and decommissioning bonded Service Level Agreements using the SLASettle web console and Freighter wallet.

## Prerequisites

1. **Freighter Wallet**: Install [Freighter](https://www.freighter.app/) in your browser.
2. **Network Selection**: Set Freighter to **Testnet** (RPC: `https://soroban-testnet.stellar.org`, Network Passphrase: `Test SDF Network ; September 2015`).
3. **Wallet Collateral**: Ensure your provider address has sufficient native XLM for transaction fees and the agreement bond. Request test XLM from Stellar Friendbot if needed.

## 1. Connecting to the Provider Dashboard

1. Navigate to the web console: [https://slasettle-web.vercel.app/dashboard](https://slasettle-web.vercel.app/dashboard).
2. Click **Connect Wallet** in the top navigation bar.
3. Review and approve the Freighter connection prompt.
4. The network badge should display `Testnet` with a green indicator. (If marked yellow or red, adjust Freighter network settings).

## 2. Creating an SLA

In the **Create SLA** panel, specify your agreement parameters:

- **Beneficiary Address**: The public Stellar address (`G...`) of the customer or partner who receives compensation in case of downtime.
- **Collateral Token**: The Stellar Asset Contract address. Defaults to native XLM (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`).
- **Initial Bond Amount**: The total collateral locked into escrow (e.g., `100 XLM`).
- **Penalty Per Breach**: The fixed payout transferred to the beneficiary for every single round in which downtime is attested (e.g., `10 XLM`).
  - *Constraint*: Must be greater than 0 and less than or equal to the bond amount.
- **Quorum Threshold**: The minimum number of `DOWN` votes required from registered watchers before a payout can execute (e.g., `3` out of 5 watchers).
- **Uptime Target (bps)**: Desired availability target in basis points (e.g., `9990` for 99.9%).

Click **Create Agreement**. Review the decoded Soroban transaction parameters in Freighter and confirm. Once confirmed, your new SLA appears with status `Active`.

## 3. Monitoring Agreement Health

From the provider dashboard:
- View your active agreements, remaining bond balances, and historical breach payouts.
- Click the SLA ID to open its public status page (`/status/[slaId]`).
- Track round-by-round watcher attestations in real time.

## 4. Topping Up Escrow Collateral

If downtime settlements deplete your bond balance:
1. Locate the agreement in your dashboard and click **Top Up Bond**.
2. Enter the additional collateral amount.
3. Confirm the transaction in Freighter.
4. The `BondToppedUp` event updates your balance on-chain immediately.

## 5. Decommissioning an Agreement

When your service contract ends or you wish to reclaim collateral:

### Step 1: Cancel Agreement
1. In the agreement management panel, click **Cancel SLA**.
2. Review the confirmation dialog acknowledging that cancellation is irreversible.
3. Sign the transaction in Freighter. The agreement transitions to `Cancelled`.

### Step 2: Withdraw Remaining Collateral
1. After cancellation is confirmed on-chain, click **Withdraw Remaining Bond**.
2. Sign the transaction in Freighter.
3. The vault contract transfers the exact remaining balance back to your wallet and zeroes the escrow record.
