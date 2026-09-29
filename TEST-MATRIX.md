# SLASettle test matrix

> **Historical snapshot, superseded in part.** This matrix was written
> for Phase 9 on 2026-09-28 and has not been rewritten since; rows below
> keep the status they had then. The current, cross-repository record is
> `evidence/index.md` (claim ledger) and
> `evidence/parity-matrix-2026-09-29.md`. Known superseded rows:
>
> - Sections 3 and 8 and "Unverified items": a watcher daemon *has* been
>   run live against Testnet (2026-09-29, four consecutive rounds); see
>   `evidence/phase-23-verification-2026-09-29.md`.
> - Section 4's event table and section 8's event row: all eight event
>   kinds are VERIFIED, not 5 of 8; see
>   `slasettle-vault/evidence/testnet-2026-09-27.md`.
> - Section 5: the pair named there (`CBEZ3XBI…` / `CBA4DFNU…`) is the
>   *historical* deployment; the current one is `CBKAQETJ…` /
>   `CD4FSW2E…`. The `e075df0c…` hash and "BLOCKED" row describe the
>   pre-redeploy state.
> - Section 6: browser and Freighter verification of the frontend was done
>   on 2026-09-29 (connect, disconnect, network display, mismatch
>   indicator, public status page); the dashboard write forms were not
>   exercised.
> - Section 1: current counts are indexer 36, sdk 29, web 50, watcher 48,
>   vault 29 + 17.
> - Section 4's "API serialization (all endpoints)" and "clock handling"
>   rows overstate coverage: `routes.test.ts` covers `/v1/health`,
>   `/v1/watchers` and `/v1/providers/:address/slas` only.
>   `/v1/slas/:slaId/current-round`, `/v1/slas/:slaId/settlements` and
>   `/v1/clock` have no route-level test (the settlements path has the
>   `liveReads.test.ts` regression test) and were checked live instead.
> - Section 7's SDK row claims `SorobanSimulationError` is tested in
>   `packages/sdk/src/client.test.ts`; that suite covers configuration only,
>   and the error was exercised live on 2026-09-29 instead.
> - The contract docs of that period said `endpoint_hash` is stored on the
>   check record. It is not: the contract discards it (see
>   `evidence/claim-traceability-2026-09-29.md`, claim 20).
> - Section 8 refers to `SLASettle-indexer-api-spec.md`, which has never
>   existed in either repository; the API is documented in
>   `apps/docs/api.md`.

This document maps the actual behaviors of SLASettle to their current
verification status, across both repositories:

- `slasettle-vault`: `contracts/watcher_registry`, `contracts/sla_vault`
- `slasettle-hub`: `watcher/`, `indexer/`, `packages/sdk`, `apps/web`

Status labels, used consistently and only where the evidence actually
supports them:

- `VERIFIED`: confirmed against a real, live Testnet transaction or event.
- `TESTED LOCALLY`: a real automated test passes against real types
  (compiler, real SDK types, real encoded values), but not against a live
  network or a real deployed contract.
- `LOGICALLY COVERED`: the behavior follows from code that has been read
  and reasoned about, but no automated test exercises it directly.
- `UNVERIFIED`: no test and no live evidence exist yet.
- `KNOWN LIMITATION`: a deliberate, disclosed product limitation, not a
  bug and not something this matrix expects to become verified.
- `BLOCKED`: verification was attempted and could not proceed, with the
  reason stated.

Row counts below were confirmed by running each package's real test
command at the time this document was written (see each section). A later
change to any of these numbers means this document needs updating, not
that the new number should be assumed correct.

## 1. Unit and contract tests, by package

| Package | Command | Result | Evidence |
|---|---|---|---|
| `slasettle-vault` (`sla_vault`) | `cargo test -p sla-vault` | 28 passed | test names below |
| `slasettle-vault` (`watcher_registry`) | `cargo test -p watcher-registry` | 17 passed | test names below |
| `slasettle-hub/indexer` | `npm test` | 33 passed | 8 test files under `src/**/*.test.ts` |
| `slasettle-hub/packages/sdk` | `pnpm test` | 29 passed | 4 test files |
| `slasettle-hub/apps/web` | `pnpm test` | 50 passed | 9 test files |
| `slasettle-hub/watcher` | `go test ./...` | 48 passed | 6 test files across 4 packages |

## 2. Contract coverage (`slasettle-vault`)

