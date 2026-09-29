# Claim-to-code traceability, 2026-09-29

Phase 27. For each high-value external claim this follows the chain
claim, implementation, test, live evidence, documentation, and says where the
chain is short. It is a traceability record, not a description of quality.

- **Baselines re-read:** vault `b4243ff`, hub `24ed862` (current `main` of both
  when this was written). Source was read directly; earlier phase reports
  were not used as evidence.
- **Nothing was invented.** A missing link is marked `[no test]`, `[no live]`
  or `[weak test]`, and each such mark is resolved in "Unresolved links" as:
  weakened wording, left as UNVERIFIED, or left BLOCKED. No test or live
  evidence was created to fill a gap.
- **Status** is the strongest the chain supports for the claim *as worded*, in
  the project vocabulary. A claim whose live link is missing is never
  `VERIFIED`.
- **Current source versus deployed contract.** Rows that concern contract
  behavior say which one they mean. Deployed = the 2026-09-27 Testnet
  contracts built with soroban-sdk 27.0.6. Current source = vault `main` on
  soroban-sdk 28.0.0. They differ only where a row says so (claims 10, 14, 15,
  62 to 67).

**Shorthand.** `v/` = `slasettle-vault`, `h/` = `slasettle-hub`.
`V-EV` = `v/evidence/testnet-2026-09-27.md`. `REC` =
`v/evidence/recovery-2026-09-28.md`. `SEC` =
`v/evidence/security-review-2026-09-28.md`. `P23` =
`h/evidence/phase-23-verification-2026-09-29.md`. `PM` =
`h/evidence/parity-matrix-2026-09-29.md`. `IDX` = `h/evidence/index.md`.
Contract tests are in `v/contracts/*/src/test.rs`; **every contract test
calls `env.mock_all_auths()`**, so no local test checks that a missing
signature is rejected, only that role checks in the contract's own code
work.

## Method

1. List every claim in the brief, then find where each is stated (READMEs,
   `SECURITY.md`, docs site, contract spec, UI copy).
2. Find the code that would make it true; read it.
3. Find a test that would fail if it were false; read what it asserts.
4. Find live evidence (Testnet, browser, GitHub) and check the record says
   what the row says it does.
5. Search both repositories for strong words (automatic, uptime, independent,
   verified, production, secure, audited, real-time, continuous, public,
   non-custodial, live, Testnet) and compare each hit with the chain. Results
   are in "Wording stronger than the evidence".

## Claims

