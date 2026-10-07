# Public Status Page Guide

Every SLA created on SLASettle features a dedicated, public status page accessible to customers, auditors, and external observers without requiring a wallet connection.

- **URL Pattern**: `https://slasettle-web.vercel.app/status/[slaId]`
- **Live Example**: [https://slasettle-web.vercel.app/status/2](https://slasettle-web.vercel.app/status/2)

## Architectural Design

The public status page is intentionally non-custodial and read-optimized:
- **Zero Authentication Required**: Any user or customer can inspect real-time uptime metrics and bond health without installing browser extensions or connecting a wallet.
- **Dual-Data Architecture**:
  1. Real-time round health and historical payouts are loaded from the high-speed indexer API (`https://slasettle-indexer.slasettle-indexer.workers.dev`).
  2. Active bond balances, contract parameters, and current status are queried directly from Stellar Soroban RPC via `@slasettle/sdk`.
  3. If the indexer is temporarily unreachable, the interface gracefully degrades to direct on-chain RPC reads.

## Status Page Components

### 1. Header & Agreement Metadata
Displays essential contractual commitments:
- **SLA ID**: Numerical agreement index.
- **Service Provider**: Stellar public key of the infrastructure provider.
- **Beneficiary**: Stellar public key of the client entitled to breach compensation.
- **Agreement Status**: `Active` (green badge) or `Cancelled` (gray badge).
- **Target Availability**: Basis points display (e.g. 99.90%).

### 2. Live Round Clock & Indicator
- Displays current round sequence number.
- Synchronized to the network reference clock via `GET /v1/clock` to avoid client computer clock drift.
- Shows time remaining until the active round observation window closes.

### 3. Watcher Consensus Grid
- Visual matrix listing all registered watcher nodes.
- Shows real-time attestation status for the active round:
  - `UP` (Green): Watcher confirmed endpoint was reachable and healthy.
  - `DOWN` (Red): Watcher reported HTTP error, timeout, or unreachable target.
  - `PENDING` (Gray): Watcher has not yet submitted an attestation for this round.

### 4. Quorum Progress Meter
- Visual progress bar tracking `votes_down` against the agreement's `quorum_threshold`.
- If `votes_down < quorum_threshold`, the meter indicates normal or non-breached operation.
- If `votes_down >= quorum_threshold`, the meter highlights breach consensus and activates the settlement action.

### 5. Escrow Collateral Card
- Displays remaining token collateral locked in `sla_vault`.
- Shows initial bond amount and per-incident penalty amount.
- Illustrates remaining breach capacity before bond exhaustion.

### 6. Historical Settlement Table
- Detailed log of all historical breach settlements executed for the SLA.
- Each row records:
  - **Round ID**: Specific round in which the breach occurred.
  - **Settled Timestamp**: Block/ledger timestamp when the payout occurred.
  - **Payout Amount**: Exact tokens transferred to the beneficiary.
  - **Explorer Link**: Direct link to the Stellar Testnet block explorer (e.g. StellarExpert) verifying the transaction envelope and event emission.

### 7. Trigger Settlement Action
- If a breach is confirmed in the current round, any observer can connect a Freighter wallet and click **Trigger Settlement**.
- The interface automatically constructs the transaction and submits it to the Stellar ledger, instantly paying the penalty to the beneficiary.
