# Security

`slasettle-hub` contains the watcher daemon, event indexer, TypeScript
SDK, and frontend for SLASettle. Testnet only, for now. **No independent
third-party security audit has been performed on this code.** Everything
in this document reflects an internal engineering review by the people
building this repository, not an external audit.

## Scope

- `watcher/` (Go daemon)
- `indexer/` (event indexer and HTTP API)
- `packages/sdk` (TypeScript contract bindings)
- `apps/web` (Next.js frontend)

The Soroban contracts themselves (`watcher_registry`, `sla_vault`) live in
the separate `SLASettleHQ/slasettle-vault` repository and have their own
`SECURITY.md`; that document is authoritative for contract-level security,
not this one.

## Reporting a vulnerability

This repository does not currently have GitHub's private vulnerability
reporting feature enabled, and no dedicated security contact address
exists. If you find a vulnerability, open a GitHub issue with the minimum
detail needed to establish that a real issue exists (do not include a
full exploit in a public issue) and ask for a private channel to share
the rest. This is a real gap for a project at this stage, not a
deliberate choice, and it should be closed before any production
deployment.

## Watcher: private key and signing boundary

`WATCHER_SECRET_KEY` (a real Stellar secret key) is read once from the
environment in `internal/config/config.go` and passed directly to
`contract.NewClient`. It is never logged: `cmd/watcher/main.go`'s startup
log line explicitly names only non-sensitive fields (`sla_id`, `target`,
`round_length`), and no code path logs the loaded config struct as a
whole. `.env` is gitignored; `.env.example` contains only empty
placeholder values. A manual secret-pattern scan (Stellar secret key
format, PEM private-key blocks) across the complete reachable git history
of this repository found none.

The watcher only ever signs its own vote (`submit_check`); it never holds
or moves anyone else's funds. `getSourceAccount` loads the account's real,
current sequence number live before every submission, rather than caching
or manually incrementing one, which avoids a class of sequence-drift
replay bugs.

`go build`, `go vet`, and `go test` (48/48) all pass. `govulncheck`
against this module found vulnerabilities only in the Go standard library
(net/url, crypto/tls, crypto/x509, net/http, encoding/asn1, encoding/pem),
none in `go-stellar-sdk` or any other third-party dependency actually
called by this code; all are already fixed in later Go 1.25.x patch
releases. CI (`actions/setup-go@v7` with `go-version: "1.25"`) picks up
whatever 1.25.x is current on GitHub's runners, which is likely ahead of
whatever patch version a given local machine has installed. Re-run on
2026-09-30: with the local Go 1.25.1 `govulncheck` still reports the same 25
standard library findings; with Go 1.25.14 (now requested by the `toolchain`
line in `watcher/go.mod`) it reports none affecting this code, and one
advisory in an indirect module (`github.com/klauspost/compress`, s2 out of
bounds read) that this code does not call.

## Indexer security boundary

CORS is an explicit, environment-driven allowlist (`ALLOWED_ORIGINS`),
never a wildcard and never a reflection of an arbitrary caller's Origin
header; confirmed live (an allowed origin gets the header echoed back
exactly, a disallowed origin gets none). Every database write uses
`better-sqlite3`'s parameterized `.prepare(...).run(...)` pattern; no SQL
statement in this codebase concatenates untrusted input into a query
string. An unrecognized on-chain event topic is logged and skipped, not
thrown as an uncaught error. `GET /v1/providers/:address/slas` is strictly
scoped to the requested provider address.

The indexer never handles a private key or secret; nothing in its logging
surface is more sensitive than public on-chain events and public Stellar
addresses.

## SDK security boundary

`packages/sdk` never imports a signing library or accepts a secret key
anywhere in its API. Every write function returns an **unsigned**
`Transaction`; signing happens only in `apps/web/lib/wallet.ts`, via
Freighter. Network and contract configuration are read from environment
variables with no defaults; a missing one throws a named error
(`MissingSdkConfigError`) rather than proceeding with a guessed value.
Every `i128`/`u64` amount round-trips as `bigint`, never coerced to
`number`, to avoid precision loss on real balances.

