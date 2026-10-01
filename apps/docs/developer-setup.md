# Developer setup

Two repositories. Neither depends on the other at build time; the hub's
services are pointed at the vault's deployed contract IDs through
environment variables (see [Environment variables](/environment-variables)),
not a source or package dependency.

## `slasettle-vault` (the contracts)

```bash
git clone https://github.com/SLASettleHQ/slasettle-vault
cd slasettle-vault
stellar contract build   # produces target/wasm32v1-none/release/*.wasm
cargo test --workspace
```

`sla_vault`'s source uses `soroban_sdk::contractimport!` against
`watcher_registry`'s already-built WASM file — this is a real build
dependency, not stylistic. **You must run `stellar contract build`
before `cargo check`/`test`/`clippy` on a clean checkout**, or the
`contractimport!` line fails with a file-not-found error. This is
exactly why the CI workflow builds before checking (see `.github/workflows/ci.yml`).

Toolchain actually verified this session: Rust/Cargo 1.97.1, Stellar CLI
27.0.0. See [Current Testnet deployment](/testnet-deployment) for why
the CLI version matters here (it's pinned to what was verified against
the live deployment, not necessarily the newest release).

## `slasettle-hub` (watcher, indexer, SDK, frontend)

```bash
git clone https://github.com/SLASettleHQ/slasettle-hub
cd slasettle-hub
pnpm install        # sets up apps/web and packages/sdk only
```

Toolchain, pinned and verified: Node 24.21.0 (`.nvmrc`), pnpm 12.8.2
(`packageManager` field), Go 1.25 (`watcher/go.mod`'s declared minimum, with a
`toolchain go1.25.14` line; verified with 1.25.1 and 1.25.14).

`indexer` and `watcher` are separate projects, set up independently:

```bash
cd indexer && npm ci
cd ../watcher && go build ./...
```

Copy each project's `.env.example` to `.env` and fill in real values —
see [Environment variables](/environment-variables) for every variable
and which are required, and for which of them each tool actually loads
from `.env` (the indexer's `npm start` does; the watcher never does). At minimum you need the two contract IDs from
[Current Testnet deployment](/testnet-deployment).

### Running it locally, in dependency order

1. The contracts are already deployed on Testnet (see
   [Current Testnet deployment](/testnet-deployment)) — you don't need
   to redeploy them to develop against the hub.
2. Start the indexer (`cd indexer && npm run build && npm start`, or
   see `indexer/README.md` for the dev command) — it needs
   `WATCHER_REGISTRY_CONTRACT_ID` and `SLA_VAULT_CONTRACT_ID` at
   minimum.
3. Start the frontend (`pnpm --filter @slasettle/web dev`) — it needs
   `NEXT_PUBLIC_INDEXER_API_URL` pointed at the indexer from step 2.
4. Optionally, run the watcher daemon (`cd watcher && go run
   ./cmd/watcher`) with a real funded Testnet keypair in
   `WATCHER_SECRET_KEY`. The daemon does not load `.env` itself; export
   its variables first (see [Environment variables](/environment-variables)).
   It was run live against Testnet on 2026-09-29 (see
   [Deployment topology](/deployment-topology)); nothing runs it
   continuously.

## Build and test everything

```bash
# slasettle-vault
cargo test --workspace

# slasettle-hub
pnpm run build && pnpm run lint && pnpm run typecheck && pnpm run test
cd indexer && npm run build && npm test
cd watcher && go build ./... && go vet ./... && go test ./...
```

See [Testing](/testing) for what these actually cover and what they
don't.
