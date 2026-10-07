<h1 align="center">SLASettle Hub</h1>
<p align="center">Frontend, SDK, indexer, and watcher daemon for the SLASettle protocol on Stellar</p>

<p align="center">
  <a href="https://github.com/SLASettleHQ/slasettle-hub/actions/workflows/ci.yml"><img src="https://github.com/SLASettleHQ/slasettle-hub/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://slasettle-docs.vercel.app"><img src="https://img.shields.io/badge/docs-online-blue" alt="Docs"></a>
  <a href="https://slasettle-web.vercel.app"><img src="https://img.shields.io/badge/app-Testnet-orange" alt="App"></a>
  <a href="https://stellar.org"><img src="https://img.shields.io/badge/Stellar-Protocol_28-black" alt="Stellar"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT"></a>
</p>

**Quick links** (Stellar Testnet only)

- [Live App](https://slasettle-web.vercel.app) (frontend; SLA configuration and bond are read live from Testnet. The indexer-backed round-status and settlement-history panels need `NEXT_PUBLIC_INDEXER_API_URL` at build time; see [Hosted indexer](#hosted-indexer))
- [Documentation](https://slasettle-docs.vercel.app)
- [SLASettle Vault](https://github.com/SLASettleHQ/slasettle-vault) (contracts repository)
- [Testnet deployment](./apps/docs/testnet-deployment.md)
- [Evidence index](./evidence/index.md)

The watcher daemon, event indexer, TypeScript SDK, and frontend for
SLASettle. The Soroban contracts (`watcher_registry` and `sla_vault`)
live in the separate repository
[SLASettle Vault](https://github.com/SLASettleHQ/slasettle-vault); this
repository never defines contract logic, only the off-chain services and
UI that talk to it.

Testnet only, for now. Nothing here has been audited; see
[`SECURITY.md`](./SECURITY.md).

## What SLASettle is

A Stellar-based service backs its uptime promise with a real bond.
Watchers, independent of the provider by design, report whether the service
was up or down each round; when enough of them have voted it down and anyone
calls `trigger_settlement`, `sla_vault` pays a fixed penalty to the beneficiary
out of the bond. Nothing in either repository calls it automatically, and on
the current Testnet deployment the watcher addresses were registered by the
project admin for evidence runs, not by independent operators. Full
contract-level detail is in `slasettle-vault`'s `SLASettle-contract-spec.md`.

## Repository structure

```
apps/web        Next.js frontend: landing page, wallet-gated dashboard,
                 per-SLA status page (unauthenticated; a Testnet
                 deployment is linked above)
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
- pnpm 12.8.2 (`packageManager` field)
- Go 1.25 (`watcher/go.mod`'s declared minimum; its `toolchain` line asks for
  1.25.14, and CI runners use whatever 1.25.x is current, which also picks up
  Go's own stdlib security patches)

## Hosted indexer

An indexer is deployed on Cloudflare Workers (backed by D1) at
`https://slasettle-indexer.slasettle-indexer.workers.dev`. Checked on
2026-10-07 with `curl` (no browser): `/v1/health` returns `status: ok` with a
current `last_indexed_ledger`, `/v1/clock` returns a current round, and
`/v1/slas/0/settlements` returns one settlement row (round 123).

What is **not** verified:

- Browser access. On 2026-10-06 a browser on `localhost` received no
  `Access-Control-Allow-Origin` header from the indexer and the panels showed
  their unavailable state. A header-only probe on 2026-10-07 (`curl` with an
  `Origin` header) did receive that header for `http://localhost:3000` and
  `https://slasettle-web.vercel.app`, but that is not a browser test. CORS and
  browser integration, from `localhost` and from the deployed origin, have not
  been re-tested in a browser and should not be treated as working yet.
- The web app has no built-in indexer URL. `NEXT_PUBLIC_INDEXER_API_URL` is
  inlined at build time; when it is unset the indexer-backed panels show a
  "not configured" state. `apps/web/.env.example` lists the URL above as an
  example. The Vercel project's own setting for this variable has not been
  checked, and a deployment built after this change will show "not
  configured" unless it is set.

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
`@types/better-sqlite3`, `go-stellar-sdk`). The ESLint 10 Dependabot PR
([SLASettleHQ/slasettle-hub#8](https://github.com/SLASettleHQ/slasettle-hub/pull/8))
was closed without merging after compatibility testing showed that the current
`eslint-plugin-react` dependency chain does not yet support ESLint 10.
The project remains on ESLint 9.39.5.

`main` is branch-protected: pull requests are required, all three CI jobs
above are required status checks, force pushes and branch deletion are
disabled. Required approving reviews are set to 0, since this is
currently a solo-maintained repository. Protection is not enforced for
repository administrators (`enforce_admins` is off, read from the
branch-protection API on 2026-09-29), so an administrator can push to
`main` directly.

## Current Testnet status

The contracts this repository's services point at, as of 2026-10-01:

| Contract | ID | Explorer |
|---|---|---|
| `watcher_registry` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF) |
| `sla_vault` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN) |

Full live evidence (real SLA creation, real watcher votes, a real
settlement, cancellation, withdrawal) is in `slasettle-vault`'s
[`evidence/testnet-2026-10-01.md`](https://github.com/SLASettleHQ/slasettle-vault/blob/main/evidence/testnet-2026-10-01.md). That evidence confirms strict parity
with the current Protocol 28 deployment built with `soroban-sdk` 28.0.0.
See the vault README for exact details.

A live, end-to-end watcher daemon run against real Testnet RPC, and a
real browser/Freighter verification of the frontend, were both performed
on 2026-09-29 using the then-current Testnet deployment and a disposable
Testnet watcher account. See
[`evidence/phase-23-verification-2026-09-29.md`](./evidence/phase-23-verification-2026-09-29.md) for the full record,
including transaction hashes and one real defect it surfaced along the
way: a 500 error in the indexer's settlement-history endpoint, caused by
an invalid hardcoded dummy account in `indexer/src/rpc/liveReads.ts`.
That defect has since been fixed, covered by a regression test, and
re-verified live against that same historical deployment; see the same evidence
file's follow-up section for the fix record.

## Evidence

Every externally important claim about this project, with its source and
current status, is indexed in [`evidence/index.md`](./evidence/index.md).
The cross-repository consistency audit of 2026-09-29 is
[`evidence/parity-matrix-2026-09-29.md`](./evidence/parity-matrix-2026-09-29.md).
Each high-value claim traced to code, test, live evidence and documentation is in
[`evidence/claim-traceability-2026-09-29.md`](./evidence/claim-traceability-2026-09-29.md),
and a review written from an outsider's viewpoint is in
[`evidence/external-review-2026-09-29.md`](./evidence/external-review-2026-09-29.md).

## Security

See [`SECURITY.md`](./SECURITY.md). No independent security audit has
been performed.

## Known limitations

Beyond the contract-level limitations documented in `slasettle-vault`
(no commit-reveal, display-only uptime target, one shared watcher set):

- The frontend blocks writes when the connected wallet is on a different
  network than the app is configured for (hub #13). This is covered by unit
  tests with a mocked wallet and has not been exercised in a real browser
  with Freighter.
- Three of the vault's eight event kinds
  (`bond_topped_up`, `sla_cancelled`, `bond_withdrawn`) were unverified
  against real on-chain events until the 2026-09-27 live evidence pass
  confirmed all eight; see `slasettle-vault`'s evidence directory.
- The indexer's watcher registration/removal ordering bug (fixed; see its
  own commit history and `slasettle-vault`'s
  `evidence/recovery-2026-09-28.md`) is the kind of real correctness gap
  that live evidence surfaces and unit tests alone would not have caught.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
