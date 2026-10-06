# Testing

Real pass counts, from actually running each suite while writing this
page (2026-09-29):

| Project | Command | Result |
|---|---|---|
| `slasettle-vault` (`watcher_registry` + `sla_vault`) | `cargo test --workspace` | 52/52 passed |
| `packages/sdk` | `pnpm --filter @slasettle/sdk test` (Vitest) | 29/29 passed |
| `apps/web` | `pnpm --filter @slasettle/web test` (Vitest) | 50/50 passed |
| `indexer` | `npm test` (`node --test`) | 45/45 passed |
| `watcher` | `go test ./...` | 48/48 passed |

Every number above is unit/integration-level, run against local
in-memory state, mocks, or a local SQLite file — none of it is a live
Testnet run. The one exception is the contract layer's separate
Testnet evidence (see below), which is a different kind of check
entirely.

## What each suite actually covers

- **Contracts** (`cargo test --workspace`, in-process Soroban test
  environment, not a real network): every function's success path, every
  documented error code, and both real regression tests from this
  project's own history — `create_sla` rejecting `quorum_threshold == 0`,
  and `withdraw_remaining_bond` rejecting an already-zero balance. Most of
  these tests run under `mock_all_auths()`, which makes every signature check
  succeed; a separate group calls through explicit, narrow authorizations to
  show that a missing or wrong signature is rejected and that
  `trigger_settlement` needs no signature. The partial-payout branch of
  settlement is covered by its own test. None of this ran against a live
  network for the payout cap, or for a wrongly signed call. See
  [Contracts](/contracts).
- **SDK** (`packages/sdk`, Vitest with a mocked RPC layer): config
  validation (`MissingSdkConfigError` naming exactly which variables are
  missing), transaction-building argument shapes, and decode-time shape
  validation for every read function.
- **Frontend** (`apps/web`, Vitest + `jsdom`, React Testing Library):
  component-level tests for the wallet button, transaction status
  display, theme toggle, quorum meter, settlement list, and watcher grid
  — rendering and interaction logic, not a real Freighter connection or a
  real browser (see [Limitations](/limitations)).
- **Indexer** (`indexer`, Node's built-in `node --test`, real SQLite via
  `better-sqlite3` against a temp file, not mocked): event classification,
  the ordered `WatcherEvent` application logic (the real fix from this
  project's 2026-09-28 recovery investigation — a regression test named exactly
  `register, remove, and re-register the same watcher within a single
  batch applies in real chronological order, not grouped by event type`
  exists specifically to keep that bug from coming back), CORS allowlist
  behavior, cursor pagination, and API route responses against a real
  local database.
- **Watcher** (`watcher`, Go's standard `testing` package): config
  loading, round-number computation, health-check HTTP logic, and the
  contract-client wrapper — all against a mocked RPC transport, not a
  live Testnet connection. Separately from this unit-test suite, the
  daemon itself was run live against real Testnet RPC and the real
  contract on 2026-09-29, across four consecutive rounds — see
  [Limitations](/limitations) and
  `evidence/phase-23-verification-2026-09-29.md` in the hub repository
  for that distinct verification.

## What none of this tests

- **No end-to-end test** exercises the full path from a watcher's real
  vote through the indexer to the frontend in one run. Each project's
  suite stops at its own boundary.
- **No browser automation** (Playwright, Cypress, or similar) exists in
  either repository. The frontend's tests render components with
  `jsdom`, not a real browser, and never touch Freighter.
- **No load, fuzz, or property-based testing** exists anywhere in either
  repository.

## Real Testnet verification, separately from unit tests

The contracts' live behavior — real transactions, real events, a real
permissionless settlement triggered by a non-privileged account — was
verified directly against Testnet, not through the unit test suites
above. The current evidence is `slasettle-vault/evidence/testnet-2026-10-01.md`,
for the 2026-10-01 deployment built with `soroban-sdk` 28.0.0, which matches
the current source these unit tests run against. See
[Current Testnet deployment](/testnet-deployment). The earlier
`slasettle-vault/evidence/testnet-2026-09-27.md` is historical evidence of a
superseded deployment (soroban-sdk 27.0.6) and is not evidence for the current
contracts.

## CI

Both repositories run these same commands automatically on every push to
`main` and every pull request (`.github/workflows/ci.yml` in each). See
[Developer setup](/developer-setup) for the exact job names and ordering
constraints (in particular, `slasettle-vault`'s CI must build the
contracts before running `cargo check`/`test`/`clippy`, or the
`contractimport!` line fails on a clean checkout).