### `watcher_registry`

| Behavior | Test | Status |
|---|---|---|
| initialize | `test_initialize_succeeds` | TESTED LOCALLY |
| initialize twice fails | `test_initialize_twice_fails` | TESTED LOCALLY |
| register watcher | `test_register_watcher_adds_to_set_and_increments_count` | TESTED LOCALLY |
| register watcher, non-admin fails | `test_register_watcher_by_non_admin_fails` | TESTED LOCALLY |
| register watcher twice is idempotent | `test_register_watcher_twice_does_not_double_count` | TESTED LOCALLY |
| watcher count starts at zero | `test_watcher_count_starts_at_zero` | TESTED LOCALLY |
| remove watcher | `test_remove_watcher_removes_from_set_and_decrements_count` | TESTED LOCALLY |
| remove unregistered watcher is a no-op | `test_remove_watcher_not_registered_is_a_no_op` | TESTED LOCALLY |
| submit_check Up / Down, tally updates | `test_submit_check_success_updates_tally` | TESTED LOCALLY |
| submit_check by non-watcher fails | `test_submit_check_by_non_watcher_fails` | TESTED LOCALLY |
| duplicate check in same round rejected | `test_submit_check_duplicate_in_same_round_fails` | TESTED LOCALLY |
| same watcher, different round succeeds | `test_submit_check_same_watcher_different_round_succeeds` | TESTED LOCALLY |
| submit_check while paused fails | `test_submit_check_while_paused_fails` | TESTED LOCALLY |
| has_watcher_voted | `test_has_watcher_voted` | TESTED LOCALLY |
| get_round_tally with no votes | `test_get_round_tally_with_no_votes_returns_zeros` | TESTED LOCALLY |
| pause by non-admin fails | `test_pause_by_non_admin_fails` | TESTED LOCALLY |
| pause then unpause by admin | `test_pause_then_unpause_by_admin_succeeds` | TESTED LOCALLY |
| all of the above against a real deployed contract | none (this table) | VERIFIED for: initialize, register_watcher x5, submit_check (Up and Down), get_round_tally, is_watcher/get_watcher_count (see section 5); NOT YET for: remove_watcher, pause/unpause, duplicate-check rejection live |

### `sla_vault`

