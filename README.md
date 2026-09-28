# slasettle-hub

The watcher daemon, event indexer, TypeScript SDK, and frontend for
SLASettle. The Soroban contracts (`watcher_registry` and `sla_vault`)
live in the separate repository
[`slasettle-vault`](https://github.com/SLASettleHQ/slasettle-vault); this
repository never defines contract logic, only the off-chain services and
UI that talk to it.

Testnet only, for now. Nothing here has been audited; see
[`SECURITY.md`](./SECURITY.md).

## What SLASettle is

A Stellar-based service backs its uptime promise with a real bond.
Independent watchers report whether the service was up or down each
round; when enough of them agree it was down, `sla_vault` pays a fixed
penalty to the beneficiary out of the bond, permissionlessly. Full
contract-level detail is in `slasettle-vault`'s `SLASettle-contract-spec.md`.

## Repository structure

```
apps/web        Next.js frontend: landing page, wallet-gated dashboard,
                 public per-SLA status page
packages/sdk     TypeScript bindings for the contracts and SEP-41 token
                 metadata; unsigned-transaction builders only, never
                 signs or holds a key
indexer          Indexes the two contracts' events into SQLite and
                 serves them over a small HTTP API
watcher          The independent Go daemon that checks an endpoint each
                 round and submits its vote
```

`apps/web` and `packages/sdk` share a single pnpm workspace at the
repository root (`pnpm-workspace.yaml`). `indexer` is a separate npm
project with its own lockfile. `watcher` is a separate Go module. Each has
its own README with more detail than this file repeats.

## Setup

```bash
pnpm install
```

installs `apps/web` and `packages/sdk`. `indexer` and `watcher` are set up
independently; see their own READMEs (`indexer/README.md`,
`watcher/README.md`).

Toolchain, pinned and verified against what actually builds and tests
this repository:

- Node 24.21.0 (`.nvmrc`)
- pnpm 12.4.2 (`packageManager` field)
- Go 1.25 (`watcher/go.mod`'s declared minimum; 1.25.1 was what was
  actually verified locally, current CI runners use whatever 1.25.x is
  current, which also picks up Go's own stdlib security patches)

## Environment variables

`apps/web/.env.example`:

```text
NEXT_PUBLIC_SOROBAN_RPC_URL
NEXT_PUBLIC_NETWORK_PASSPHRASE
NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID
NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID
NEXT_PUBLIC_INDEXER_API_URL
```

`packages/sdk` reads the first four of those directly (it has no config
file of its own). None have defaults; a missing one throws a named error
rather than proceeding with a guessed value.

`indexer/.env.example`:

```text
WATCHER_REGISTRY_CONTRACT_ID   (required)
SLA_VAULT_CONTRACT_ID          (required)
RPC_URL                        (default: Testnet)
NETWORK_PASSPHRASE             (default: Testnet)
DB_PATH, HTTP_PORT, POLL_INTERVAL_MS, MAX_LEDGERS_PER_REQUEST,
ROUND_LENGTH_SECONDS, START_LEDGER, ALLOWED_ORIGINS, LOG_LEVEL
```

`ALLOWED_ORIGINS` is the indexer's CORS allowlist (comma-separated exact
origins, never a wildcard); see `indexer/README.md` for the full table.

`watcher/.env.example`:

```text
WATCHER_REGISTRY_CONTRACT_ID, WATCHER_SECRET_KEY, TARGET_URL, SLA_ID
RPC_URL, NETWORK_PASSPHRASE, ROUND_LENGTH_SECONDS,
HTTP_TIMEOUT_SECONDS, HTTP_EXPECT_MAX_STATUS
```

`WATCHER_SECRET_KEY` is a real Stellar secret key. It is read once from
the environment, never logged, and `.env` (as opposed to `.env.example`)
is gitignored in that directory.

## Build and test

```bash
pnpm run build       # sdk, then web
pnpm run lint
pnpm run typecheck
pnpm run test         # sdk + web
```

```bash
cd indexer && npm ci && npm run build && npm test
```

```bash
cd watcher && go build ./... && go vet ./... && go test ./...
```

## Continuous integration and dependency maintenance

`.github/workflows/ci.yml` runs three jobs on every push to `main` and
every pull request against it: web-and-sdk (build/lint/typecheck/test),
indexer (build/test), watcher (build/vet/test). `main` is currently green.

Dependabot is configured (`.github/dependabot.yml`) for `npm` (both the
pnpm workspace root and `indexer` separately), `gomod` (`watcher`), and
`github-actions`, weekly. Several real dependency PRs have already been
merged (Next.js, `@types/node`, `eslint-config-next`, `jsdom`, `tsx`,
`@types/better-sqlite3`, `go-stellar-sdk`). One remains open pending a
separate compatibility decision:
[SLASettleHQ/slasettle-hub#8](https://github.com/SLASettleHQ/slasettle-hub/pull/8)
(ESLint 9 to 10), not merged, not modified.

`main` is branch-protected: pull requests are required, all three CI jobs
above are required status checks, force pushes and branch deletion are
disabled. Required approving reviews are set to 0, since this is
currently a solo-maintained repository.

## Current Testnet status

The contracts this repository's services point at, as of 2026-09-27:

```text
watcher_registry: CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6
sla_vault:        CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL
```

Full live evidence (real SLA creation, real watcher votes, a real
settlement, cancellation, withdrawal) is in `slasettle-vault`'s
`evidence/testnet-2026-09-27.md`. That evidence was gathered against
`sla_vault` built with `soroban-sdk` 27.0.6; `slasettle-vault`'s `main`
has since moved to `soroban-sdk` 28.0.0, so the currently deployed
contracts no longer match what that repository's current source builds.
See its README for the exact detail. This repository's indexer and
frontend point at the deployed contract IDs regardless of which SDK
version built them; that gap is a `slasettle-vault` concern, not this
repository's.

A live, end-to-end watcher daemon run against real Testnet RPC (as
opposed to the direct CLI invocations used to gather the evidence above)
has not happened yet. Browser/Freighter verification of the frontend has
not happened yet either; the environments used to build this project so
far have not had a connected browser with the Freighter extension.

## Security

See [`SECURITY.md`](./SECURITY.md). No independent security audit has
been performed.

## Known limitations

Beyond the contract-level limitations documented in `slasettle-vault`
(no commit-reveal, display-only uptime target, one shared watcher set):

- The frontend's network-mismatch detection
  (`components/network/network-indicator.tsx`) is a visual warning only;
  nothing blocks a transaction submission if the connected wallet is on a
  different network than the app is configured for. Not a fund-safety
  issue, since Stellar's own transaction signing bakes the network
  passphrase into the signed payload, but a real UX gap.
- Three of the vault's eight event kinds
  (`bond_topped_up`, `sla_cancelled`, `bond_withdrawn`) were unverified
  against real on-chain events until Phase 10's live evidence pass
  confirmed all eight; see `slasettle-vault`'s evidence directory.
- The indexer's watcher registration/removal ordering bug (fixed; see its
  own commit history and `slasettle-vault`'s
  `evidence/recovery-2026-09-28.md`) is the kind of real correctness gap
  that live evidence surfaces and unit tests alone would not have caught.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
