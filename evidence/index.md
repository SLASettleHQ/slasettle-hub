# Evidence index

Phase 26. One row per externally important claim about SLASettle, with where
the proof is and how strong it is. It is built from the evidence records and
current source, re-read on 2026-09-29, not from memory.

**Path prefixes.** `vault/` is `SLASettleHQ/slasettle-vault`; `hub/` is
`SLASettleHQ/slasettle-hub` (this repository). `matrix` is
`hub/evidence/parity-matrix-2026-09-29.md`, and `§0.n` is one of its numbered
live checks.

**Supersession note (2026-10-06).** The authoritative record of the current
deployment is `vault/evidence/testnet-2026-10-01.md`: a fresh Protocol 28
deployment of `CDRNXUPC…` (`watcher_registry`) and `CDBFPYHJ…` (`sla_vault`),
built with soroban-sdk 28.0.0 and stellar-cli 28.1.0. Rows that cite
`vault/evidence/testnet-2026-09-27.md`, or that describe the "live" contracts
as read on 2026-09-29, describe the **superseded 2026-09-27 pair**
(`CBKAQETJ…`, `CD4FSW2E…`), even where the claim text says "live" or
"current". They are kept as dated historical evidence and are not evidence for
the current pair. Rows are marked `SUPERSEDED` where a later record replaces
their conclusion, and the section "Current Protocol 28 deployment" at the end
adds rows for the current pair. Dates in the Source column were not changed.

**How to read a row.**

- *Date checked* is the date this row's source was read for the ledger. It is
  2026-09-29 for every row. **The date the evidence was gathered is in the
  Source column** and is never moved: a deployment from 2026-09-27 stays a
  2026-09-27 deployment, and the watcher run of 2026-09-29 stays a
  2026-09-29 run.
- *Evidence type* is one of: **Testnet** (a real transaction, event or
  contract state), **live Testnet test** (a running component against
  Testnet), **browser** (a real browser and wallet), **local test** (an
  automated test or scan), **CI** (a GitHub Actions or branch-protection
  read), **source** (current code read directly), **absence check** (a search
  that found nothing), **record** (a dated document).
- *Status* uses the project vocabulary and is the strongest one the source
  supports: `VERIFIED` (observed for real, on Testnet, in a browser, or on
  GitHub), `TESTED LOCALLY`, `LOGICALLY COVERED`, `UNVERIFIED`,
  `KNOWN LIMITATION` (a disclosed gap that is not expected to become
  verified), `BLOCKED` (cannot proceed without a decision or a step this
  batch may not take).
- Where sources disagree the order used is: live Testnet, current source,
  deterministic tests, CI, then documentation. Documentation never proves
  implementation.
- Rows about a run or a review that has since been superseded keep the
  original evidence and say what replaced it.

