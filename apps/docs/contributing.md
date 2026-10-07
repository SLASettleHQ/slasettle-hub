# Contributing Guide

Contributions to SLASettle are welcome across smart contracts, client libraries, user interfaces, documentation, and operational services.

## Canonical Repository Guidelines

Each repository maintains a dedicated `CONTRIBUTING.md` defining specific workflows and coding standards:

- [slasettle-vault/CONTRIBUTING.md](https://github.com/SLASettleHQ/slasettle-vault/blob/main/CONTRIBUTING.md) — Rust smart contracts and Soroban test suites.
- [slasettle-hub/CONTRIBUTING.md](https://github.com/SLASettleHQ/slasettle-hub/blob/main/CONTRIBUTING.md) — Monorepo workspace (SDK, web console, indexer, watcher daemon, documentation).

---

## Local Verification Commands

All pull requests must pass the complete CI verification pipeline locally:

```bash
# 1. Smart Contracts (slasettle-vault)
stellar contract build
cargo test --workspace

# 2. Hub Workspace Packages (slasettle-hub)
pnpm install --frozen-lockfile
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test

# 3. Off-Chain Services
cd services/indexer && npm ci && npm run build && npm test
cd ../watcher && go build ./... && go vet ./... && go test ./...
```

For full environment prerequisites, see [Local Development Setup](/developers/local-setup).

---

## Coordinated Contract & Application PRs

If a pull request introduces changes to Soroban contract interfaces (method arguments, data structures, event topics, or numeric error codes):
1. Create a pull request in `SLASettleHQ/slasettle-vault` with the contract modification and passing tests.
2. Create a corresponding pull request in `SLASettleHQ/slasettle-hub` updating `@slasettle/sdk`, `apps/web`, and `services/indexer`.
3. Cross-reference both pull requests in their descriptions.