| Behavior | Test | Status |
|---|---|---|
| initialize | `test_initialize_succeeds` | TESTED LOCALLY, VERIFIED live (see section 5) |
| initialize twice fails | `test_initialize_twice_fails` | TESTED LOCALLY |
| create_sla, locks bond, returns id | `test_create_sla_locks_bond_and_returns_id` | TESTED LOCALLY, VERIFIED live |
| create_sla zero bond fails | `test_create_sla_zero_bond_fails` | TESTED LOCALLY |
| create_sla zero penalty fails | `test_create_sla_zero_penalty_fails` | TESTED LOCALLY |
| create_sla penalty exceeding bond fails | `test_create_sla_penalty_exceeding_bond_fails` | TESTED LOCALLY |
| create_sla zero quorum_threshold fails | `test_create_sla_zero_quorum_threshold_fails` | TESTED LOCALLY (added in this pass) |
| top_up_bond increases balance | `test_top_up_bond_increases_balance` | TESTED LOCALLY |
| top_up_bond by non-provider fails | `test_top_up_bond_by_non_provider_fails` | TESTED LOCALLY |
| top_up_bond zero amount fails | `test_top_up_bond_zero_amount_fails` | TESTED LOCALLY |
| top_up_bond unknown SLA fails | `test_top_up_bond_unknown_sla_fails` | TESTED LOCALLY |
| trigger_settlement pays out when quorum confirms breach | `test_trigger_settlement_pays_out_when_quorum_confirms_breach` | TESTED LOCALLY, VERIFIED live |
| trigger_settlement below quorum fails | `test_trigger_settlement_below_quorum_fails` | TESTED LOCALLY |
| trigger_settlement twice, same round fails | `test_trigger_settlement_twice_same_round_fails` | TESTED LOCALLY |
| trigger_settlement caps payout at remaining balance | `test_trigger_settlement_caps_payout_at_remaining_balance` | TESTED LOCALLY |
| trigger_settlement unknown SLA fails | `test_trigger_settlement_unknown_sla_fails` | TESTED LOCALLY |
| cancel_sla by provider succeeds | `test_cancel_sla_by_provider_succeeds` | TESTED LOCALLY |
| cancel_sla by non-provider fails | `test_cancel_sla_by_non_provider_fails` | TESTED LOCALLY |
| cancel_sla unknown id fails | `test_cancel_sla_unknown_id_fails` | TESTED LOCALLY |
| settlement blocked after cancellation | `test_cancelled_sla_cannot_be_settled` | TESTED LOCALLY |
| withdraw_remaining_bond after cancel | `test_withdraw_remaining_bond_after_cancel_succeeds` | TESTED LOCALLY |
| withdraw_remaining_bond without cancel fails | `test_withdraw_remaining_bond_without_cancel_fails` | TESTED LOCALLY |
| withdraw_remaining_bond by non-provider fails | `test_withdraw_remaining_bond_by_non_provider_fails` | TESTED LOCALLY |
| withdraw_remaining_bond unknown SLA fails | `test_withdraw_remaining_bond_unknown_sla_fails` | TESTED LOCALLY |
| withdraw after partial settlement returns what is left | `test_withdraw_remaining_bond_after_partial_settlement_returns_what_is_left` | TESTED LOCALLY |
| pause by non-admin fails | `test_pause_by_non_admin_fails` | TESTED LOCALLY |
| pause blocks create_sla only, settlement still works while paused | `test_paused_contract_still_allows_settlement_of_existing_sla`, `test_paused_contract_rejects_new_sla` | TESTED LOCALLY |
| is_round_settled | exercised inside `test_trigger_settlement_*` tests | TESTED LOCALLY, VERIFIED live |
| get_sla, get_bond_balance | exercised inside multiple tests above | TESTED LOCALLY, VERIFIED live |
| quorum enforcement (real vote count, not just the zero-threshold gap) | `test_trigger_settlement_below_quorum_fails` | TESTED LOCALLY, VERIFIED live (3 real watcher votes reached quorum 3 on Testnet) |
| bond exhaustion | `test_trigger_settlement_caps_payout_at_remaining_balance` | TESTED LOCALLY |
| cross-contract call to watcher_registry, real interface not a mock | all `trigger_settlement` tests deploy both contracts | TESTED LOCALLY |

## 3. Watcher (`slasettle-hub/watcher`, Go)

| Behavior | Test file / function | Status |
|---|---|---|
| round_id calculation | `internal/round/round_test.go` | TESTED LOCALLY |
| config loading and validation | `internal/config/config_test.go` | TESTED LOCALLY |
| health check, real HTTP timeout | `internal/health/health_test.go` | TESTED LOCALLY (real `httptest` server, genuine timeout and refused connection, not mocked) |
| health check, real refused connection | `internal/health/health_test.go` | TESTED LOCALLY |
| ScVal decoding (`decodeScVal`), all primitive types | `contract_internal_test.go: TestDecodeScValPrimitives` | TESTED LOCALLY (real XDR encode/decode round trip, real types) |
| ScVal decoding, unhandled type / malformed XDR | `contract_internal_test.go: TestDecodeScValUnhandledTypeReturnsError`, `TestDecodeScValMalformedXDRReturnsError` | TESTED LOCALLY |
| argument encoding (u64, BytesN<32>, Address, CheckStatus enum) | `contract_internal_test.go` (`TestMustU64*`, `TestMustBytesN32*`, `TestMustAccountAddress*`, `TestMustCheckStatusEnum*`) | TESTED LOCALLY |
| invoke-contract host function construction | `TestBuildInvokeContractHostFunctionPreservesContractFunctionAndArgOrder` | TESTED LOCALLY |
| HasVoted, args sent in order | `TestHasVotedSendsArgsInOrderSlaIDRoundIDWatcher` | TESTED LOCALLY (mocked RPC) |
| HasVoted decodes true/false | `TestHasVotedDecodesTrue` | TESTED LOCALLY (mocked RPC) |
| HasVoted, non-bool result is an error | `TestHasVotedNonBoolResultIsAnError` | TESTED LOCALLY (mocked RPC) |
| HasVoted, RPC transport failure | `TestHasVotedPropagatesRPCTransportFailure` | TESTED LOCALLY (mocked RPC) |
| HasVoted, simulation error | `TestHasVotedPropagatesSimulationError` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, argument encoding order | `TestSubmitCheckSendsExpectedInvocationAndArgumentEncoding` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck applies simulated auth entries before signing | `TestSubmitCheckAppliesSimulatedAuthEntriesBeforeSigning` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, simulation failure aborts submission | `TestSubmitCheckDoesNotSubmitWhenSimulationFails` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, simulation RPC transport failure | `TestSubmitCheckDoesNotSubmitOnSimulationRPCTransportFailure` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, rejected before inclusion is not success | `TestSubmitCheckRejectedBeforeInclusionIsNotTreatedAsSuccess` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, poll terminal failure is an error | `TestSubmitCheckPollTerminalFailureIsAnError` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, poll transient not-found then success | `TestSubmitCheckPollTransientNotFoundThenSuccess` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, poll timeout does not report success | `TestSubmitCheckPollTimeoutDoesNotReportSuccess` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, malformed simulation response is an error | `TestSubmitCheckMalformedSimulationResponseIsAnError` | TESTED LOCALLY (mocked RPC) |
| SubmitCheck, source account load failure aborts before simulation | `TestSubmitCheckSourceAccountLoadFailureAbortsBeforeSimulation` | TESTED LOCALLY (mocked RPC) |
| any transaction actually submitted and confirmed by a real watcher process against live Testnet RPC | none | UNVERIFIED. No watcher daemon process has been run against live Testnet RPC as of this writing; the three real `submit_check` votes recorded in section 5 were submitted directly via `stellar contract invoke`, not by running this daemon. |
| account sequence number handling under real network conditions | `TestSubmitCheckSendsExpectedInvocationAndArgumentEncoding` and related (mocked) | TESTED LOCALLY only |

