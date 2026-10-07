# Current Testnet Deployment

This page records the active Stellar Testnet deployment, contract identities, WASM bytecode hashes, and verified on-chain evidence for SLASettle.

> [!NOTE]
> All addresses and artifacts described on this page reside on **Stellar Testnet** (Protocol 28). Nothing in this repository is deployed to Stellar Mainnet.

---

## Active Deployed Contracts (Protocol 28)

Deployed and verified on Stellar Testnet with `soroban-sdk 28.0.0` and `stellar-cli 28.1.0`:

| Contract Name | Contract ID | Deployed WASM SHA-256 Hash |
| :--- | :--- | :--- |
| **`watcher_registry`** | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | `5478788ea6c6ae46ddb85c399015139d3b883b7c253dd9abe50e096bf0bcdfb5` |
| **`sla_vault`** | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | `e177a76f3888575c3c9666689ab905e25a1b3001fb4d85045d05ee43fa298bcd` |

- **Network**: Stellar Testnet
- **Network Passphrase**: `Test SDF Network ; September 2015`
- **RPC URL**: `https://soroban-testnet.stellar.org`
- **Admin & Deployer**: `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`
- **Native XLM Stellar Asset Contract (SAC)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

---

## Bytecode Parity & Verification

In Phase 8 and Phase 9 audits:
- The local release WASM files compiled from `slasettle-vault` `main` match the bytecode fetched directly from Testnet via `stellar contract fetch` byte-for-byte.
- No WASM hash drift or interface mismatch exists between repository source and live Testnet deployment.

---

## Live Operational Evidence

### 1. Browser & Freighter Wallet Verification (Phase 7, 2026-10-07)
A complete, live browser verification pass using the Freighter wallet extension was conducted on the hosted frontend ([slasettle-web.vercel.app](https://slasettle-web.vercel.app)) against the current deployment on **SLA #2**:
1. **Wallet Connection**: Successfully connected Freighter, displaying active public key and network verification.
2. **SLA Creation**: Created SLA #2 with initial bond escrow of 1.0 XLM (`10,000,000` stroops).
3. **Bond Top-Up**: Executed top-up transaction depositing an additional 0.5 XLM (`5,000,000` stroops), bringing total escrow balance to 1.5 XLM (`15,000,000` stroops).
4. **SLA Cancellation**: Executed `cancel_sla`, transitioning status to `Cancelled`.
5. **Collateral Withdrawal**: Executed `withdraw_remaining_bond`, returning the complete `15,000,000` stroop balance to the provider address.

### 2. On-Chain Settlement Verification (SLA #0)
- **Settlement Transaction**: `70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b`
- Successfully evaluated 3 `DOWN` votes against quorum of 3 and transferred penalty payout to beneficiary.
- Second settlement attempt on the same round rejected with `Error::AlreadySettled` (Code `#4`), verifying on-chain idempotency.

### 3. Edge Case & Error Validations
- `create_sla` with `quorum_threshold = 0` rejected with `Error::InvalidAmount` (Code `#7`).
- Repeat `withdraw_remaining_bond` on an empty bond rejected with `Error::InvalidAmount` (Code `#7`).

---

## Hosted Services Infrastructure

| Service | Host / Platform | URL |
| :--- | :--- | :--- |
| **Web Console** | Vercel | [https://slasettle-web.vercel.app](https://slasettle-web.vercel.app) |
| **Documentation** | Vercel | [https://slasettle-docs.vercel.app](https://slasettle-docs.vercel.app) |
| **Event Indexer** | Cloudflare Workers + D1 | [https://slasettle-indexer.slasettle-indexer.workers.dev](https://slasettle-indexer.slasettle-indexer.workers.dev) |

---

## Historical Deployments (Superseded)

### 2026-09-27 Deployment Pair
- `watcher_registry`: `CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`
- `sla_vault`: `CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL`
- Deployed with `soroban-sdk 27.0.6` on Protocol 27. Superseded on 2026-10-01 by the Protocol 28 pair.
