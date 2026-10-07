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

### Step 1.2: Deploy Contracts
```bash
# 1. Deploy watcher_registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/watcher_registry.wasm \
  --source admin-account \
  --network testnet

# 2. Deploy sla_vault
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/sla_vault.wasm \
  --source admin-account \
  --network testnet
```

### Step 1.3: Initialize Contracts
```bash
# Initialize watcher_registry
stellar contract invoke \
  --id <WATCHER_REGISTRY_ID> \
  --source admin-account \
  --network testnet \
  -- initialize --admin <ADMIN_PUBLIC_KEY>

# Initialize sla_vault with watcher_registry binding
stellar contract invoke \
  --id <SLA_VAULT_ID> \
  --source admin-account \
  --network testnet \
  -- initialize --admin <ADMIN_PUBLIC_KEY> --watcher_registry <WATCHER_REGISTRY_ID>
```

### Step 1.4: Register Initial Watcher Committee
```bash
stellar contract invoke \
  --id <WATCHER_REGISTRY_ID> \
  --source admin-account \
  --network testnet \
  -- register_watcher --caller <ADMIN_PUBLIC_KEY> --watcher <WATCHER_1_KEY>
```

---

## 2. Event Indexer Deployment (Cloudflare Workers)

The indexer is deployed as a serverless worker with Cloudflare D1 storage:

```bash
cd services/indexer

# Run local schema migration
npm run db:migrate

# Deploy to Cloudflare Workers
npx wrangler deploy
```

Set secret environment variables in Cloudflare dashboard or via CLI:
```bash
npx wrangler secret put WATCHER_REGISTRY_CONTRACT_ID
npx wrangler secret put SLA_VAULT_CONTRACT_ID
```

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