## 4. Indexer (`slasettle-hub/indexer`)

| Behavior | Test | Status |
|---|---|---|
| event decoding, generic ScVal handling | `src/rpc/decode.test.ts` | TESTED LOCALLY |
| event classification, all 8 kinds recognized | `src/ingest/classify.test.ts` | TESTED LOCALLY |
| database persistence, idempotent on re-processing | `src/db/db.test.ts` (`applying the same batch twice does not duplicate checks`) | TESTED LOCALLY |
| API serialization (all endpoints) | `src/api/routes.test.ts` | TESTED LOCALLY |
| pagination | `src/api/pagination.test.ts` | TESTED LOCALLY |
| clock handling | exercised via `GET /v1/clock` route tests | TESTED LOCALLY |
| RPC retry behavior on transient network error | `src/rpc/client.test.ts` (`withNetworkRetry retries...`, `...gives up after exhausting attempts`, `...does not retry a real HTTP error`) | TESTED LOCALLY |
| malformed / unknown events | `classify.test.ts` (`an unrecognized topic is skipped, not thrown`) | TESTED LOCALLY |
| CORS: allowed origin gets header | `src/api/server.test.ts` | TESTED LOCALLY, VERIFIED (confirmed live via curl against the running indexer with a real Origin header) |
| CORS: disallowed origin gets no header, never a wildcard | `src/api/server.test.ts` | TESTED LOCALLY, VERIFIED (confirmed live via curl) |
| checkpoint/cursor resume behavior | `src/ingest/poller.test.ts` | TESTED LOCALLY |

### Event-kind status individually

| Event | Decoder status | Real on-chain confirmation |
|---|---|---|
| `watcher_registered` | fixed against a real event (earlier commit history) | VERIFIED |
| `watcher_removed` | fixed against a real event (earlier commit history) | VERIFIED |
| `check_submitted` | fixed against a real event (earlier commit history) | VERIFIED |
| `sla_created` | fixed against a real event, this session | VERIFIED (tx `258c86d2a0de481d60240dd29cea6de490840bd29f78e550fb97fb4fb8028b7c`) |
| `settlement_paid` | fixed against a real event, this session | VERIFIED (tx `b1dc301a22f8381ee9705a72e214d212e1f1c81c9b0ac53729506708b286d85e`) |
| `bond_topped_up` | inferred from the `#[topic]` pattern that was correct for the other five | UNVERIFIED |
| `sla_cancelled` | inferred from the same pattern | UNVERIFIED |
| `bond_withdrawn` | inferred from the same pattern | UNVERIFIED |

## 5. Cross-contract path, live Testnet evidence that already exists

