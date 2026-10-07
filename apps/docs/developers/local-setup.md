# Local Development Setup

This runbook covers setting up the complete SLASettle local environment across both repositories (`slasettle-vault` and `slasettle-hub`).

## Verified Toolchain Versions

The codebase is built and tested against the following verified toolchain:

| Tool / Runtime | Verified Version | Configuration Location |
| :--- | :--- | :--- |
| **Rust / Cargo** | `1.84.0+` (verified `1.97.1`) | `rust-toolchain.toml` / system cargo |
| **Stellar CLI** | `28.1.0` (with `stellar-xdr 28.0.0`) | Host system binary (`stellar`) |
| **Node.js** | `v20.0.0+` (verified `v24.21.0`) | `.nvmrc` in repository root |
| **pnpm** | `9+` (verified `12.8.2`) | `packageManager` field in `package.json` |
| **Go** | `1.22+` (verified `1.25.1`) | `services/watcher/go.mod` |

---

## 1. Smart Contracts Repository (`slasettle-vault`)

```bash
git clone https://github.com/SLASettleHQ/slasettle-vault.git
cd slasettle-vault

# Build release WASM bytecode
stellar contract build

# Run contract test suites
cargo test --workspace
```

> [!IMPORTANT]
> `sla_vault` references `watcher_registry` via `soroban_sdk::contractimport!`. You **must** run `stellar contract build` before executing `cargo check`, `cargo test`, or `cargo clippy` on a fresh checkout, otherwise the macro cannot locate the companion WASM file.

---

## 2. Monorepo Infrastructure (`slasettle-hub`)

```bash
git clone https://github.com/SLASettleHQ/slasettle-hub.git
cd slasettle-hub

# Install root dependencies (SDK, Web, Docs)
pnpm install
```

### Building Workspace Packages
```bash
# Build TypeScript SDK and Next.js Web Console
pnpm run build

# Run linter and typechecks
pnpm run lint
pnpm run typecheck
```

---

## 3. Off-Chain Services Setup

### Event Indexer Service
```bash
cd services/indexer
npm ci
npm run build
npm test
```

### Watcher Node Daemon
```bash
cd services/watcher
go build ./...
go test ./...
```

---

## 4. Running the Local Development Stack

To run the full stack locally against Stellar Testnet:

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` in `apps/web` and `.env` in `services/indexer` with active contract addresses (see [Environment Configuration](/developers/environment)).
2. **Start Indexer**:
   ```bash
   cd services/indexer
   npm run dev
   ```
3. **Start Web Console**:
   ```bash
   pnpm --filter @slasettle/web dev
   ```
   Open `http://localhost:3000` in your browser.
4. **Start Documentation Portal**:
   ```bash
   pnpm --filter @slasettle/docs dev
   ```
   Open `http://localhost:5173` in your browser.