### Group 1: core contract behavior

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 1 | Registered watchers can submit checks | `v/contracts/watcher_registry/src/lib.rs` `submit_check` | `test_submit_check_success_updates_tally` | V-EV "watcher_registry live behavior" (`d160961e…`, `6ef581c8…`); four daemon votes in P23 Part C | `h/apps/docs/contracts.md`; `v/SLASettle-contract-spec.md` | VERIFIED |
| 2 | An unregistered watcher cannot submit | same, `NotAWatcher` (#3) | `test_submit_check_by_non_watcher_fails` | `[no live]` none recorded | same | TESTED LOCALLY |
| 3 | No second vote per `(sla_id, round_id)` | same, `DuplicateCheck` (#4) | `test_submit_check_duplicate_in_same_round_fails`, `…_same_watcher_different_round_succeeds` | V-EV: rejected `#4` (simulation) | contracts.md; lifecycle.md; spec | VERIFIED |
| 4 | The registry counts Up and Down votes | `submit_check` tally, `get_round_tally` | `test_submit_check_success_updates_tally`, `test_get_round_tally_with_no_votes_returns_zeros` | V-EV tally `{1,1}`, `{0,3}`; PM §0.4 SDK read `{0,3}`, `{2,1}` | contracts.md | VERIFIED |
| 5 | `sla_vault` reads the registry tally | `v/contracts/sla_vault/src/lib.rs` `trigger_settlement` step 3 (`contractimport!` client) | every `test_trigger_settlement_*` deploys both contracts | V-EV settlement `6522d8b7…`; the stored registry address itself was not read (UNVERIFIED, V-EV) | spec "Cross-contract call" | VERIFIED (link proven functionally) |
| 6 | Settlement requires the configured quorum | same, `votes_down < quorum_threshold` gives `QuorumNotMet`; `create_sla` rejects `quorum_threshold == 0` | `test_trigger_settlement_below_quorum_fails`, `test_create_sla_zero_quorum_threshold_fails` | Positive path: 3 votes, quorum 3, paid (V-EV). Zero quorum rejected live `#7`. `[no live]` for a below-quorum rejection | lifecycle.md; spec | VERIFIED (positive path and zero-quorum); TESTED LOCALLY (below-quorum rejection) |
| 7 | Settlement is permissionless | `trigger_settlement` never calls `require_auth` on `caller` | `[weak test]`: `test_trigger_settlement_pays_out_when_quorum_confirms_breach` passes `admin` as caller under `mock_all_auths`, which cannot distinguish permissionless from admin-allowed | V-EV: triggered by `alice`, not admin, provider or beneficiary | README; spec; SECURITY.md | VERIFIED (live) |
| 8 | Settlement pays the beneficiary | `trigger_settlement` token `transfer` to `config.beneficiary` | `test_trigger_settlement_pays_out_when_quorum_confirms_breach` | V-EV balances: beneficiary `+10000000`, bond `−10000000` | economics.md | VERIFIED |
| 9 | Settlement is idempotent per round | `SettledRounds` flag checked first | `test_trigger_settlement_twice_same_round_fails` | V-EV: second call rejected `#4` | lifecycle.md | VERIFIED |
| 10 | Payout cannot exceed remaining bond (current source) | `trigger_settlement` payout = `min(penalty_per_breach, balance)`, `BondExhausted` at 0 | `test_trigger_settlement_caps_payout_at_remaining_balance` | `[no live]`: the one live settlement paid the full penalty from a larger bond. SEC's "verified live" is superseded (SEC note, IDX E5/E7) | economics.md; spec | TESTED LOCALLY; live UNVERIFIED |
| 11 | Provider authentication is required where implemented | `create_sla`, `top_up_bond`, `cancel_sla`, `withdraw_remaining_bond` call `caller.require_auth()` and compare with the stored provider | `[weak test]`: `test_*_by_non_provider_fails` exercise only the provider comparison (`NotAuthorized`); `mock_all_auths` bypasses `require_auth` | Live calls were signed by the correct account (V-EV); no live rejection of a wrongly signed call is recorded | SECURITY.md "Authorization model"; spec | LOGICALLY COVERED (`require_auth` is enforced by the Soroban host; the provider comparison is TESTED LOCALLY) |
| 12 | Cancellation changes the SLA state | `cancel_sla` sets `SLAStatus::Cancelled` | `test_cancel_sla_by_provider_succeeds`, `test_cancelled_sla_cannot_be_settled` | V-EV: `25fb9d95…`, `get_sla(1).status` Cancelled, settlement rejected `#3`; PM §0.4 | lifecycle.md | VERIFIED |
| 13 | Withdrawal requires cancellation | `withdraw_remaining_bond` returns `SlaNotActive` unless `Cancelled` | `test_withdraw_remaining_bond_without_cancel_fails` | V-EV: withdraw before cancel rejected `#3` | spec | VERIFIED |
| 14 | Zero-balance withdrawal is rejected (current source) | `withdraw_remaining_bond`: `balance <= 0` gives `InvalidAmount` (commit `99be8a1`) | `test_withdraw_remaining_bond_twice_fails_second_time` | `[no live]`: needs a redeploy | spec; contracts.md; testnet-deployment.md | TESTED LOCALLY; live BLOCKED |
| 15 | The deployed contract still has the pre-fix zero-balance behavior | deployed WASM `69097132…` predates `99be8a1` | n/a | V-EV: repeat withdrawal `0dbbb2e8…` succeeded with `amount: 0`; event re-read PM §0.5; WASM hash re-checked PM §0.1 | README (vault); testnet-deployment.md; spec | VERIFIED |

### Group 2: watcher

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 16 | Computes `round_id` from its own clock | `h/watcher/internal/round/round.go` `CurrentID` (`time.Now().Unix() / ROUND_LENGTH_SECONDS`) | `internal/round/round_test.go` (floor, boundary, no drift) | P23 rounds 29844195 to 29844198 | watcher README; lifecycle.md; spec "Round IDs" | VERIFIED |
| 17 | Checks whether it already voted | `cmd/watcher/main.go` `runOneRound` calls `HasVoted` first | `TestHasVotedSendsArgsInOrderSlaIDRoundIDWatcher`, `…DecodesTrue`, error cases (mocked RPC). `[no test]` of `main.go`'s skip branch | `[no live]` for the skip-when-voted path; the call itself succeeded before every live submission | watcher README | TESTED LOCALLY (call); LOGICALLY COVERED (skip branch) |
| 18 | Performs a real HTTP health check | `internal/health/health.go` `Check` (HTTP GET, status below `HTTP_EXPECT_MAX_STATUS`) | `internal/health/health_test.go` (real `httptest` servers, real timeout, refused connection) | P23: GET to a local `python3 -m http.server`, `status=Up http_code=200` | watcher README | VERIFIED (against a local target) |
| 19 | Maps health status to contract status | `main.go`: `health.Down` to `StatusDown`, else `StatusUp`; `contract.mustCheckStatusEnum` | `TestMustCheckStatusEnumMatchesContracttypeUnitEnumEncoding`; `[no test]` of the `main.go` mapping | Up votes observed (P23). `[no live]` for a Down vote submitted by the daemon | watcher README; PM §2 | VERIFIED (Up); TESTED LOCALLY (encoding); Down mapping LOGICALLY COVERED |
| 20 | Submits its own vote | `contract.go` `SubmitCheck` (simulate, apply auth, sign with `WATCHER_SECRET_KEY`, submit, poll) | `TestSubmitCheck*` (11 tests, mocked RPC) | P23: `fd8de724…`, `ccc7fabb…`, `563bd176…`, `fb8b4462…`; PM §0.6 shows four extra `up` votes | watcher README | VERIFIED |
| 21 | Can run against live Testnet | whole daemon | mocked-RPC tests only | P23 Part C, four consecutive rounds | h/README; topology | VERIFIED (one machine, one disposable account, one SLA) |
| 22 | Shuts down cleanly | `main.go` `signal.NotifyContext(SIGINT, SIGTERM)`, `ctx.Done()` | `[no test]` (`cmd/watcher` has no tests) | P23: `SIGTERM` logged `shutting down`, process exited | not stated as a feature elsewhere | VERIFIED |
| 23 | Does not log the secret key | `main.go` startup log names only `sla_id`, `target`, `round_length`; no `%+v` of config | `[no test]` | P23: observed log lines contain no key; SEC "Watcher security" grep | SECURITY.md; security.md | VERIFIED for the observed log lines; not a proof for every code path |
| 24 | No submission retry or backoff within a round | `runOneRound` logs and returns on error; next round retries | n/a | n/a | watcher README "Known limitations" 3 | KNOWN LIMITATION (documented, intentional) |
| 25 | One daemon process handles one SLA | `config.Config.SLAID` is a single `uint64` | `TestLoadWithAllRequiredValuesSucceeds` | P23 ran `SLA_ID=0` | watcher README limitation 2; environment-variables.md | KNOWN LIMITATION (documented, by design) |

### Group 3: indexer

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 26 | Ingests registry events | `h/indexer/src/rpc/client.ts`, `decode.ts`, `ingest/classify.ts`, `ingest/poller.ts` | `classify.test.ts`, `db.test.ts` | PM §0.6: 7 registrations, 10 votes, 2 removals decoded and classified | indexer README; api.md | VERIFIED |
| 27 | Ingests vault events | same | `classify.test.ts` (persisted: `sla_created`, `settlement_paid`; the other three recognized, not persisted) | PM §0.5: 9 events, 3 SLA rows, 1 settlement row | indexer README | VERIFIED (5 of 8 kinds persisted by design) |
| 28 | Event ordering is chronological | `classify.ts` single `watcherEvents` array; `db.ts` `applyBatch` | `register, remove, and re-register … chronological order …` (`db.test.ts`), `classify.test.ts` | REC Finding B: reprocessed real range, watcher5 listed | recovery record | VERIFIED |
| 29 | Duplicate ingestion adds no rows | `INSERT OR IGNORE` on event id; checkpoint in one transaction | `applying the same batch twice does not duplicate checks (idempotency)` | REC "Process restart": counts identical after restart | indexer README | VERIFIED |
| 30 | Exposes six routes | `h/indexer/src/api/routes.ts` | `routes.test.ts`: all six covered since 2026-09-29 | PM §0.7, §14 | api.md | VERIFIED |
| 31 | Settlement history resolves `quorum_threshold` | `rpc/liveReads.ts` `fetchQuorumThreshold` | `liveReads.test.ts` (fails on the old code, passes on the fix) | P23 follow-up; PM §0.7, §14 (`quorum_threshold: 3`) | SECURITY.md; api.md | VERIFIED |
| 32 | Negative settlement `limit` gives HTTP 400 | `routes.ts` (`invalid_limit`) | `GET /v1/slas/:slaId/settlements rejects a negative limit …` (fails on the previous `routes.ts`) | PM §14: live `?limit=-5` returned 400 | api.md | VERIFIED |
| 33 | Cursor pagination | `api/pagination.ts`; `routes.ts` `(ledger_close_time, event_id) <` | `pagination.test.ts`; `… paginates newest first with an opaque cursor …` | `[no live]`: one settlement exists, so no live second page | api.md | TESTED LOCALLY |
| 34 | Monetary values are strings | `amountToString`; `penalty_amount`, `bond_amount_at_creation` stay strings | `decode.test.ts`; providers and settlements route tests | PM §0.7 output | api.md "Amounts are strings" | VERIFIED |
| 35 | CORS uses an explicit allowlist | `api/server.ts`, `config.ts` `ALLOWED_ORIGINS` | `api/server.test.ts` (4 tests) | PM §0.7: allowed origin echoed, other origin none | SECURITY.md; api.md | VERIFIED |
| 36 | Uses local SQLite | `db/db.ts` (`better-sqlite3`, WAL, `DB_PATH`) | `db.test.ts` | PM §0.7 scratch database | topology | VERIFIED |
| 37 | The API has no authentication | no auth middleware in `api/server.ts` | n/a | PM §0.7: unauthenticated `curl` succeeded | topology | KNOWN LIMITATION (documented) |
| 38 | The API binds all interfaces | `src/index.ts` `app.listen(port)` with no host argument | `[no test]` | `[no live]`: reachability from another host was not tested | topology | LOGICALLY COVERED (source only) |

### Group 4: SDK

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 39 | Read functions decode contract state | `h/packages/sdk/src/sla-vault.ts`, `watcher-registry.ts`, `token.ts` | `sla-vault.test.ts`, `watcher-registry.test.ts`, `token.test.ts` | PM §0.4: all reads against the live contracts | sdk.md; SDK README | VERIFIED |
| 40 | Reads use simulation | `client.ts` `simulateReadCall` (`simulateTransaction`) | mocked at `simulateReadCall` | the live reads in PM §0.4 went through it | SDK README "How a read actually works" | VERIFIED |
| 41 | Write builders return unsigned transactions | `client.ts` `buildInvokeTx` (`prepareTransaction`) | `sla-vault.test.ts` builder tests decode the built args | `[no live]`: no builder output was signed and submitted (write forms not exercised, P23) | SDK README; architecture.md | TESTED LOCALLY |
| 42 | The SDK does not sign | no signing import or call in `packages/sdk/src` (`client.ts` comment states it) | `[no test]` | n/a | SDK README; SECURITY.md | LOGICALLY COVERED |
| 43 | The SDK holds no secret keys | `Keypair.random()` is used only to make a throwaway public key for simulation (`client.ts`); no key input anywhere | `[no test]` | n/a | SECURITY.md | LOGICALLY COVERED |
| 44 | Arguments are encoded in the contract's order | `sla-vault.ts`, `watcher-registry.ts` `nativeToScVal` lists | builder tests round-trip args through `scValToNative`; order compared with the contract in PM §1 | reads with these encodings succeeded live (PM §0.4); writes `[no live]` | sdk.md | TESTED LOCALLY (writes); VERIFIED (reads) |
| 45 | Status decoding matches the contract | `sla-vault.ts` `decodeContractEnum` | `decodes a Cancelled status`, unrecognized-variant test | PM §0.4: `Active`, `Cancelled` | sdk.md; SDK README | VERIFIED |
| 46 | The SDK exposes the contract errors it actually exposes | `client.ts` `SorobanSimulationError` carries the raw `rpcMessage`; no error-name or number mapping exists | `[no test]`: the SDK suite covers configuration and decoding only | PM §0.4: `getSla(999n)` gave `HostError: Error(Contract, #9)` | sdk.md "Errors" | VERIFIED (live, raw message only) |

**Contract methods the SDK does not wrap.** `sla_vault`: `initialize`, `pause`,
`unpause`. `watcher_registry`: `initialize`, `register_watcher`,
`remove_watcher`, `pause`, `unpause`, `submit_check`. It wraps 8 of 11 vault
methods and 4 of 10 registry methods (the four read functions). `isWatcher`,
`getWatcherCount` and `hasWatcherVoted` are exported but unused by the
frontend. The SDK maps no contract error to a name or number; a caller sees
the RPC's message text.

### Group 5: frontend

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 47 | Connects to Freighter | `h/apps/web/lib/wallet.ts`, `components/wallet/wallet-provider.tsx`, `wallet-button.tsx` | `wallet-button.test.tsx` (Freighter mocked) | P23 Part B: real extension, connect, disconnect, reconnect | end-user-guide.md; README | VERIFIED |
| 48 | Shows the connected address | `wallet-button.tsx`, `wallet-panel.tsx` | `wallet-button.test.tsx` | P23: header form and full form matched the real address | end-user-guide.md | VERIFIED |
| 49 | Detects the expected network | `lib/network.ts`, `components/network/network-indicator.tsx` | `[no test]` (no test file for the indicator) | P23: badge "Testnet" | limitations.md | VERIFIED (browser only) |
| 50 | Shows a mismatch warning | `network-indicator.tsx` | `[no test]` | P23: passphrase changed to Futurenet's, amber "Wallet network mismatch", then restored | limitations.md; end-user-guide.md | VERIFIED (browser only) |
| 51 | Public status pages work without a wallet | `app/status/[slaId]/page.tsx`, `components/status/*`, hooks `use-round-status.ts`, `use-sla-config.ts`, `use-settlement-history.ts` | `quorum-meter`, `settlement-list`, `watcher-grid` component tests; `[no test]` of the page | P23: `/status/0` with no wallet, real data, and settlement history after the fix | end-user-guide.md | VERIFIED |
| 52 | The dashboard has transaction-building flows | `components/dashboard/*` call SDK `build*Tx` through `lib/use-transaction.ts` | `create-sla-form.test.tsx` (SDK and wallet mocked); `[no test]` for top-up, cancel, withdraw | `[no live]` | end-user-guide.md | TESTED LOCALLY (create); LOGICALLY COVERED (others) |
| 53 | Signed write execution from the dashboard is not browser-verified | n/a | n/a | P23 Part B: forms not exercised | end-user-guide.md; limitations.md; issue #12 | UNVERIFIED |

### Group 6: security

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 54 | An internal security review exists | n/a | n/a | record: SEC (2026-09-28) | both `SECURITY.md`; security.md | LOGICALLY COVERED (a review record; sub-claims carry their own status) |
| 55 | There is no independent audit | n/a | n/a | n/a | both READMEs and `SECURITY.md`, security.md, introduction.md, index.md | KNOWN LIMITATION. No source or document found that implies an audit exists |
| 56 | Secret scanning exists at its actual strength | n/a | n/a | SEC "Secret scanning": manual `git grep` patterns over history; the dedicated scanner did not complete | SEC; SECURITY.md | UNVERIFIED for a dedicated scanner |
| 57 | Dependency scans exist at their dates | n/a | n/a | SEC "Dependency scanning", run 2026-09-28, not re-run | SEC; security.md | TESTED LOCALLY (dated) |
| 58 | Private vulnerability reporting is not enabled | n/a | n/a | GitHub API `enabled: false` for both repositories, 2026-09-29 (IDX P6) | both `SECURITY.md`; security.md | VERIFIED |
| 59 | Network mismatch is visual only | `network-indicator.tsx`; `use-transaction.ts` has no check | `[no test]` | P23: warning shown, no block | limitations.md; issue #13 | KNOWN LIMITATION |
| 60 | Commit-reveal is absent | `submit_check` stores votes in the clear | n/a | n/a | spec; README; limitations.md; vault issue #4 | KNOWN LIMITATION |

### Group 7: toolchain and deployment

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 61 | Current vault source uses soroban-sdk 28.0.0 | `v/Cargo.toml` `soroban-sdk = "28.0.0"` | CI and local build and tests | local WASM embeds `rssdkver` 28.0.0 (PM §0.2) | vault README | VERIFIED |
| 62 | The live contracts were built with soroban-sdk 27.0.6 | n/a | n/a | fetched live WASM embeds `rssdkver` 27.0.6, `rsver` 1.97.1 (PM §0.2); V-EV "Network and toolchain" | testnet-deployment.md; vault README | VERIFIED |
| 63 | The live WASM hashes are known | n/a | n/a | `4c626d2c…`, `69097132…`; on-chain SHA-256 re-checked 2026-09-29 (PM §0.1) | testnet-deployment.md; README | VERIFIED |
| 64 | The same source can give different WASM hashes across toolchains | n/a | n/a | local rustc 1.97.1 `5a5ee41b…` versus CI rustc 1.98.1 `2f958b86…` for the same source (PM §0.10, §0.11) | testnet-deployment.md; IDX Y4 | VERIFIED (observation); KNOWN LIMITATION |
| 65 | Public interface parity was verified | n/a | n/a | spec diff of live versus current build, one omitted `DataKey` entry (PM §0.2) | testnet-deployment.md | VERIFIED |
| 66 | Byte-for-byte artifact parity was not established | n/a | n/a | the hashes differ (claims 63, 64) | testnet-deployment.md | KNOWN LIMITATION |
| 67 | The zero-balance withdrawal fix is not deployed | see claim 15 | n/a | PM §0.1, V-EV | README; spec; testnet-deployment.md | VERIFIED (not deployed); redeploy BLOCKED |

### Group 8: documentation and project status

| # | Claim | Implementation | Test | Live evidence | Documentation | Status |
|---|---|---|---|---|---|---|
| 68 | The documentation site exists and builds | `h/apps/docs` (VitePress 1.6.4) | `pnpm --filter @slasettle/docs run build` locally; `[no CI]` | local build 2026-09-29 | topology | TESTED LOCALLY |
| 69 | Desktop visual review was performed | n/a | n/a | P23 Part A, 14 pages, both themes, search | limitations.md | VERIFIED |
| 70 | Mobile visual review is unverified | n/a | n/a | P23 Part A | limitations.md; IDX X1 | UNVERIFIED |
| 71 | The frontend is not publicly hosted | n/a | n/a | GitHub: no Pages, deployments, environments, homepage (IDX Z7) | topology; api.md; end-user-guide.md | KNOWN LIMITATION |
| 72 | The indexer is not publicly hosted | same | n/a | same | topology; api.md | KNOWN LIMITATION |
| 73 | The watcher is not continuously hosted | same | n/a | P23 (one run); IDX O5 | topology | KNOWN LIMITATION |
| 74 | The two contracts are deployed on Testnet | n/a | n/a | V-EV; on-chain hashes and reads, PM §0.1, §0.3 | README; testnet-deployment.md | VERIFIED |
| 75 | No mainnet deployment exists in the evidence | n/a | n/a | `git grep` finds no mainnet ID or claim (PM §5); absence cannot be proven from the repositories alone | README; introduction.md | LOGICALLY COVERED |
| 76 | CI is configured and green on current main | `.github/workflows/ci.yml` in both | n/a | vault `b4243ff` run `36548663143` `check, test, build` success; hub `24ed862` run `36548680306` `web and sdk`, `indexer`, `watcher` success | READMEs | VERIFIED |
| 77 | Dependabot is configured | both `.github/dependabot.yml` | n/a | merged Dependabot PRs (IDX R2) | READMEs | VERIFIED |
| 78 | Main branches are protected | n/a | n/a | branch-protection API: PR required, required checks, no force push or deletion, `enforce_admins` off (PM §0.9) | READMEs | VERIFIED |
| 79 | No license has been selected | no `LICENSE` file in either repository | n/a | `git ls-files`; issues hub #10, vault #2 | limitations.md | KNOWN LIMITATION |
| 80 | No independent security audit exists | see claim 55 | n/a | n/a | see claim 55 | KNOWN LIMITATION |

## Totals

80 claims traced. By leading status: VERIFIED 49, TESTED LOCALLY 10, LOGICALLY
COVERED 6, UNVERIFIED 3, KNOWN LIMITATION 12, BLOCKED 0 as a leading status
(claims 14 and 67 carry BLOCKED for their live half: 14 leads with TESTED
LOCALLY, 67 with VERIFIED).

Chain gaps marked in the tables: 11 claims lack live evidence (2, 6, 10, 14,
17, 19, 33, 38, 41, 44, 52) and 15 carry a missing or weak test (7, 11, 17,
19, 22, 23, 38, 42, 43, 46, 49, 50, 51, 52, 59); 22 distinct claims have at
least one marked gap, and 58 have none. Where the missing link is "n/a"
(limitations, absence claims) it is not counted as a gap. No claim was
upgraded to fill a gap.

## Unresolved links

| Claim | Missing link | Decision |
|---|---|---|
| 2 | no live rejection of an unregistered watcher | Leave as TESTED LOCALLY. Do not claim it live. |
| 6 | no live below-quorum rejection | Leave; the positive path and the zero-quorum rejection are live. |
| 7 | the local test cannot tell permissionless from admin-allowed | Weak test noted. The live settlement by `alice` is the proof; wording stays "permissionless" and cites the live transaction. |
| 10 | no live execution of the cap | Live UNVERIFIED. The 2026-09-28 wording is superseded by a note on the record. |
| 11 | `require_auth` not exercised by any test | LOGICALLY COVERED, not TESTED LOCALLY. Docs say "auth: provider", which describes the code; no doc claims a test. |
| 14, 67 | live behavior needs a redeploy | BLOCKED. |
| 17, 19 | `main.go` has no tests; skip and Down paths not seen live | Left as LOGICALLY COVERED. |
| 33 | no live second page | TESTED LOCALLY. |
| 38 | binding not tested from another host | LOGICALLY COVERED, worded as "source shows no host argument". |
| 41, 44 | no UI-built write was signed and submitted | Stays with claim 53 as UNVERIFIED. |
| 46 | no SDK test of the error type | Live evidence only; wording is "raw RPC message", not "documented contract errors". |
| 49, 50 | no unit test of the network indicator | Browser evidence only; stays VERIFIED at that strength. |
| 68 | docs build not in CI | TESTED LOCALLY, listed as a limitation. |

## Claims that were weakened in this pass

Each edit is a documentation edit; the contracts and code are unchanged.

| Where | Before | After | Why |
|---|---|---|---|
| `v/README.md` intro | "verified by independent watchers, and paid out automatically" | "checked by watchers (independent of the provider by design), and paid out when … someone calls `trigger_settlement`", plus the note that nothing calls it and that the current watchers are admin-registered | settlement needs a caller; the five registered watchers were set up by the project admin for evidence runs |
| `h/README.md` "What SLASettle is" | "Independent watchers … pays … permissionlessly" | same correction | same |
| `h/README.md` repository structure | "public per-SLA status page" | "per-SLA status page (unauthenticated; no hosted instance exists)" | "public" read as "hosted" |
| `h/apps/docs/introduction.md` | "paid automatically", "automatic, on-chain payout", "a quorum of independent votes" | "anyone calls `trigger_settlement`", "on-chain payout that anyone can trigger", plus the admin-registered-watchers note | same |
| `h/apps/docs/problem.md` | "The penalty is not automatic" (as a problem SLASettle removes), "happens automatically" | "depends on the provider paying"; "can be triggered by anyone … nothing here triggers it automatically" | same |
| `v/SLASettle-contract-spec.md`, `h/apps/docs/contracts.md` | `endpoint_hash` "is stored on the check record" | accepted, not stored, not emitted; only a transaction argument | see claim 20 below |
| `h/apps/docs/deployment-topology.md` | the hash is "on-chain" | it travels as a transaction argument; the contract does not store it | same |
| `h/TEST-MATRIX.md` banner | n/a | added two superseded items (SDK error test claim, `endpoint_hash`) | historical snapshot kept, not rewritten |

### Finding exposed by the chain: `endpoint_hash` is not stored (claim 20)

The contract spec, the docs site and the doc comment above `submit_check` said
`endpoint_hash` is "stored on the check record". The code
(`watcher_registry/src/lib.rs`, `submit_check`) writes only `status` under
`DataKey::Check(sla_id, round_id, watcher)`, discards the hash with
`let _ = &endpoint_hash`, and `CheckSubmitted` has no hash field. So the
"dispute can verify which endpoint a watcher checked" purpose is not backed by
contract state; the hash is only in the transaction's arguments. The watcher
does compute and send it (`contract.EndpointHash`, SHA-256 of `TARGET_URL`;
`TestEndpointHashIsPlainSHA256`, `TestSubmitCheckSendsExpectedInvocationAndArgumentEncoding`).
This is a documentation-versus-source contradiction, not a contract defect
that this pass may change. The stale doc comment in `lib.rs` was left as it is
because this phase must not alter contract source; it is listed under
required corrections. No live check of the transaction arguments was made.

## Wording stronger than the evidence

Search terms: automatic, autonomous, trustless, real-time, continuous,
production, non-custodial, custody, audited, secure, guarantee, uptime, live,
public, decentralized, independent, verified.

| Text | Where | Problem | Factual replacement |
|---|---|---|---|
| "paid out automatically" | vault README; introduction.md; problem.md | a person or script must call `trigger_settlement` | fixed above |
| "independent watchers" as a present fact | READMEs, docs, `components/landing/hero.tsx` ("Independent watchers check the service every round") | the five registered watchers were registered by the project admin; only one daemon run has occurred | docs fixed; the landing-page copy is **not** changed here (product copy, has a test). Proposed: "Watchers check the service each round in the intended design" |
| "public per-SLA status page" | hub README, `apps/web/README.md`, `layout.tsx` description, docs | reads as hosted | README fixed; proposed for UI metadata: "unauthenticated status page" |
| "check the service every round" | hero | no watcher runs continuously | same proposal as above |
| "Uptime target" | create form, status view | display-only; already labeled so in the form, card, status page, docs | no change |
| "settlement" "on Stellar" in footer | `site-footer.tsx` "uptime bonds settled on Stellar" | Testnet only | proposed: "on Stellar Testnet" |
| "verified live" | how-it-works.md, SEC | how-it-works is accurate (permissionless settlement was live); SEC's payout-cap statement was not | SEC note added earlier; ledger E5/E7 |
| "production", "secure", "audited" | all hits | every hit is a negation (not audited, not production, no independent audit) | none |
| "non-custodial", "trustless", "real-time", "guarantee" | no hits, except "guarantee" as the user's SLA promise | none | none |

## Claims that remain UNVERIFIED

Claim 53 (signed dashboard writes), 56 (dedicated secret scan), 70 (mobile
docs), and, as the live half of a claim, 2, 6 (below-quorum), 10 (live cap),
17, 19 (Down mapping), 33, 41, 44 (writes), and the `endpoint_hash` argument
on a live transaction.

## Claims that remain BLOCKED

Claim 14 live (zero-balance rejection) and 67 (deploying it), both needing a
redeploy that is out of scope. The soroban-sdk 28.0.0 redeploy is the same
blocker.

## Documentation corrections required

Made in this pass: the wording changes in the table above, and the
`endpoint_hash` corrections.

Still required, not made here (they touch contract source or product copy):

1. `v/contracts/watcher_registry/src/lib.rs`: the doc comment above
   `submit_check` and the comment at `let _ = &endpoint_hash` say the hash is
   stored on the check record.
2. `v/contracts/sla_vault/src/lib.rs`: the doc comment above
   `trigger_settlement` says `caller` is "recorded only in the event"; it is
   not (the code says so a few lines later).
3. `h/watcher/internal/round/round.go`: "the way the contract spec defines
   them" (the spec did not; it now has a "Round IDs" section).
4. `h/apps/web`: landing hero, layout description and footer wording (see the
   table).
5. Hub issues #11 and #12 describe gaps that Phase 23 partly or fully closed;
   see the external review, section 8.