| Step | Status | Evidence |
|---|---|---|
| watcher_registry deployed and initialized | VERIFIED | contract `CBEZ3XBIWK2AWYGZRNDGNZG3AZTJHFMQL5HVWTEUZZ5HLSCO4QDFJB77` |
| sla_vault deployed and initialized, pointed at the registry | VERIFIED | contract `CBA4DFNUBVCPLEAUD5O2CHSUB6DRWUNM7A537EBVPAGDETFBB2CABXI2` |
| 5 watchers registered | VERIFIED | `watcher1`..`watcher5` registered via `register_watcher` |
| real SLA created (`sla_id: 0`), real token bond locked | VERIFIED | tx `258c86d2a0de481d60240dd29cea6de490840bd29f78e550fb97fb4fb8028b7c` |
| 3 real watcher votes (Down) for round 1 | VERIFIED | 3 separate `submit_check` transactions, one per watcher |
| real quorum tally read back as 3 | VERIFIED | `get_round_tally` read directly after the votes |
| permissionless `trigger_settlement` call succeeds | VERIFIED | tx `b1dc301a22f8381ee9705a72e214d212e1f1c81c9b0ac53729506708b286d85e` |
| real payout to beneficiary | VERIFIED | beneficiary token balance increased by exactly `10000000`, read back directly, not inferred |
| bond balance decremented correctly | VERIFIED | `get_bond_balance` read back `40000000` (`50000000 - 10000000`) |
| `is_round_settled` reflects the settlement | VERIFIED | read back `true` |
| the deployed `sla_vault.wasm` on Testnet matches the current fixed source (the `quorum_threshold == 0` fix) | BLOCKED / NOT DONE | the WASM hash built from current source (`6909713244...`) differs from what is actually live (`e075df0c...`, pre-fix). No redeploy has happened; this is a real, open decision, not an oversight. |

## 6. Frontend (`slasettle-hub/apps/web`)

| Behavior | Test | Status |
|---|---|---|
| money formatting/parsing (integer-safe) | `lib/format.test.ts` | TESTED LOCALLY |
| landing page renders | `app/page.test.tsx` | TESTED LOCALLY (unit/component level, jsdom) |
| theme toggle | `components/theme/theme-toggle.test.tsx` | TESTED LOCALLY |
| wallet connect button | `components/wallet/wallet-button.test.tsx` | TESTED LOCALLY (Freighter mocked) |
| transaction status states | `components/transaction-status.test.tsx` | TESTED LOCALLY |
| SLA creation form | `components/dashboard/create-sla-form.test.tsx` | TESTED LOCALLY (SDK/wallet mocked) |
| quorum meter | `components/status/quorum-meter.test.tsx` | TESTED LOCALLY |
| settlement list | `components/status/settlement-list.test.tsx` | TESTED LOCALLY |
| watcher grid | `components/status/watcher-grid.test.tsx` | TESTED LOCALLY |
| top-up, cancel, withdraw actions | no dedicated component test found for these three specifically | LOGICALLY COVERED (same `use-transaction.ts` build-sign-submit-poll path as create, which is tested) |
| provider SLA discovery (`use-provider-slas.ts`) | no dedicated test file found | UNVERIFIED at the hook level; the indexer endpoint it calls is TESTED LOCALLY (section 4) and VERIFIED live (returns real `sla_id: 0`, confirmed via curl in an earlier session) |
| public status page (`/status/[slaId]`) rendering with real data | none found | UNVERIFIED at the browser level; component-level pieces it's built from (quorum meter, settlement list, watcher grid) are TESTED LOCALLY |
| actual browser behavior: theme switching, responsive layout, animations, reduced motion, dark/light | none | BLOCKED. No Chrome extension has been connected in the environments used for this project so far; the dashboard also requires a real Freighter connection to render its wallet-gated content, which has not been available either. |
| actual Freighter connect/sign flow in a real browser | none | BLOCKED, same reason |
| loading and error states | `transaction-status.test.tsx` and the mocked-boundary tests above exercise these paths | TESTED LOCALLY |

## 7. Security and boundary coverage

