# Current Testnet Deployment

This page records the active Stellar Testnet deployment, contract identities, WASM bytecode hashes, and verified on-chain evidence for SLASettle.

> [!NOTE]
> All addresses and artifacts described on this page reside on **Stellar Testnet**. Nothing in this repository is deployed to Stellar Mainnet.
>
> The contract pair below was built and deployed under **Protocol 28** — that is a fact about the deployment's history, not a claim about the network's current protocol. Stellar Testnet's protocol version advances independently of this repository (it is at Protocol 29 as of 2026-10-26, confirmed live via `getNetwork` against `https://soroban-testnet.stellar.org`). Always re-verify the current network protocol on deployment day rather than assuming it still matches what's recorded here.

---

## Active Deployed Contracts (built under Protocol 28)

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

The table above is **still the pair that serves public Production** (`slasettle-web.vercel.app`). It has not changed.

---

## GREEN v0.2 Testnet Deployment (isolated — not production)

A separate, isolated v0.2 contract pair, indexer, and D1 have been deployed on the same Stellar Testnet, built under Protocol 29 with `soroban-sdk 29.0.1`, as the blue/green cutover's GREEN side (see [`developers/v0.2-cutover.md`](/developers/v0.2-cutover)). This is **not** a replacement for the table above — blue remains production.

| Contract Name | Contract ID | Deployed WASM SHA-256 Hash |
| :--- | :--- | :--- |
| **`watcher_registry`** | `CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY` | `e433b7e36580889b1a2aa94570ed7adee7e9048d4d211a10031ffcfa8fc53171` |
| **`sla_vault`** | `CA5R7V5IGMYOBRSAMP4R5MWURSNTY6565NSKEEVR6626PLC3VM2A3EZ2` | `23ea6cdc28a11883fd5979c06fcdea3b3f68a5b2aa9f0bace855de0149d8ac79` |

- **Indexer**: `https://slasettle-indexer-v02.slasettle-indexer.workers.dev`, D1 `slasettle-indexer-v02` (id `17b47ce0-bdc6-46eb-ba72-0513804b7827`), fully separate from blue's D1 and Worker.
- **Watchers**: `slasettle-v02-watcher-1/2/3`, three **project-controlled Testnet identities** created for this demonstration — not independent or community-operated.
- **Web**: a Vercel Preview deployment, gated behind Vercel's own deployment-protection (not a public URL).

### Live lifecycle verification (2026-10-26)

A full SLA lifecycle was exercised end-to-end through this green stack — Preview Web with a real connected Freighter wallet, real Testnet transactions throughout, blue verified untouched before and after:

1. **Create** (SLA #0, native XLM bond, quorum 2-of-3, penalty 1 XLM, beneficiary = green admin): tx `3ad48c0f3880b1cb02f56240dbd37bb72a1d75f2e1fb908116b922b7666a9223`.
2. **Top up** (+1 XLM, bond → 6 XLM): tx `4f89490741a07aa2879fbc9dc8446decf9c0ec1ffc84eea9377d0330b66e36b2`.
3. **Watcher votes**: all three project-controlled watchers independently probed the committed endpoint, observed it Down (HTTP 404), and submitted one check each in round `29883523` — `down_count = 3`, `up_count = 0`, isolated correctly from a deliberately wrong endpoint hash (tally `0/0`).
4. **Settlement** triggered through Preview: tx `bf43521f19206ad4afe99d3472fcf6c67d6e4f7365c67a80c603b77bad97a085` — bond 6 → 5 XLM, beneficiary balance +1.0000000 XLM exactly. A duplicate settlement attempt was simulated read-only and correctly rejected (`AlreadySettled`), with no second transaction submitted.
5. **Cancel** through Preview: tx `0c82c70fdf0fbfcad09af66987212de46bdc7bcf404139d6e497588df60a264c`. A duplicate cancel was simulated read-only and correctly rejected (`SlaNotActive`).
6. **Withdraw remaining bond** through Preview: tx `bd8dde214400dbc55f8f31f64bffbc44e6a562db34d49de1a285b1ce2b1666e4` — bond 5 → 0 XLM.
7. The green indexer ingested every step correctly (SLA row, lifecycle events, settlement row, per-watcher check rows) with no raw endpoint URL stored anywhere, only its SHA-256 commitment. The Preview UI's live endpoint verifier confirmed `MATCH` for the exact committed endpoint string and `DOES NOT MATCH` for the same string with a trailing slash added.

This demonstration also found and fixed a real bug: the Go watcher's generic Soroban value decoder had no case for `i128` or `vec` ScVals, so it failed reading `get_sla` entirely (needed for the endpoint-commitment pre-flight check) against a real deployed `SLAConfig`. Fixed in `watcher/internal/contract/contract.go` with new regression tests.

Blue (`slasettle-web.vercel.app`, its Worker, its D1, and its v0.1 contracts) was confirmed healthy and unchanged before, during, and after this entire demonstration.

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
