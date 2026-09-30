# Contributing to slasettle-hub

## Prerequisites

- Node 24.21.0 (see `.nvmrc`)
- pnpm 12.8.1 (see the root `package.json`'s `packageManager` field;
  `pnpm/action-setup@v6` pins this exact version in CI too)
- TypeScript 5.9 for `apps/web` and `packages/sdk` (not 7: `typescript-eslint`
  does not support it yet; the indexer alone uses 7.0.2, see
  `packages/sdk/README.md`)
- Go 1.25 or newer, for `watcher/`
- A running `indexer` and deployed contracts if you're working on
  `apps/web` against real data; the frontend and SDK both work against
  Testnet directly otherwise

## Install, build, test

pnpm workspace (`apps/web`, `packages/sdk`):

```bash
pnpm install --frozen-lockfile
pnpm run build       # builds the sdk, then web
pnpm run lint
pnpm run typecheck
pnpm run test
```

Indexer (its own npm project, separate lockfile):

```bash
cd indexer
npm ci
npm run build
npm test
```

Watcher (its own Go module):

```bash
cd watcher
go build ./...
go vet ./...
go test ./...
```

These are the same commands `.github/workflows/ci.yml` runs, split
across the same three jobs (`web-and-sdk`, `indexer`, `watcher`).

## Repository structure

```
apps/web        Next.js frontend
packages/sdk     TypeScript contract bindings, unsigned transactions only
indexer          Event indexer, its own npm project
watcher          Independent Go watcher daemon
```

## Frontend development

`apps/web` consumes `packages/sdk` via the pnpm workspace protocol, so
build the SDK first if you're iterating on both (`pnpm run dev` from the
repository root does this for you). Copy `apps/web/.env.example` to
`apps/web/.env.local` and fill in real values; none of the five variables
have defaults, and a missing one produces a clear error rather than a
silent fallback. See `apps/web/README.md` for the wallet/transaction flow
in detail.

## Indexer development

Copy `indexer/.env.example` to `indexer/.env`. The two contract IDs are
required; everything else has a sensible Testnet default. `ALLOWED_ORIGINS`
is the CORS allowlist; set it to your actual frontend origin, never a
wildcard. See `indexer/README.md` for the event-decoding status per event
kind before assuming a given event's shape is already verified.

## Watcher development

Copy `watcher/.env.example` to `watcher/.env`. `WATCHER_SECRET_KEY` is a
real Stellar secret key; `.env` is gitignored in that directory and must
never be committed. The watcher address must already be registered via
`watcher_registry.register_watcher` by the contract admin before its
votes will be accepted. See `watcher/README.md` for the current, real
test status.

## Cross-repository workflow

Contract changes live in `slasettle-vault`, not here. If a change here
depends on a contract change (a new function, a changed error code, a new
event shape):

```text
slasettle-vault: implement, test, verify (locally and/or live)
     → push
     → this repository: update the SDK bindings/indexer decoder/frontend
       to match
     → push
```

Do not guess at a contract's behavior from this repository; read
`slasettle-vault`'s actual source, tests, or `SLASettle-contract-spec.md`.

## Branch workflow and pull requests

`main` is branch-protected: pull requests are required, and all three CI
jobs (`web and sdk (build, lint, typecheck, test)`, `indexer (build,
test)`, `watcher (build, vet, test)`) must pass before merging. Force
pushes and branch deletion are disabled. Required approving reviews are
currently set to 0, since this repository is solo-maintained.

```text
branch
→ make your change
→ run the relevant commands above locally
→ commit
→ push your branch
→ open a pull request
→ CI runs automatically
→ merge once CI passes
```

## Commit conventions

- One genuine logical unit per commit. A change that touches both the
  SDK and the frontend to keep them in sync is one unit; a CI workflow
  change and an unrelated bug fix are two.
- Stage specific files, never `git add .`.
- Push a genuine commit immediately after making it.
- Dependabot's own commits (e.g. `Co-authored-by: dependabot[bot]`) are
  its legitimate attribution and are not something to remove or imitate;
  human-authored commits should never carry a fabricated co-author
  trailer of any kind.

## Security-sensitive code

The watcher's private-key handling (`WATCHER_SECRET_KEY`, `contract.go`'s
signing path), the indexer's CORS configuration, and the frontend's
wallet-signing flow (`lib/wallet.ts`) are security-sensitive. Changes here
should explain in the commit message exactly what boundary they affect
and include a test that would have failed before the fix. See
`SECURITY.md` for how to report a vulnerability; there is no private
reporting channel, stated plainly rather than invented.

## Documentation expectations

If a change affects a claim in this repository's root `README.md`,
`SECURITY.md`, or a subproject's own README, update that document in the
same change. Don't claim something is verified unless you actually ran
the command or observed the real result; use the honest status
vocabulary already used across this project's evidence files
(`VERIFIED`, `TESTED LOCALLY`, `LOGICALLY COVERED`, `UNVERIFIED`,
`KNOWN LIMITATION`, `BLOCKED`).