## A. Contract deployment

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| A1 The historical `watcher_registry` (`CBKAQETJ…`) and `sla_vault` (`CD4FSW2E…`) are deployed on Stellar Testnet | Testnet | `vault/evidence/testnet-2026-09-27.md` "watcher_registry deployment", "sla_vault deployment" (gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| A1.b The current `watcher_registry` (`CDRNXUPC…`) and `sla_vault` (`CDBFPYHJ…`) are deployed on Stellar Testnet | Testnet | `vault/evidence/testnet-2026-10-01.md` | 2026-10-01 | VERIFIED |
| A2 The on-chain WASM of both contracts still hashes to `4c626d2c…` and `69097132…` | Testnet | `matrix` §0.1, `stellar contract fetch` then `sha256sum` (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| A3 The deployed interface matched the source built on 2026-09-27 | Testnet | `vault/evidence/testnet-2026-09-27.md`, `stellar contract info interface` (gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| A4 The live interface equals a build of current `main` apart from the private `DataKey` spec entry | Testnet, local test | `matrix` §0.2 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| A5 The historical WASMs were built with soroban-sdk 27.0.6 and rustc 1.97.1 | Testnet | `matrix` §0.2, `stellar contract info meta` on the fetched WASM (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| A5.b The current live WASMs were built with soroban-sdk 28.0.0 and stellar-cli 28.1.0 on Protocol 28 | Testnet | `vault/evidence/testnet-2026-10-01.md` | 2026-10-01 | VERIFIED |
| A6 An earlier pair (`CBEZ3XBI…`, `CBA4DFNU…`) was deployed before the quorum fix and used for earlier evidence | Testnet | `vault/evidence/testnet-2026-09-27.md` "Historical deployment"; `hub/TEST-MATRIX.md` §5 (gathered before 2026-09-27) | 2026-09-29 | VERIFIED |
| A7 That earlier pair is still live today | none | not re-checked; nothing in this repository depends on it | 2026-09-29 | UNVERIFIED |
| A8 Nothing is deployed to Stellar mainnet | absence check | `matrix` §5 (`git grep` for mainnet, futurenet and public-network references in both repositories) | 2026-09-29 | LOGICALLY COVERED |

## B. Contract initialization

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| B1 `watcher_registry` was initialized, `get_watcher_count` read `0`, and a second `initialize` was rejected with `#2` | Testnet | `vault/evidence/testnet-2026-09-27.md` "watcher_registry initialization" (tx `7a51b818…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| B2 `sla_vault` was initialized against the fresh registry | Testnet | `vault/evidence/testnet-2026-09-27.md` "sla_vault initialization" (tx `338c9ef1…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| B3 The vault's link to the registry works | Testnet | `vault/evidence/testnet-2026-09-27.md` "Settlement": settlement succeeded only by reading this registry's tally (gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| B4 The vault's stored registry address was read directly from contract storage | Testnet | `vault/evidence/testnet-2026-09-27.md` "sla_vault initialization": the read did not resolve | 2026-09-29 | UNVERIFIED |

## C. Watcher registration

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| C1 Five watchers are registered and `get_watcher_count` is `5` | Testnet | `vault/evidence/testnet-2026-09-27.md` "Registered watchers" (gathered 2026-09-27); count re-read `5` in `matrix` §0.3 and §0.4 (2026-09-29) | 2026-09-29 | VERIFIED |
| C2 `remove_watcher` removes a watcher and `register_watcher` restores it | Testnet | `vault/evidence/testnet-2026-09-27.md` "watcher_registry live behavior verification" (txs `f739bb0b…`, `38b3026c…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| C3 A disposable watcher was registered and removed by the admin for the daemon run | Testnet | `hub/evidence/phase-23-verification-2026-09-29.md` Part C (txs `a9b53ca2…`, `b6e129ca…`, gathered 2026-09-29); event counts reconciled in `matrix` §0.6 | 2026-09-29 | VERIFIED |
| C4 A non-admin cannot register or remove a watcher | local test | `vault/contracts/watcher_registry/src/test.rs` (`test_register_watcher_by_non_admin_fails`) | 2026-09-29 | TESTED LOCALLY |

## D. Watcher voting

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| D1 `submit_check` accepts `Up` and `Down` votes and the tally reads back correctly | Testnet | `vault/evidence/testnet-2026-09-27.md` "watcher_registry live behavior verification" (gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| D2 Three `Down` votes reached the quorum of 3 for SLA 0, round 1 | Testnet | `vault/evidence/testnet-2026-09-27.md` "Live watcher votes and quorum" (txs `a1982e81…`, `94eea09b…`, `c2b2e6f9…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| D3 The SDK reads tallies and votes as the contract returns them | live Testnet test | `matrix` §0.4 (`getRoundTally`, `hasWatcherVoted`, gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| D4 A vote from an unregistered address is rejected | local test | `vault/contracts/watcher_registry/src/test.rs` (`test_submit_check_by_non_watcher_fails`) | 2026-09-29 | TESTED LOCALLY |
| D5 A late watcher can see earlier votes before voting (no commit-reveal) | source | `vault/SLASettle-contract-spec.md` "Known limitation: no commit-reveal" | 2026-09-29 | KNOWN LIMITATION |
| D6 The contracts never validate `round_id` against time | source | `vault/SLASettle-contract-spec.md` "Round IDs"; `matrix` §9 | 2026-09-29 | KNOWN LIMITATION |

## E. Settlement

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| E1 `trigger_settlement` paid `10000000` to the beneficiary, cut the bond by the same amount and marked the round settled | Testnet | `vault/evidence/testnet-2026-09-27.md` "Settlement" (tx `6522d8b7…`, gathered 2026-09-27); state re-read in `matrix` §0.3, §0.4 | 2026-09-29 | VERIFIED |
| E2 Settlement is permissionless: an account that is not admin, provider or beneficiary triggered it | Testnet | same, caller `GAD7M6PM…` | 2026-09-29 | VERIFIED |
| E3 `create_sla` rejected `quorum_threshold == 0` on the 2026-09-27 pair (the current pair repeats this, row AS) | Testnet | `vault/evidence/testnet-2026-09-27.md` "Quorum-zero fix, live" (`#7`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| E4 Settlement below quorum is rejected | local test | `vault/contracts/sla_vault/src/test.rs` (`test_trigger_settlement_below_quorum_fails`) | 2026-09-29 | TESTED LOCALLY |
| E5 Payout capping (`min(penalty, balance)`) is in source and its partial-payout branch is exercised by a local test (bond 800, penalty 500, second payout exactly 300). The 2026-09-28 security review's "verified live" sentence is superseded (see E7). Before 2026-09-29 no test reached this branch | local test | `vault/contracts/sla_vault/src/test.rs` (`test_trigger_settlement_pays_only_the_remaining_bond_when_it_is_below_the_penalty`, vault `304b948`); `hub/evidence/final-technical-audit-2026-09-29.md` remediation | 2026-09-29 | TESTED LOCALLY |
| E7 Payout capping has been executed live. It has not: the one live settlement paid the full penalty from a larger balance, and no live settlement has had a balance below the penalty | Testnet | `vault/evidence/testnet-2026-09-27.md` "Settlement" (bond `55000000` before, penalty `10000000`); `matrix` §14 | 2026-09-29 | UNVERIFIED |
| E6 The real settlement is served by the indexer and shown on the status page | live Testnet test, browser | `hub/evidence/phase-23-verification-2026-09-29.md` "Follow-up: settlement-history defect fix" (gathered 2026-09-29); `matrix` §0.7 | 2026-09-29 | VERIFIED |

## F. Cancellation

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| F1 `cancel_sla` set SLA 1 to `Cancelled`, after which settlement was rejected with `#3` | Testnet | `vault/evidence/testnet-2026-09-27.md` "SLA 1" (tx `25fb9d95…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| F2 Withdrawing before cancelling is rejected with `#3` | Testnet | same | 2026-09-29 | VERIFIED |
| F3 Cancelling from the dashboard through Freighter | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part B: write forms not exercised | 2026-09-29 | UNVERIFIED |

## G. Withdrawal

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| G1 `withdraw_remaining_bond` after cancellation returned the full 20 XLM bond | Testnet | `vault/evidence/testnet-2026-09-27.md` "SLA 1" (tx `f2d1be37…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| G2 On the live contract a repeat withdrawal on an empty bond succeeds as a no-op and emits `amount: 0` | Testnet | same (tx `0dbbb2e8…`); event re-read in `matrix` §0.5 (2026-09-29) | 2026-09-29 | VERIFIED |
| G3 Current source rejects a zero-balance withdrawal with `InvalidAmount` (commit `99be8a1`, 2026-09-28) | local test | `vault/evidence/recovery-2026-09-28.md` Finding A; `test_withdraw_remaining_bond_twice_fails_second_time` | 2026-09-29 | TESTED LOCALLY |
| G4 Historical: that rejection on the then-live contract needed a redeploy. Done by the 2026-10-01 deployment (row AR) | none | `vault/evidence/recovery-2026-09-28.md`: "not re-verified live"; `matrix` §1.2 | 2026-09-29 | SUPERSEDED |
| G4.b The zero-balance withdrawal rejection is verified live on the current SDK 28.0.0 deployment | Testnet | `vault/evidence/testnet-2026-10-01.md` | 2026-10-01 | VERIFIED |

## H. Duplicate prevention

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| H1 A second vote from the same watcher for the same round is rejected with `#4` | Testnet | `vault/evidence/testnet-2026-09-27.md` (rejected simulation, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| H2 A second `trigger_settlement` for the same round is rejected with `#4` | Testnet | same | 2026-09-29 | VERIFIED |
| H3 Re-ingesting an event range after an indexer restart adds no duplicate rows | live Testnet test | `vault/evidence/recovery-2026-09-28.md` "Duplicate execution", "Process restart" (gathered 2026-09-28) | 2026-09-29 | VERIFIED |

## I. Pause and unpause

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| I1 Registry pause blocks `submit_check` (`#5`) and unpause restores it | Testnet | `vault/evidence/testnet-2026-09-27.md` (txs `b7836cf9…`, `463ecb6a…`, `9f50fed9…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| I2 Vault pause blocks `create_sla` (`#8`) but not `top_up_bond` | Testnet | `vault/evidence/testnet-2026-09-27.md` "Vault pause/unpause" (txs `cf4b174a…`, `a852c1a9…`, `4d0f51ad…`, gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| I3 A non-admin cannot pause or unpause | local test | both contracts' `test.rs` (`test_pause_by_non_admin_fails`) | 2026-09-29 | TESTED LOCALLY |

## J. Event kinds

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| J1 All eight event kinds were observed on real Testnet transactions and decoded | Testnet | `vault/evidence/testnet-2026-09-27.md` "All observed events, this phase" (gathered 2026-09-27) | 2026-09-29 | VERIFIED |
| J2 The topic/data shapes of `bond_topped_up`, `sla_cancelled` and `bond_withdrawn` (which the vault spec had called unconfirmed) match what was assumed | Testnet | `vault/evidence/testnet-2026-09-27.md`; re-fetched and decoded with the indexer's `decodeEvent` in `matrix` §0.5 and §4 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| J3 The indexer's classifier turns the live registry stream (7 registrations, 10 votes, 2 removals) into the rows the evidence records imply | live Testnet test | `matrix` §0.6 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| J4 The indexer persists five event kinds and deliberately drops the other three | local test | `hub/indexer/src/ingest/classify.test.ts`; `classify.ts` | 2026-09-29 | TESTED LOCALLY |

## K. Frontend, browser and Freighter

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| K1 The app loads and shows a wallet control | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part B (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| K2 A real Freighter extension connects, disconnects and reconnects, showing the real address | browser | same | 2026-09-29 | VERIFIED |
| K3 The app identifies the configured network and shows a mismatch warning for a wrong passphrase | browser | same (Futurenet passphrase exercised, then restored) | 2026-09-29 | VERIFIED |
| K4 Public pages work with no wallet connected | browser | same (`/status/0`) | 2026-09-29 | VERIFIED |
| K5 Dashboard create, top-up, cancel and withdraw forms through a signed transaction | browser | same: not exercised; also `hub/apps/docs/end-user-guide.md` | 2026-09-29 | UNVERIFIED |
| K6 A network mismatch does not block a transaction (visual warning only) | source | `hub/apps/web/components/network/network-indicator.tsx`; hub issue #13 (open, checked 2026-09-29) | 2026-09-29 | KNOWN LIMITATION |
| K7 One first-click "Connecting…" hang, seen once and not reproduced | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part B | 2026-09-29 | UNVERIFIED |

## L. Public status page

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| L1 `/status/0`, served locally, shows live bond, quorum, round and five watchers without a wallet | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part B (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| L2 The settlement-history panel shows the real settlement row after the fix | browser | same, "Follow-up" section (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| L3 A publicly hosted status page exists: since 2026-09-29 the frontend is hosted at https://slasettle-web.vercel.app (Vercel, personal account, no indexer). `/status/0` loads over HTTPS and shows the SLA configuration and bond balance read live from Testnet; its round-status and settlement-history panels show "indexer not configured". Before 2026-09-29 none was hosted | browser | `hub/evidence/final-technical-audit-2026-09-29-r3.md` §2 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |

## M. Indexer API

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| M1 All six routes return the documented shapes from a fresh indexer against live Testnet | live Testnet test | `matrix` §0.7, §10 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| M2 CORS echoes an allowed origin and sends nothing to another | live Testnet test | `matrix` §10 "CORS" (gathered 2026-09-29); `hub/indexer/src/api/server.test.ts` | 2026-09-29 | VERIFIED |
| M3 Restarting the indexer resumes from its checkpoint without duplicating rows | live Testnet test | `vault/evidence/recovery-2026-09-28.md` "Process restart / persistence" (gathered 2026-09-28) | 2026-09-29 | VERIFIED |
| M4 Watcher registration and removal are applied in chronological order (bug fixed) | live Testnet test | `vault/evidence/recovery-2026-09-28.md` Finding B (gathered 2026-09-28); `matrix` §0.6 | 2026-09-29 | VERIFIED |
| M5 Route-level tests cover all six indexer routes: `/v1/health`, `/v1/watchers`, `/v1/providers/:address/slas` (earlier) and `/v1/clock`, `/v1/slas/:slaId/current-round`, `/v1/slas/:slaId/settlements` (added 2026-09-29) | local test | `hub/indexer/src/api/routes.test.ts`; `matrix` §14 | 2026-09-29 | TESTED LOCALLY |
| M6 A negative or fractional `limit` on `/v1/slas/:slaId/settlements` is rejected with HTTP 400 (`limit must not be negative` / `limit must be an integer`); a negative limit previously returned an empty page and a fractional one returned 500. Fixed 2026-09-29 | live Testnet test, local test | `matrix` §14 (negative); audit remediation (`?limit=1.5` gave 400 live; `limit` absent, 1 and 20 gave 200 with the real row); regression tests in `routes.test.ts` | 2026-09-29 | VERIFIED |
| M7 The API has no authentication and binds all interfaces | source | `hub/indexer/src/api/server.ts`, `src/index.ts`; `hub/apps/docs/deployment-topology.md` | 2026-09-29 | KNOWN LIMITATION |

## N. Settlement-history fix and re-verification

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| N1 `GET /v1/slas/0/settlements` returned HTTP 500 because an invalid hardcoded dummy account failed StrKey validation | live Testnet test | `hub/evidence/phase-23-verification-2026-09-29.md` Part B and "Follow-up" (discovered and reproduced 2026-09-29) | 2026-09-29 | VERIFIED |
| N2 Replacing it with a fresh random keypair fixes it; the regression test fails on the old code and passes on the new | local test | same, "Follow-up"; `hub/indexer/src/rpc/liveReads.test.ts`; 36/36 pass (`matrix` §0.11) | 2026-09-29 | TESTED LOCALLY |
| N3 After the fix the route returns 200 with the real settlement row against live Testnet | live Testnet test | same (2026-09-29); repeated on a fresh indexer in `matrix` §0.7 | 2026-09-29 | VERIFIED |
| N4 The status page renders that row in a real browser | browser | same, "Follow-up" (2026-09-29) | 2026-09-29 | VERIFIED |

## O. Watcher daemon

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| O1 The real daemon checked a real endpoint and submitted `submit_check` for four consecutive rounds against live Testnet, each confirmed on-chain | live Testnet test | `hub/evidence/phase-23-verification-2026-09-29.md` Part C (txs `fd8de724…`, `ccc7fabb…`, `563bd176…`, `fb8b4462…`, gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| O2 Four extra `up` votes from the disposable watcher are on-chain and decode through the indexer | live Testnet test | `matrix` §0.6 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| O3 The daemon shut down cleanly on `SIGTERM` and logged no secret | live Testnet test | `hub/evidence/phase-23-verification-2026-09-29.md` Part C | 2026-09-29 | VERIFIED |
| O4 The vote for round 29844195 is confirmed by the tally, not by the daemon's own log line (the process was killed at that moment) | live Testnet test | same, note on round 29844195 | 2026-09-29 | UNVERIFIED |
| O5 A watcher runs continuously anywhere. None does; the votes before 2026-09-29 came from the Stellar CLI | absence check | `hub/apps/docs/deployment-topology.md`; `vault/evidence/testnet-2026-09-27.md` | 2026-09-29 | KNOWN LIMITATION |
| O6 The daemon has no retry or backoff inside a round and one process serves one SLA | source | `hub/watcher/README.md` "Known limitations" | 2026-09-29 | KNOWN LIMITATION |
| O7 Watcher config, round, health and contract-client behavior | local test | `hub/watcher` `go test ./...`: 48 pass (`matrix` §0.11) | 2026-09-29 | TESTED LOCALLY |
| O8 The daemon avoids a duplicate vote after a restart by checking `has_watcher_voted` first | source | `hub/watcher/cmd/watcher/main.go`; `vault/evidence/recovery-2026-09-28.md` | 2026-09-29 | LOGICALLY COVERED |

## P. Security review

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| P1 An internal engineering security review covered both repositories | record | `vault/evidence/security-review-2026-09-28.md` (gathered 2026-09-28); `vault/SECURITY.md`, `hub/SECURITY.md` | 2026-09-29 | LOGICALLY COVERED |
| P2 No independent third-party audit has been performed | record | same; both `SECURITY.md` files | 2026-09-29 | KNOWN LIMITATION |
| P3 Dependency scans: `cargo audit` one unmaintained-crate warning, `pnpm audit` and `npm audit` zero findings, `govulncheck` 25 findings all in the Go standard library (the `govulncheck` count is superseded: see P4 and row AO) | local test | `vault/evidence/security-review-2026-09-28.md` "Dependency scanning" (run 2026-09-28, not re-run) | 2026-09-29 | TESTED LOCALLY |
| P4 The Go toolchain used locally is behind on standard-library security patches. Superseded: `watcher/go.mod` requests `go1.25.14` and `govulncheck ./...` reported 0 vulnerabilities on 2026-10-01 (row AO); hub #14 is closed | local test | same | 2026-09-29 | SUPERSEDED |
| P5 No secret appears in either repository's history | local test | same "Secret scanning": a manual pattern scan only; the dedicated scanner build did not complete | 2026-09-29 | UNVERIFIED |
| P6 Neither repository has private vulnerability reporting enabled | CI | GitHub API `private-vulnerability-reporting` returned `enabled: false` for both, 2026-09-29; both `SECURITY.md` files say so | 2026-09-29 | KNOWN LIMITATION |

## Q. Continuous integration

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| Q1 Vault CI passes on `main`: job `check, test, build`, `cargo test` 29 + 17 | CI | run `36486254192` on `8449bd7` (2026-09-28); run `36542711467` on `c7eef75` (2026-09-29) | 2026-09-29 | VERIFIED |
| Q2 Hub CI passes on `main`: `web and sdk`, `indexer`, `watcher` | CI | runs `36525671512` on `85e4f10` (2026-09-29), `36543623125` on `78d8d77`, `36545335647` on `f2565bf`, `36545722901` on `6a5911d` | 2026-09-29 | VERIFIED |
| Q3 Hub PR #8 (ESLint 9 to 10) was open on 2026-09-29 and its CI run failed; it was not touched then. It has since been closed without merge (row AP) | CI | run `36507180532` on `449e285`; `gh pr list` | 2026-09-29 | VERIFIED |
| Q4 `cargo fmt --check` fails and is informational in vault CI | CI | `vault/.github/workflows/ci.yml`; `matrix` §0.11 | 2026-09-29 | KNOWN LIMITATION |
| Q5 The documentation site is not built in CI | source | `hub/.github/workflows/ci.yml` | 2026-09-29 | KNOWN LIMITATION |
| Q6 Local tests: vault 52, SDK 29, web 50, indexer 45 (44 before the 2026-09-29 final remediation), watcher 48 pass; lint, typecheck, builds and docs build pass | local test | `matrix` §0.11 (2026-09-29) | 2026-09-29 | TESTED LOCALLY |

## R. Dependency maintenance

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| R1 Dependabot is configured for both repositories | source | `vault/.github/dependabot.yml`, `hub/.github/dependabot.yml` | 2026-09-29 | VERIFIED |
| R2 Dependabot PRs have been merged, including soroban-sdk 27.0.6 to 28.0.0 (vault #1) and the hub's #1 to #7 and #9 | CI | `gh pr list` on both repositories, 2026-09-29 | 2026-09-29 | VERIFIED |
| R3 Hub PR #8 remained open pending a compatibility decision on 2026-09-29. Superseded: it was closed without merge because ESLint 10 is incompatible with the current lint stack (row AP) | CI | same; `hub/README.md` | 2026-09-29 | SUPERSEDED |

## S. Branch protection

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| S1 `main` on both repositories requires a pull request (0 approvals) and the named CI checks, and blocks force pushes and deletion | CI | branch-protection API, read 2026-09-29 (`matrix` §0.9) | 2026-09-29 | VERIFIED |
| S2 The protection does not apply to administrators (`enforce_admins` off), so an administrator can push directly | CI | same | 2026-09-29 | VERIFIED |
| S3 The required check names equal the job names in each `ci.yml` | CI | same; both `ci.yml` files | 2026-09-29 | VERIFIED |

## T. README truth

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| T1 The vault README's contract IDs, WASM hashes, test count and CI hash match the evidence | CI, Testnet | `matrix` §6, §0.1, §0.10 | 2026-09-29 | VERIFIED |
| T2 The hub README's IDs, CI description, branch protection and Dependabot claims match GitHub and the evidence | CI | `matrix` §12 | 2026-09-29 | VERIFIED |
| T3 The audit found and fixed stale statements in both repositories' documentation (event confirmation, withdraw fix, watcher topology, ports, counts) | record | `matrix` §12, §13; vault commit `c7eef75` | 2026-09-29 | VERIFIED |
| T4 Statements after the fixes describe the implementation | source | `matrix` (whole) | 2026-09-29 | LOGICALLY COVERED |

## U. Security policy

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| U1 Both repositories have a `SECURITY.md` that claims an internal review only, with no audit | source | `vault/SECURITY.md`, `hub/SECURITY.md` | 2026-09-29 | VERIFIED |
| U2 The reporting route is a public GitHub issue asking for a private channel; no security contact exists | source | same; see P6 | 2026-09-29 | KNOWN LIMITATION |

## V. Contributing guide

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| V1 Both repositories have a `CONTRIBUTING.md` that uses the project's status vocabulary | source | `vault/CONTRIBUTING.md`, `hub/CONTRIBUTING.md` | 2026-09-29 | VERIFIED |

## W. Documentation site

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| W1 14 pages, both themes, navigation and search were reviewed at desktop width in a real browser | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part A (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| W2 The site builds with `pnpm --filter @slasettle/docs run build` | local test | `matrix` §0.11 (2026-09-29, and again after each docs change) | 2026-09-29 | TESTED LOCALLY |
| W3 The documentation site is hosted: https://slasettle-docs.vercel.app (Vercel, deployed 2026-09-29 from hub `8773628`); home, search, navigation and the contract and Testnet deployment pages verified. It is not built in CI. Before 2026-09-29 it was not hosted | browser | `hub/evidence/final-technical-audit-2026-09-29-r3.md` §2 | 2026-09-29 | VERIFIED |

## X. Mobile documentation review

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| X1 The documentation site was reviewed at a narrow viewport. The window-resize tool had no effect and no other way to force one was available | browser | `hub/evidence/phase-23-verification-2026-09-29.md` Part A | 2026-09-29 | UNVERIFIED |

## Y. SDK version and deployment mismatch

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| Y1 The historical contracts were built with soroban-sdk 27.0.6 and current `main` builds with 28.0.0 | Testnet, source | `matrix` §0.2 (WASM metadata); `vault/Cargo.toml` | 2026-09-29 | VERIFIED |
| Y1.b The current live contracts and current `main` source are in strict parity, both building with soroban-sdk 28.0.0 | Testnet, source | `vault/evidence/testnet-2026-10-01.md` | 2026-10-01 | VERIFIED |
| Y2 Historical: CI's `sla_vault.wasm` for `main` (`2f958b86…`) differed from the then-live 2026-09-27 one (`69097132…`). Superseded by the 2026-10-01 deployment (Y1.b) | CI | run `36486254192` log (2026-09-28); `matrix` §0.10 | 2026-09-29 | SUPERSEDED |
| Y3 Historical: the public interface was unchanged by the bump, but the then-live 2026-09-27 build lacked the zero-balance withdrawal rejection. The 2026-10-01 deployment has it (row AR) | Testnet, source | `matrix` §0.2, §1.3 | 2026-09-29 | SUPERSEDED |
| Y4 The same source builds to different WASM hashes under different Rust versions (local 1.97.1 versus CI 1.98.1), so byte-for-byte artifact reproducibility across toolchains is not established. This is separate from interface parity, which is VERIFIED (A4) | local test, CI | `matrix` §0.10, §0.11 | 2026-09-29 | KNOWN LIMITATION |
| Y5 Redeploying and re-verifying against 28.0.0. Out of scope for this batch | none | `vault/README.md`; `hub/apps/docs/testnet-deployment.md` | 2026-09-29 | SUPERSEDED |

## Z. Known architectural limitations

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| Z1 `uptime_target_bps` is stored and displayed but never enforced; settlement is per round | source | `vault/contracts/sla_vault/src/storage.rs`; `vault/README.md` | 2026-09-29 | KNOWN LIMITATION |
| Z2 One shared watcher set serves every SLA on a deployment | source | `vault/README.md`, `vault/SECURITY.md` | 2026-09-29 | KNOWN LIMITATION |
| Z3 Persistent-storage TTL constants (about 30 days) are untuned | source | `vault/contracts/*/src/storage.rs` | 2026-09-29 | KNOWN LIMITATION |
| Z4 Indexer event history older than the RPC's retention (about seven days) cannot be recovered from RPC | source | `hub/indexer/src/ingest/poller.ts`; `hub/indexer/README.md` | 2026-09-29 | KNOWN LIMITATION |
| Z5 The watcher and indexer round lengths must be configured equal by hand | source | `matrix` §9 | 2026-09-29 | KNOWN LIMITATION |
| Z6 The indexer's `explorer_url` is hardcoded to Testnet | source | `hub/indexer/src/api/routes.ts`; `matrix` §5 | 2026-09-29 | KNOWN LIMITATION |
| Z7 No public indexer, managed database, permanent watcher or automatic deployment pipeline exists; the frontend and documentation are hosted by hand on a personal Vercel account and are not Git-connected | absence check | `hub/apps/docs/deployment-topology.md`; `hub/evidence/final-technical-audit-2026-09-29-r3.md` | 2026-09-29 | KNOWN LIMITATION |
| Z8 Neither repository had a license file on 2026-09-29. Superseded: both repositories now have an MIT `LICENSE` and GitHub recognizes it (row AQ); hub #10 and vault #2 are closed | absence check | `git ls-files` in both repositories, 2026-09-29 | 2026-09-29 | SUPERSEDED |
| Z9 Testnet only; nothing is audited or production-ready | record | both `README.md` and `SECURITY.md` files | 2026-09-29 | KNOWN LIMITATION |

## Cross-repository parity

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| AA The SDK's read functions decode the live contracts' results, including the `SLAConfig` fields, enums, tally and a contract error message | live Testnet test | `matrix` §0.4 (gathered 2026-09-29) | 2026-09-29 | VERIFIED |
| AB The watcher's `submit_check` argument order and encodings match the contract | live Testnet test, local test | `matrix` §1.1; Phase 23 Part C | 2026-09-29 | VERIFIED |
| AC The Testnet passphrase and RPC URL agree across both repositories, and the RPC reports the same passphrase | live Testnet test | `matrix` §5, §0.8 | 2026-09-29 | VERIFIED |
| AD Status values, error handling, events, environment variables, round semantics and API shapes were compared field by field | source | `matrix` §2, §3, §4, §8, §9, §10 | 2026-09-29 | VERIFIED |
| AE Every contract ID, transaction hash and address the hub documents matches the authoritative evidence, except historical and labeled example values | source | `matrix` §6 | 2026-09-29 | VERIFIED |

## Live lifetime maintenance and audit remediation (2026-09-29)

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| AF The instances and WASM code entries of the superseded 2026-09-27 pair, due to expire about 2026-10-05, were extended by 3,000,000 ledgers; WASM hashes and live state are unchanged. This is an operational mitigation, not a redeployment or a source fix | Testnet | `hub/apps/docs/testnet-deployment.md` "Lifetime extension" (txs `b8601edc…`, `1e2b750d…`, `9efdb520…`, `a130b4f3…`, gathered 2026-09-29); `hub/evidence/final-technical-audit-2026-09-29.md` remediation | 2026-09-29 | VERIFIED |
| AG The current contract source extends instance storage itself. It does not; a permanent fix needs a contract build and redeployment. Source and deployment parity is resolved separately (rows Y1.b, AO); vault issue #3 is closed | source | `vault/contracts/*/src/lib.rs` (no `instance().extend_ttl`) | 2026-09-29 | KNOWN LIMITATION |
| AH The persistent entries of the superseded 2026-09-27 pair that the workflow needed (5 watcher registrations, SLAs 0 to 2 and their bond balances, settled round 0/1) were extended by 3,000,000 ledgers on 2026-09-29 (12 transactions, no state changed). Vote-history entries were not, and the contract still extends a persistent entry only when it writes it | Testnet | `hub/apps/docs/testnet-deployment.md` "Persistent entries, same day" (txs `78f0ec30…` to `e6e0661a…`, ledgers 4932956 to 4932981); `hub/evidence/findings-classification-2026-09-29.md` §4 | 2026-09-29 | VERIFIED |
| AI A repeat `cancel_sla` emits another `SlaCancelled` event and moves no funds | source | `hub/apps/docs/limitations.md`; `vault/SLASettle-contract-spec.md` | 2026-09-29 | KNOWN LIMITATION |
| AJ A missing or wrong signature is rejected by the contracts and `trigger_settlement` needs no signature or role from its caller. Before 2026-09-29 no test showed either: every contract test used `mock_all_auths()` | local test | `vault/contracts/sla_vault/src/test.rs` (`test_provider_methods_reject_a_missing_signature_and_change_nothing`, `test_a_signature_from_someone_else_does_not_authorize_the_provider`, `test_admin_methods_reject_a_missing_signature`, `test_trigger_settlement_needs_no_signature_and_no_role_from_its_caller`); `vault/contracts/watcher_registry/src/test.rs` (`test_admin_and_watcher_methods_reject_a_missing_signature`); vault `d79c52d` | 2026-09-29 | TESTED LOCALLY |
| AK A live wrongly-signed or unsigned call was rejected on Testnet. None was recorded | none | `hub/evidence/findings-classification-2026-09-29.md` row 20 | 2026-09-29 | UNVERIFIED |
| AL Every material finding of the final audit, the external review, the parity matrix, the ledger and the traceability record has exactly one A to E category: A 0, B 1, C 19, D 3, E 20 (two rows closed as historical) | record | `hub/evidence/findings-classification-2026-09-29.md` | 2026-09-29 | VERIFIED |
| AM The hosted frontend connects to Freighter and can sign a dashboard write from its hosted origin. Not tested; the Freighter verification was on a local origin | none | `hub/evidence/final-technical-audit-2026-09-29-r3.md` §2 | 2026-09-29 | UNVERIFIED |
| AN The 2026-09-27 pair resolved on the Testnet explorer with the recorded creator and WASM hashes (historical; not re-run for the current pair) (the repositories link to those contract pages) | live Testnet test | explorer API read, 2026-09-29; `hub/evidence/final-technical-audit-2026-09-29-r3.md` §2 | 2026-09-29 | VERIFIED |

## Current Protocol 28 deployment (added 2026-10-06)

| Claim | Evidence type | Source | Date checked | Status |
|---|---|---|---|---|
| AO `watcher/go.mod` requests toolchain `go1.25.14` and `govulncheck ./...` reported 0 vulnerabilities | local test | `hub/evidence/final-technical-audit-2026-09-29.md` (run 2026-10-01); `hub/watcher/go.mod` | 2026-10-06 | VERIFIED |
| AP Hub PR #8 (ESLint 9 to 10) is closed and not merged; the project stays on ESLint 9.x and does not claim ESLint 10 support | CI | `gh pr view 8` | 2026-10-06 | VERIFIED |
| AQ Both repositories have an MIT `LICENSE` file recognized by GitHub | source | `LICENSE` in each repository; GitHub repository metadata | 2026-10-06 | VERIFIED |
| AR The current pair rejects a repeat `withdraw_remaining_bond` on a zero balance with `#7` | Testnet | `vault/evidence/testnet-2026-10-01.md` "SLA 1" | 2026-10-01 | VERIFIED |
| AS The current pair rejects `create_sla` with `quorum_threshold == 0` with `#7` | Testnet | `vault/evidence/testnet-2026-10-01.md` "Quorum-zero fix, live" | 2026-10-01 | VERIFIED |
| AT The current pair settled SLA 0 after three `Down` votes (round 123) and rejected a second settlement with `#4` | Testnet | `vault/evidence/testnet-2026-10-01.md` "SLA 0" | 2026-10-01 | VERIFIED |
| AU The current pair supports SLA creation, top-up, cancellation, withdrawal and vault pause and unpause | Testnet | `vault/evidence/testnet-2026-10-01.md` | 2026-10-01 | VERIFIED |
| AV The on-chain WASM of the current pair hashes to `5478788e…` (`watcher_registry`) and `e177a76f…` (`sla_vault`), equal to a local rebuild of vault `main` | Testnet, local test | `stellar contract fetch` and `sha256sum`, 2026-10-06; `vault/evidence/testnet-2026-10-01.md` | 2026-10-06 | VERIFIED |
| AW A lifetime extension of the current pair has been made. None is recorded and no expiration ledger has been read | none | `hub/apps/docs/testnet-deployment.md` "Lifetime status of the current pair" | 2026-10-06 | UNVERIFIED |
| AX Event decoding, a registry pause test, a watcher daemon run, an indexer run and a frontend browser check on the current pair. None is recorded | none | `vault/evidence/testnet-2026-10-01.md` does not contain them | 2026-10-06 | UNVERIFIED |