## Frontend wallet boundary

Wallet interaction goes exclusively through `@stellar/freighter-api`; the
frontend never constructs, holds, or has access to a private key. A grep
across `apps/web` for any private-key or secret-signing code found none.
Network-mismatch detection (`components/network/network-indicator.tsx`)
compares the connected wallet's network passphrase against the app's
configured one. Writes are also blocked: `useTransaction.run` refuses to
build, sign or submit when the wallet is on a different network or the app
has no configured network, `signTransaction` in `lib/wallet.ts` re-checks the
wallet's live network before asking Freighter to sign, and each write action
disables its button and says why. This is covered by unit tests with a mocked
wallet. It has not yet been exercised in a real browser with Freighter.

Exactly one `dangerouslySetInnerHTML` use exists in the entire frontend
(`app/layout.tsx`, the dark-mode flash-prevention script), and its content
is a static constant, never derived from user input, URL parameters, or
API data. Every `NEXT_PUBLIC_*` variable (RPC URL, network passphrase, two
contract IDs, indexer API URL) is information already public on-chain or
meant to be known by any client connecting to this app; none are secrets.

## Dependency scanning

`pnpm audit --prod` (the pnpm workspace: `apps/web`, `packages/sdk`) and
`npm audit --omit=dev` (`indexer`, its own separate lockfile) both
reported 0 known vulnerabilities as of 2026-09-28. `govulncheck` results
for `watcher` are described above. None of these are configured as
ongoing, scheduled scans; each was a real, manually-run, one-time check.

## Secret scanning

A manual `git grep` scan for Stellar secret key patterns, PEM private-key
blocks, generic API-key/secret assignment patterns, and any tracked
non-example `.env` file was run across the complete reachable git history
of this repository on 2026-09-28. Nothing was found. No dedicated
entropy-based secret-scanning tool has been run successfully against this
repository as of this date.

## Known limitations

- The frontend's network-mismatch block (hub #13) is covered by unit tests
  with a mocked wallet only. It has not been exercised in a real browser with
  Freighter.
- No CI-level dependency or secret scanner runs on a schedule; the checks
  described above were manual and one-time.

## Resolved since the original review

- The watcher daemon's contract-calling half was tested only against a
  mocked RPC transport as of the original review above. It has since
  been run live against real Testnet RPC and the live, verified
  `watcher_registry` contract, across four consecutive real rounds, with
  a disposable watcher account and a clean graceful shutdown. See
  `evidence/phase-23-verification-2026-09-29.md`.
- Browser/Freighter verification of the frontend had not happened as of
  the original review above. It has since been performed against a real
  Freighter extension and the live, verified Testnet deployment,
  covering connect, disconnect, reconnect, correct address display,
  correct network identification, the network-mismatch indicator, and
  public read-only pages working without a wallet. That verification
  surfaced a real indexer defect (below), since fixed.
- The indexer's `GET /v1/slas/:slaId/settlements` endpoint returned a 500
  error whenever a settlement row's cached `quorum_threshold` was `null`,
  due to an invalid hardcoded dummy account string in
  `indexer/src/rpc/liveReads.ts`'s `fetchQuorumThreshold` (failed
  `@stellar/stellar-sdk`'s StrKey checksum validation). Discovered
  2026-09-29 during frontend verification; fixed the same day by
  replacing the hardcoded string with a freshly generated random
  keypair's public key (the same throwaway-account pattern already used
  in `packages/sdk/src/client.ts`), covered by a new regression test
  (`indexer/src/rpc/liveReads.test.ts`), and re-verified live against the
  real deployment. See
  `evidence/phase-23-verification-2026-09-29.md`.

## Supported versions

Testnet only. There is no versioned release yet, and no mainnet
deployment. This document will be updated once a release process and a
mainnet target exist.
