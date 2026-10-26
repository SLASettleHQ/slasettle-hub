# Deployment Runbook

This guide details the procedure for compiling, deploying, configuring, and verifying the complete SLASettle infrastructure from source.

## Deployment Topology Overview

| Component | Target Platform | Hosted URL / Endpoint |
| :--- | :--- | :--- |
| **`watcher_registry`** | Stellar Testnet (Soroban) | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` |
| **`sla_vault`** | Stellar Testnet (Soroban) | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` |
| **`slasettle-web`** | Vercel Edge / Node | [https://slasettle-web.vercel.app](https://slasettle-web.vercel.app) |
| **`slasettle-docs`** | Vercel Static | [https://slasettle-docs.vercel.app](https://slasettle-docs.vercel.app) |
| **`slasettle-indexer`**| Cloudflare Workers + D1 | [https://slasettle-indexer.slasettle-indexer.workers.dev](https://slasettle-indexer.slasettle-indexer.workers.dev) |
| **Watcher Nodes** | Autonomous Bare-Metal / Cloud | Distributed node daemons |

---

## 1. Smart Contracts Deployment (Stellar Soroban)

### Step 1.1: Build Release WASMs
```bash
git clone https://github.com/SLASettleHQ/slasettle-vault.git
cd slasettle-vault
stellar contract build
```

Build artifacts land under `target/wasm32v1-none/release/` (the `wasm32v1-none` target, not `wasm32-unknown-unknown`):
- `target/wasm32v1-none/release/watcher_registry.wasm`
- `target/wasm32v1-none/release/sla_vault.wasm`

`stellar contract build` prints a `Wasm Hash` for each artifact — record it and compare against the hash you expect from the release-candidate build (see the authoritative hashes in the cutover document) before uploading anything.

### Step 1.2: Upload, Then Deploy From the Verified Hash

Deployment is two explicit, separately verifiable operations: upload the WASM to the ledger (which returns a hash), confirm that hash matches the known local build hash, and only then create the contract instance from that verified hash. (Flag names below come from this environment's installed Stellar CLI; `--source` is an alias for `--source-account`, and `--id` is an alias for `--contract-id`.)

```bash
# 1a. Upload watcher_registry's WASM — this installs the code without creating an instance.
stellar contract upload \
  --wasm target/wasm32v1-none/release/watcher_registry.wasm \
  --source-account <DEPLOYER> \
  --network testnet
# -> prints the installed WASM hash. Verify it equals the known local
#    SHA-256 (`stellar contract build`'s own "Wasm Hash" output) before
#    proceeding.

# 1b. Deploy an instance from that verified hash (not from --wasm again).
stellar contract deploy \
  --wasm-hash <VERIFIED_WATCHER_REGISTRY_HASH> \
  --source-account <DEPLOYER> \
  --network testnet
# -> prints the new contract instance's C... address.

# 2a. Upload sla_vault's WASM.
stellar contract upload \
  --wasm target/wasm32v1-none/release/sla_vault.wasm \
  --source-account <DEPLOYER> \
  --network testnet

# 2b. Deploy sla_vault's instance from its verified hash.
stellar contract deploy \
  --wasm-hash <VERIFIED_SLA_VAULT_HASH> \
  --source-account <DEPLOYER> \
  --network testnet
```

### Step 1.3: Initialize Contracts
```bash
# Initialize watcher_registry
stellar contract invoke \
  --contract-id <WATCHER_REGISTRY_ID> \
  --source-account <DEPLOYER> \
  --network testnet \
  -- initialize --admin <ADMIN_PUBLIC_KEY>

# Initialize sla_vault with watcher_registry binding
stellar contract invoke \
  --contract-id <SLA_VAULT_ID> \
  --source-account <DEPLOYER> \
  --network testnet \
  -- initialize --admin <ADMIN_PUBLIC_KEY> --watcher_registry <WATCHER_REGISTRY_ID>
```

### Step 1.4: Register Initial Watcher Committee
```bash
stellar contract invoke \
  --contract-id <WATCHER_REGISTRY_ID> \
  --source-account <DEPLOYER> \
  --network testnet \
  -- register_watcher --caller <ADMIN_PUBLIC_KEY> --watcher <WATCHER_1_KEY>
```

> **Every new contract deployment starts `NextSlaId` at 0.** SLA IDs are only unique *within one `sla_vault` deployment* — deploying a second instance (e.g. for a v0.2 cutover) and pointing it at the same indexer database as an earlier deployment will collide on `sla_id`. See `apps/docs/developers/v0.2-cutover.md` for why this requires a fresh, separate data store per deployment rather than reusing one.

---

## 2. Event Indexer Deployment (Cloudflare Workers)

The indexer is deployed as a serverless worker with Cloudflare D1 storage. Its source lives at `indexer/` (not `services/indexer`):

```bash
cd indexer

# Apply migrations to the bound D1 database (see wrangler.jsonc's d1_databases
# block for the binding/database_name/database_id this acts on).
npx wrangler d1 migrations apply <DATABASE_NAME> --remote

# Deploy to Cloudflare Workers
npx wrangler deploy
```

`WATCHER_REGISTRY_CONTRACT_ID` and `SLA_VAULT_CONTRACT_ID` are **public configuration** — Soroban contract addresses are visible to anyone who reads the chain — not secret material. They're set as plain `vars` in `indexer/wrangler.jsonc`, not via `wrangler secret put`. Only genuinely sensitive values (API keys, if any are added later) belong behind `wrangler secret put`.

---

## 3. Web Console Deployment (Vercel)

The Next.js frontend is configured for deployment to Vercel:

1. Connect the `SLASettleHQ/slasettle-hub` repository to Vercel.
2. Set Root Directory to `apps/web`.
3. Configure Environment Variables:
   - `NEXT_PUBLIC_SOROBAN_RPC_URL`: `https://soroban-testnet.stellar.org`
   - `NEXT_PUBLIC_NETWORK_PASSPHRASE`: `Test SDF Network ; September 2015`
   - `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID`: Deployed vault ID
   - `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID`: Deployed registry ID
   - `NEXT_PUBLIC_INDEXER_API_URL`: Hosted indexer worker URL
4. Trigger production deployment.

---

## 4. Documentation Site Deployment (Vercel)

The documentation site is built using VitePress:

1. Connect `SLASettleHQ/slasettle-hub` repository to Vercel.
2. Set Root Directory to `apps/docs`.
3. Set Build Command to `pnpm run build` and Output Directory to `.vitepress/dist`.
4. Deploy to `https://slasettle-docs.vercel.app`.