| Boundary | Trusted input | Untrusted input | Failure behavior | Evidence | Status |
|---|---|---|---|---|---|
| wallet to frontend | Freighter's signed transaction | none (Freighter is the trust boundary itself) | `WalletError` on Freighter error, surfaced to the UI | `lib/wallet.ts`, `wallet-button.test.tsx` | TESTED LOCALLY |
| frontend to indexer | none | indexer's HTTP response body | `IndexerApiError` on non-2xx; `MissingIndexerConfigError` if unconfigured | `lib/indexer.ts` | TESTED LOCALLY |
| indexer to database | none, all inputs already decoded/typed | n/a, no raw external input reaches SQL directly | parameterized queries throughout `src/db/db.ts` | code review, no injection vector found | LOGICALLY COVERED |
| indexer to RPC | none | Soroban RPC's own response shape | typed decode via SDK, `withNetworkRetry` on transient failure | `src/rpc/client.test.ts`, `src/rpc/decode.test.ts` | TESTED LOCALLY |
| SDK to contract | none | Soroban RPC simulation result | `SorobanSimulationError` thrown with contract id, method, RPC message | `packages/sdk/src/client.test.ts` | TESTED LOCALLY |
| contract to token (SAC) | none | the token contract's own transfer call | transfer failure propagates as a transaction abort; no balance check before transfer beyond the arithmetic already validated at `create_sla`/`trigger_settlement` | `SECURITY.md`, contract source | LOGICALLY COVERED |
| contract to authorization (`require_auth`) | the signed transaction's own auth entries | none, Soroban itself enforces this | transaction fails before contract logic runs if auth is missing | contract tests (`*_by_non_provider_fails`, `*_by_non_admin_fails`, `*_by_non_watcher_fails`) | TESTED LOCALLY, VERIFIED live for the specific calls made in section 5 (all correctly authorized) |
| watcher to RPC | none | live RPC responses | mocked-transport tests cover transport failure, simulation failure, poll timeout, rejected-before-inclusion | section 3 | TESTED LOCALLY only, not against a real RPC endpoint |
| watcher to contract | its own signing key | none, it only ever signs its own vote | `SubmitCheck`'s auth is scoped to the watcher's own address only | contract source, `contract_rpc_test.go` | TESTED LOCALLY |

## 8. Cross-repository parity, rows requiring later validation

| Boundary | Status | Note |
|---|---|---|
| contract `SLAStatus`/`CheckStatus` encoding vs SDK decode | VERIFIED | `SLAConfig.status` one-element `ScVec` encoding documented and handled in `packages/sdk`; matches contract's `#[contracttype] enum` |
| contract events vs indexer decoder | see section 4's event table | VERIFIED for 5/8, UNVERIFIED for 3/8 |
| indexer response shape vs frontend types | LOGICALLY COVERED | `lib/indexer.ts` types match `SLASettle-indexer-api-spec.md`'s documented shape, not independently re-derived from a live response in this pass |
| network configuration vs wallet/RPC configuration | VERIFIED | same `NEXT_PUBLIC_SOROBAN_RPC_URL`/`NEXT_PUBLIC_NETWORK_PASSPHRASE` read by both `@slasettle/sdk` and `lib/wallet.ts` |
| contract IDs vs hub environment variables | VERIFIED for the currently deployed pair (see section 5), UNVERIFIED/BLOCKED for a redeployed pair since the `quorum_threshold` fix has not been redeployed | see `slasettle-vault` README's "Currently deployed on Testnet" section |
| round calculation (watcher's `floor(now / ROUND_LENGTH_SECONDS)`) vs indexer's `/v1/clock` | LOGICALLY COVERED | both read the same `ROUND_LENGTH_SECONDS` concept; not exercised together in a single live test |
| settlement transaction vs indexed settlement history | VERIFIED | the real `settlement_paid` event and its indexed row were confirmed to match the on-chain transaction field-by-field (see indexer commit history) |

## Unverified items (summary)

- Three indexer event kinds (`bond_topped_up`, `sla_cancelled`, `bond_withdrawn`) have never been observed as real on-chain events.
- No watcher daemon process has been run end-to-end against live Testnet RPC; all live votes recorded so far were submitted directly via the Stellar CLI, not by `go run ./cmd/watcher`.
- Provider SLA discovery and the public status page have no dedicated automated test at the hook/page level (only their component building blocks do).
- Round calculation vs the indexer's clock has not been exercised together in a live or automated test.

## Blocked items (summary)

- Browser-level frontend verification (theme, responsive layout, animations, reduced motion, Freighter connect/sign flow): no Chrome extension connected in the environments used so far.
- The currently deployed `sla_vault` contract predates the `quorum_threshold == 0` fix; verifying that fix live requires a redeploy, which has not happened and is a real open decision, not an oversight.
