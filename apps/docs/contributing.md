# Contributing

Each repository has its own canonical `CONTRIBUTING.md`; this page
points to them rather than duplicating their content, so they don't
drift apart:

- [`slasettle-vault/CONTRIBUTING.md`](https://github.com/SLASettleHQ/slasettle-vault/blob/main/CONTRIBUTING.md) — the two Soroban contracts.
- [`slasettle-hub/CONTRIBUTING.md`](https://github.com/SLASettleHQ/slasettle-hub/blob/main/CONTRIBUTING.md) — watcher, indexer, SDK, frontend.

## The short version

Both repositories run the exact commands their CI runs — there is no
separate "contributor" command set:

```bash
# slasettle-vault
stellar contract build      # required before check/test/clippy — see Developer setup
cargo test --workspace

# slasettle-hub
pnpm install --frozen-lockfile
pnpm run build && pnpm run lint && pnpm run typecheck && pnpm run test
cd indexer && npm ci && npm run build && npm test
cd watcher && go build ./... && go vet ./... && go test ./...
```

See [Developer setup](/developer-setup) for the full toolchain versions
and dependency order.

## Two repositories, one cross-cutting rule

If a change to `slasettle-vault`'s contract interface (a function
signature, an event shape, an error code) would break `slasettle-hub`'s
indexer, SDK, or frontend, that needs to be called out explicitly in the
pull request description — there's no automated check across the
repository boundary today. Contract changes and their corresponding hub
changes should generally land as a coordinated pair of pull requests,
not silently drift.

## PR #8

[`slasettle-hub#8`](https://github.com/SLASettleHQ/slasettle-hub/pull/8)
(`chore(deps-dev): bump eslint from 9.39.5 to 10.11.0`) was closed without
merging because ESLint 10 is not compatible with the current lint stack. The
project intentionally stays on ESLint 9.x and does not claim ESLint 10 support.
