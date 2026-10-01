# Final Technical Audit

Phase 29. A broad technical review of the whole current system, written before
any fix. Findings are recorded and classified, not repaired, except one tiny
documentation count (see section 15). No numerical score and no ranking is
given; severities are factual descriptions of the technical impact.

## 1. Scope and method

- **Audited:** vault `a774609` and hub `2bbd615` (the current `main` of both when
  the audit began; the hub is now `812c820` because of the one README count
  fix in section 15).
- **Read directly:** all contract source and tests, the watcher, indexer, SDK
  and frontend source, both CI workflows, and current GitHub state. Earlier
  reports were used only as pointers; each claim below was re-derived from
  source, a running check, or a fresh read-only Testnet query.
- **Checks run 2026-09-29:** on-chain WASM fetch, hash and metadata; spec diff
  of live versus current build; live ledger-entry lifetimes
  (`getLedgerEntries`); the indexer's route inputs (including malformed ones)
  against an in-memory database; a search for invalid `Account` constructions;
  a search for lifetime-extension and restore handling; the full validation
  suite (section 13).
- **Status vocabulary:** `VERIFIED`, `TESTED LOCALLY`, `LOGICALLY COVERED`,
  `UNVERIFIED`, `KNOWN LIMITATION`, `BLOCKED`, `DEFECT`.
- **Finding categories:** DEFECT, DOCUMENTATION ERROR, TEST GAP, EVIDENCE GAP,
  DEPLOYMENT DIVERGENCE, SECURITY CONCERN, TOOLCHAIN/REPRODUCIBILITY ISSUE,
  INTENTIONAL DIFFERENCE, KNOWN LIMITATION, BLOCKED, NO FINDING.

Three notions of "the same" are kept apart throughout: the **public
interface**, the **byte-for-byte artifact**, and the **runtime
implementation**. Sections 2 and 3 audit them separately.

## 2. Current deployment vs source

Live contracts: `watcher_registry`
`CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`, `sla_vault`
`CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL` (deployed
2026-09-27).

| Aspect | Live (fetched 2026-09-29) | Current source build (this environment) | Verdict |
|---|---|---|---|
| `watcher_registry` WASM SHA-256 | `4c626d2c…` | `73a3fbaa…` | artifacts differ |
| `sla_vault` WASM SHA-256 | `69097132…` | `10c53424…` (CI, rustc 1.98.1, at `8d9c517`: `951f28b5…`) | artifacts differ |
| soroban-sdk (WASM `rssdkver`) | 27.0.6 | 28.0.0 | differ |
| rustc (`rsver`) | 1.97.1 | 1.97.1 locally, 1.98.1 in CI | local equals live; CI differs |
| extra meta | none | `rssdk_spec_shaking: 2` | differ |
| functions, arguments, return types, errors, events | 10 registry and 11 vault functions | same | **public interface identical** (spec diff shows only the private `DataKey` union missing from the 28.0.0 build, and doc strings) |
| spec doc strings | contain the stale text (`trigger_settlement` "caller is recorded only in the event"; `submit_check` "endpoint_hash is stored on the check record") | corrected text | differ; the stale text is permanently in the on-chain spec of the live contracts |
| `create_sla` rejects `quorum_threshold == 0` | yes (`4dd421f`, 2026-09-27, before deployment; rejected live `#7`) | yes | same runtime behavior |
| `withdraw_remaining_bond` rejects a zero balance | **no** (pre-fix: no-op emitting `amount: 0`, tx `0dbbb2e8…`) | yes (`99be8a1`, 2026-09-28) | **runtime differs** |
| comment-only source changes | n/a | change the doc strings embedded in the spec, so change the hash (`8d9c517`) | artifact differs, behavior does not |

Source changes to `contracts/` after deployment (`git log`): `99be8a1`
(behavior) and `8d9c517` (comments); plus the soroban-sdk bump in `Cargo.toml`
and `Cargo.lock`. The single behavior change absent on-chain is the zero-balance
withdrawal rejection. The `quorum_threshold == 0` fix predates deployment and
is live, as the deployed evidence and the live rejection show.

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Live artifacts differ from every current build | DEPLOYMENT DIVERGENCE | KNOWN LIMITATION | hashes above; spec metadata | none unless a redeploy is decided (vault issue #3) |
| Live runtime lacks the zero-balance withdrawal rejection | DEPLOYMENT DIVERGENCE | BLOCKED (needs a redeploy) | live tx `0dbbb2e8…`; `99be8a1`; local test only | keep documented |
| Same source, different hash by Rust version and by comment edits | TOOLCHAIN/REPRODUCIBILITY ISSUE | KNOWN LIMITATION | local `10c53424…` versus CI `951f28b5…`, same source | keep documented |
| Public interface parity | NO FINDING | VERIFIED | spec diff, on-chain fetch | none |
| Stale doc strings are frozen in the live contracts' on-chain spec | DEPLOYMENT DIVERGENCE | KNOWN LIMITATION | live spec JSON | note in docs; cannot change without a redeploy |

## 3. Contract findings

### 3.1 Authorization, method by method

Every contract test calls `env.mock_all_auths()`, so no test shows that a
missing signature is rejected. What the tests do prove is the contract's own
role comparison. Live evidence for signature enforcement is only that
correctly signed calls succeeded; no live wrongly signed call was recorded.

| Method | Intended authorizer | `require_auth` in source | Caller equality check | Test evidence | Live evidence | Strength |
|---|---|---|---|---|---|---|
| registry `initialize` | `admin` | yes | n/a (sets admin); repeat gives `AlreadyInitialized` | `test_initialize_twice_fails` (mocked auth) | double-init `#2` | signature: LOGICALLY COVERED; repeat-init: VERIFIED |
| registry `register_watcher` | admin | yes, via `require_admin` | yes, against stored admin | `test_register_watcher_by_non_admin_fails` | 5 registrations by admin | role check TESTED LOCALLY; signature LOGICALLY COVERED |
| registry `remove_watcher` | admin | yes | yes | (no dedicated non-admin test) | removal by admin | role check LOGICALLY COVERED |
| registry `pause` / `unpause` | admin | yes | yes | `test_pause_by_non_admin_fails` | pause and unpause by admin | role check TESTED LOCALLY |
| registry `submit_check` | the voting `watcher` | yes, `watcher.require_auth()` | must be a registered watcher | `_by_non_watcher_fails`, `_duplicate_…`, `_while_paused_fails` | 10 live votes | registered-watcher check TESTED LOCALLY; signature LOGICALLY COVERED |
| vault `initialize` | admin | yes | repeat gives `AlreadyInitialized` | `test_initialize_twice_fails` | init tx | LOGICALLY COVERED |
| vault `create_sla` | provider | yes | none needed (provider is the caller) | argument-validation tests | live create | signature LOGICALLY COVERED |
| vault `top_up_bond` | provider | yes | `caller == config.provider` | `_by_non_provider_fails` | live top-ups | equality TESTED LOCALLY |
| vault `trigger_settlement` | nobody | deliberately none | none | tests pass `admin`, which cannot distinguish permissionless from admin-allowed | live settlement by an unrelated account | VERIFIED (live only) |
| vault `cancel_sla` | provider | yes | equality | `_by_non_provider_fails` | live cancel | equality TESTED LOCALLY |
| vault `withdraw_remaining_bond` | provider | yes | equality | `_by_non_provider_fails` | live withdraw | equality TESTED LOCALLY |
| vault `pause` / `unpause` | admin | yes | yes | `test_pause_by_non_admin_fails` | live | equality TESTED LOCALLY |

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| `mock_all_auths()` hides the missing-signature case in every contract test | TEST GAP | LOGICALLY COVERED (`require_auth` is host-enforced) | `test.rs` in both crates | add tests with explicit `mock_auths` or no mocking, or record a live wrongly-signed rejection |
| The permissionless test uses `admin` as caller | TEST GAP | live VERIFIED, local weak | `test_trigger_settlement_pays_out_…` | add a test with an unrelated account |
| `cancel_sla` has no status check, so a repeat call emits another `SlaCancelled` event | DEFECT (low) | source and live behavior; no state harm | `sla_vault/src/lib.rs` `cancel_sla`; no test | see 3.3 |
| `top_up_bond` works on a cancelled SLA (no status check) | INTENTIONAL DIFFERENCE | documented in `apps/docs/contracts.md` | source | none |

### 3.2 Settlement path

watcher vote, tally, cross-contract read, quorum comparison, balance, payout,
transfer, decrement, settled flag, event.

- **Quorum.** `votes_down < quorum_threshold` gives `QuorumNotMet`; `votes_up`
  is not consulted, so the rule is "at least N down votes", not a majority
  (4 up and 3 down settles at quorum 3). Documented in `lifecycle.md`; some
  earlier wording said watchers "agree" and was corrected on 2026-09-29.
  INTENTIONAL DIFFERENCE. Provider-chosen `quorum_threshold` is not bounded by
  the registry's watcher count, so a threshold above the watcher count can
  never settle; `create_sla` rejects only zero. KNOWN LIMITATION (undocumented).
- **Removed watchers.** A removed watcher's earlier votes stay in the tally.
  KNOWN LIMITATION (undocumented).
- **Order.** `trigger_settlement` performs the token `transfer` first, then
  writes the balance and settled flag, then emits the event. Any failure aborts
  the whole transaction, so the writes and event are all-or-nothing. Soroban
  does not permit re-entering the same contract. NO FINDING.
- **Cancelled SLA.** Settlement returns `SlaNotActive`; live `#3` observed.
  VERIFIED.
- **Duplicate settlement.** `SettledRounds` flag; live `#4`. VERIFIED.
- **Overflow.** `[profile.release] overflow-checks = true`. NO FINDING.
- **Token semantics.** Transfers use the token client; a failing transfer
  aborts. A non-contract `token` fails at the transfer, not at `create_sla`
  validation. INTENTIONAL DIFFERENCE.

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| **Payout capping (`min(penalty, balance)`) is not exercised by any test.** Every vault test uses bond `1000` and penalty `500`, so balances are always `1000`, `500`, `0`; `test_trigger_settlement_caps_payout_at_remaining_balance` reaches `BondExhausted` at balance `0` and never a partial payout. The `balance < penalty` branch has never run locally or live. | TEST GAP and EVIDENCE GAP (and a correction: earlier evidence records in this repository, including the 2026-09-29 parity matrix, traceability record and evidence ledger, classify capping as TESTED LOCALLY; that is not supported) | LOGICALLY COVERED (source reading only) | `sla_vault/src/test.rs` lines 153 to 300, all fixtures `1_000`/`500`; `trigger_settlement` step 5 in `lib.rs` | add a test whose bond is not a multiple of the penalty; correct the records to LOGICALLY COVERED |
| Below-quorum and unregistered-watcher rejections have no live evidence | EVIDENCE GAP | TESTED LOCALLY | evidence ledger E4, D4 | optional live rejection records |
| Exhausted bond gives `BondExhausted` | NO FINDING | TESTED LOCALLY | `…_caps_payout_…` (balance 0 case) | none |

### 3.3 Other contract observations

- **Quorum-zero fix** live: VERIFIED. **Zero-balance fix**: source only
  (BLOCKED live). **Event shapes**: all eight re-verified against live events
  on 2026-09-29 (section 8).
- `cancel_sla` repeat events: an indexer or consumer that counted
  `sla_cancelled` events would over-count; the hub indexer ignores them.

## 4. Watcher findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Configuration is environment-only (`os.LookupEnv`); no `.env` loader; `NETWORK_PASSPHRASE` needs quoting | INTENTIONAL DIFFERENCE | documented | `config.go`; `watcher/README.md`, `.env.example` | none |
| Secret handling: `WATCHER_SECRET_KEY` is parsed once, never logged; startup log names only `sla_id`, `target`, `round_length` | NO FINDING | VERIFIED for observed logs; LOGICALLY COVERED for all paths | `main.go`; 2026-09-29 live run | none |
| Round computed from the local wall clock; checks `has_watcher_voted` first; sleeps to the next boundary; if the timer wakes marginally early it re-runs for the same round, sees the vote, and re-sleeps | NO FINDING | TESTED LOCALLY (`round_test.go`); VERIFIED live | `round.go`, `main.go` | none |
| HTTP check: `http.Client` with `HTTP_TIMEOUT_SECONDS`, default redirect following, so the final status decides up or down; a redirect chain ending in an error is Down | INTENTIONAL DIFFERENCE | TESTED LOCALLY (real `httptest`) | `health.go` | none |
| A failed submission is logged and skipped until the next round; no retry or backoff | KNOWN LIMITATION | documented | `runOneRound`; watcher README | none |
| `SubmitCheck` runs on the process context with no per-round deadline; a stalled RPC could hold the loop past a round boundary (it then resumes and skips a round already voted) | KNOWN LIMITATION (undocumented, low) | LOGICALLY COVERED; poll timeout tested with a mock | `contract.go` `submitAndPoll`; `TestSubmitCheckPollTimeoutDoesNotReportSuccess` | document, or add a per-round deadline in a later phase |
| One process per SLA | KNOWN LIMITATION | documented | `config.SLAID` | none |
| Down mapping and the "already voted, skipping" branch have not been observed from the daemon; `main.go` has no tests | EVIDENCE GAP | LOGICALLY COVERED | `cmd/watcher` has no `_test.go` | optional |
| Daemon live verification: four rounds on one machine, one disposable account, one SLA, all `Up` | EVIDENCE GAP (scope) | VERIFIED for what it covers | `phase-23…` Part C | none |
| Watcher comments and docs no longer overstate the daemon (`round.go` corrected 2026-09-29) | NO FINDING | VERIFIED by reading | `round.go` header | none |

## 5. Indexer findings

Routes were exercised on 2026-09-29 against a fresh indexer on live Testnet
and, for malformed inputs, against the built app with an in-memory database.

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| **`GET /v1/slas/:slaId/settlements?limit=1.5` returns HTTP 500 `{"error":"internal_error"}`.** Reproduction: `buildApp` on an in-memory database with two settlement rows, request `?limit=1.5`. Root cause: only `limit < 0` is rejected; a non-integer positive value is bound as `LIMIT 2.5`, which SQLite rejects. Component: `indexer/src/api/routes.ts`. Impact: an unhandled 500 for a malformed query parameter; no data exposure or write. Source-only (the indexer is not deployed). | DEFECT (low) | DEFECT, reproduced, no test | probe run 2026-09-29; `routes.ts` | recommended next phase: validate `limit` as an integer (reject or floor), add a regression test |
| Other malformed inputs behave as documented: `0`, `abc`, `NaN`, `Infinity`, empty, repeated `limit` give the default or the cap; `-5` and `-Infinity` give 400; a bad `before` is ignored; `1e1`/`0x10` parse to 10 and 16 | NO FINDING | TESTED LOCALLY (partly) | probe; `routes.test.ts` | none |
| The earlier `accountId is invalid` defect is gone; the only two `new Account(` constructions in the hub (`liveReads.ts`, SDK `client.ts`) use `Keypair.random().publicKey()` | NO FINDING | VERIFIED | search; live settlement request 2026-09-29 | none |
| The lazy `quorum_threshold` read runs once per row whose cached value is null: `setSlaQuorumThreshold` caches it, but the other rows in the already-loaded page keep `null`, so a first request over N null rows makes N RPC calls; any failed call returns 500 | KNOWN LIMITATION (low, undocumented) | LOGICALLY COVERED | `routes.ts` settlements handler; a transient `fetch failed` gave 500 during the 2026-09-29 live check | optional: fill the cached value into the remaining rows |
| The null-`quorum_threshold` path has no route-level test (the added tests use non-null rows; `liveReads.test.ts` covers the read itself) | TEST GAP | TESTED LOCALLY (unit only) | `routes.test.ts`, `liveReads.test.ts` | optional |
| Ingestion, ordering, idempotency, checkpoint, restart | NO FINDING | VERIFIED (recovery record; live re-decode) | `db.ts`, `classify.ts`, `poller.ts`; recovery record; parity matrix §0.5, §0.6 | none |
| An unknown status symbol is stored as `up` | KNOWN LIMITATION | LOGICALLY COVERED | `classify.ts` | none |
| No authentication; binds all interfaces (`app.listen(port)` with no host); CORS is browser-only protection | KNOWN LIMITATION | documented | `server.ts`, `index.ts`; topology | none |
| Event history older than RPC retention cannot be rebuilt; the SQLite file is the only copy | KNOWN LIMITATION | documented | poller, README | none |
| Local database files: `indexer/.gitignore` covers `*.db`, `*.db-journal`, not the `data/` directory, `-wal`, `-shm` or backups | KNOWN LIMITATION | VERIFIED | `git status` shows `indexer/data/` | optional ignore rule |

## 6. SDK findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Wrapped: 8 of 11 vault methods (`create_sla`, `top_up_bond`, `trigger_settlement`, `cancel_sla`, `withdraw_remaining_bond` as unsigned builders; `get_sla`, `get_bond_balance`, `is_round_settled` as reads) and 4 of 10 registry methods (reads only). Absent: vault `initialize`, `pause`, `unpause`; registry `initialize`, `register_watcher`, `remove_watcher`, `pause`, `unpause`, `submit_check`. Every absence is an admin or watcher operation and is documented in `types.ts`, `index.ts` and the SDK README | INTENTIONAL DIFFERENCE | LOGICALLY COVERED | `packages/sdk/src/index.ts` | none |
| Reads decode the live contracts: struct fields, enums, bigints, tally, a contract error message | NO FINDING | VERIFIED | parity matrix §0.4 | none |
| Write builders: argument order and types tested by round-tripping; never signed or submitted live from the SDK | EVIDENCE GAP | TESTED LOCALLY | `sla-vault.test.ts` | with claim "signed dashboard writes" |
| No signing code; `Keypair.random()` only makes a throwaway public key for simulation | NO FINDING | LOGICALLY COVERED | source grep | none |
| `SorobanSimulationError` carries the raw RPC message; no error-name mapping; no SDK test for it | TEST GAP | VERIFIED live, no unit test | `client.ts`; matrix §0.4 | optional test |
| No handling of a simulation that requires restoring archived ledger entries (`restore` is not referenced anywhere in the hub); `prepareTransaction` would surface it as an error | EVIDENCE GAP / KNOWN LIMITATION | LOGICALLY COVERED | search; see section 11 | document or handle in a later phase |
| Config is read once and cached at module level (`getSdkConfig`) | INTENTIONAL DIFFERENCE | LOGICALLY COVERED | `client.ts` | none |

## 7. Frontend findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Freighter connect, disconnect, reconnect, address display, network identification, mismatch indicator, public status page without a wallet | NO FINDING | BROWSER VERIFIED (2026-09-29, one session) | phase-23 Part B | none |
| Dashboard builders (create, top-up, cancel, withdraw) and trigger action | EVIDENCE GAP | LOCAL TESTED (create form only, mocked) and SOURCE ONLY; signed writes UNVERIFIED | `create-sla-form.test.tsx`; source | as already tracked (issue #12) |
| Create form validates the amounts it can (`penalty > bond`), reads token decimals, formats with bigint | NO FINDING | LOCAL TESTED | `format.test.ts`, form source | none |
| The status page offers "trigger settlement" only for the current round (`roundId` is the clock's current round). Once a round ends, a quorum-reaching earlier round cannot be settled from the UI, although anyone can settle it with another tool | KNOWN LIMITATION (undocumented) | SOURCE ONLY | `status-view.tsx`, `trigger-settlement-action.tsx` | document in the end-user guide, or add a round input later |
| Network mismatch is a warning only | KNOWN LIMITATION | BROWSER VERIFIED behavior; issue #13 | `network-indicator.tsx` | none |
| `NEXT_PUBLIC_*` values are build-time and public | INTENTIONAL DIFFERENCE | LOGICALLY COVERED | topology, env docs | none |
| Theme and reduced motion: source has a `prefers-reduced-motion` rule and a theme store; neither observed in the app | EVIDENCE GAP | SOURCE ONLY (`globals.css:177`; `theme-toggle.test.tsx` LOCAL TESTED) | issue #12 | as tracked |
| Mobile and narrow viewport | EVIDENCE GAP | UNVERIFIED | issue #12 | as tracked |
| Landing and metadata copy corrected 2026-09-29 | NO FINDING | VERIFIED by reading | commit `af1bbdc` | none |
| Network indicator and status page have no unit tests | TEST GAP | BROWSER VERIFIED only | source tree | optional |

## 8. Event findings

All eight kinds were compared across contract source, raw live events (fetched
2026-09-29 from both contracts and decoded with the indexer's own code), the
decoder, the database schema and the API.

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Topic 0 is the snake_case event name; topic order and data shapes match for `watcher_registered`, `watcher_removed`, `check_submitted`, `sla_created`, `bond_topped_up`, `settlement_paid`, `sla_cancelled`, `bond_withdrawn` | NO FINDING | VERIFIED | parity matrix §4, §0.5, §0.6 | none |
| `u64` topics and `i128` data decode as bigints and are stored and served as strings | NO FINDING | VERIFIED | `amountToString`, routes, live output | none |
| Status enum is a one-element vec (`["Up"]`) on the wire, lowercase in the database and API | INTENTIONAL DIFFERENCE | VERIFIED | matrix §2 | none |
| Three kinds are decoded but deliberately not persisted | INTENTIONAL DIFFERENCE | TESTED LOCALLY | `classify.test.ts` | none |
| `sla_cancelled` can repeat for one SLA (section 3.1) | see 3.1 | source and live behavior | source | see 3.1 |
| `endpoint_hash` is not in any event or storage | NO FINDING (documentation corrected) | VERIFIED by source | `watcher_registry/src/lib.rs` | none |

## 9. Network and round findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Passphrase `Test SDF Network ; September 2015` and RPC `https://soroban-testnet.stellar.org` are identical in every service and match the RPC's `getNetwork`; the SDK, watcher and indexer take them from the environment with Testnet defaults (the SDK and frontend have none) | NO FINDING | VERIFIED | parity matrix §5 | none |
| The indexer's `explorer_url` is hardcoded to Testnet; the frontend chooses public or testnet from the passphrase | KNOWN LIMITATION | LOGICALLY COVERED | `routes.ts`; `network.ts` | none |
| Rounds: contracts treat `round_id` as an opaque `u64`; the watcher floors its wall-clock seconds; the indexer floors the latest ledger's close time; the frontend uses the indexer's value. Units are seconds throughout; no ms/s mismatch | NO FINDING | VERIFIED (indexer live), TESTED LOCALLY (watcher; indexer route tests) | `round.go`, `routes.ts`, tests | none |
| The indexer's round can trail a watcher's by up to about one ledger interval at a boundary, and a watcher and an indexer with different `ROUND_LENGTH_SECONDS` disagree silently | KNOWN LIMITATION | documented | api.md; matrix §9 | none |
| Contracts accept any `round_id`; a watcher can vote for any round and anyone can settle any round | KNOWN LIMITATION | documented | spec "Round IDs" | none |

## 10. Economic and token findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| `create_sla` rejects bond, penalty and quorum of zero or less, and penalty above bond; `top_up_bond` rejects a non-positive amount | NO FINDING | TESTED LOCALLY; zero quorum also VERIFIED live | tests `test_create_sla_*`, `test_top_up_bond_zero_amount_fails` | none |
| Full-penalty payout and the exhausted-bond rejection | NO FINDING | VERIFIED (full payout); TESTED LOCALLY (exhaustion) | live `6522d8b7…` | none |
| Partial payout (`0 < balance < penalty`) | EVIDENCE GAP | LOGICALLY COVERED only (section 3.2) | section 3.2 | add a test |
| i128 handling: bigint in the SDK, strings in the indexer, string-based frontend formatting; release build traps on overflow | NO FINDING | TESTED LOCALLY | `format.test.ts`, SDK tests, `Cargo.toml` | none |
| `uptime_target_bps` is stored, displayed and never enforced; the create form accepts values above 100 percent | INTENTIONAL DIFFERENCE | documented | spec; form | none |
| The provider chooses beneficiary, quorum and penalty; the shared watcher set is admin-controlled | KNOWN LIMITATION | documented (watcher set), undocumented (provider-chosen quorum) | source | note in the spec |

## 11. Storage and TTL findings

Live lifetimes were read with `getLedgerEntries` on 2026-09-29 (latest ledger
about 4932274).

| Entry | Lives until (ledger) | Remaining | Note |
|---|---|---|---|
| `sla_vault` contract instance | 5026618 | about 5.5 days | equals the deployment ledger plus the network default of 120960 ledgers |
| `watcher_registry` contract instance | 5026543 | about 5.5 days | same |
| vault `Sla(0)`, `BondBalance(0)` | 5424117 | about 28.5 days | creation ledger plus 518400 |
| vault `SettledRounds(0,1)` | 5424184 | about 28.5 days | |
| registry `Watcher(watcher1)` | 5424006 | about 28.5 days | equals its registration ledger 4905606 plus 518400 |
| registry `Tally(0,1)` | 5424162 | about 28.5 days | |

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| **Neither contract ever extends the lifetime of its instance storage (`Admin`, `Paused`, `NextSlaId`, `WatcherCount`, `WatcherRegistry`).** Reproduction: no `instance().extend_ttl` call exists in either `lib.rs`; the live instances expire at ledgers 5026543 and 5026618, roughly 2026-10-05, about a week after deployment. Root cause: only persistent entries are extended (`storage.rs` constants). Impact: after expiry every call to the affected contract fails until someone restores and extends the entries; no state is deleted (Soroban archives persistent-class entries) and funds are not lost, but the deployed system stops working. Affects the deployed contracts and the source. | DEFECT (medium, liveness) | DEFECT, reproduced from live ledger data; the restore step itself was not run | live `getLedgerEntries`; source search | recommended next phase: extend instance lifetime in the contracts (needs a redeploy to affect the live pair, so BLOCKED for the live one) and, for the live pair, decide whether to extend externally |
| The lifetime of the deployed contracts' WASM code entries was not read | EVIDENCE GAP | UNVERIFIED | script could not decode the code key | read it in a later phase |
| Per-watcher registration, SLA config and bond balance are extended only when written: `submit_check` and `trigger_settlement` read `Watcher`/`Sla` without extending them, and `cancel_sla` writes the SLA without extending it. A watcher registered once stops being eligible about 30 days later (the `has` check fails on an archived entry) unless restored or re-registered | KNOWN LIMITATION (partly documented) | VERIFIED for the `Watcher(watcher1)` value (equals registration plus 518400) | live read; `storage.rs`; `SEC` "TTL behavior" says worst case is a liveness concern | note the watcher case in docs |
| The 2026-09-28 review says no function silently reads a default in place of expired state. `get_bond_balance` returns `0` for a missing key, but Soroban archives rather than deletes persistent entries, so an archived entry fails the transaction instead of reading as absent | NO FINDING (claim reasoned, not tested) | LOGICALLY COVERED | source; Soroban archival behavior not tested here | none |
| No restore handling in the SDK, frontend or watcher | EVIDENCE GAP | LOGICALLY COVERED | section 6 | as above |
| Key composition, duplicate prevention and defaults (`Check(sla,round,watcher)`, `Tally(sla,round)`, `SettledRounds(sla,round)`) | NO FINDING | TESTED LOCALLY and VERIFIED | tests; live rejections | none |
| `Tally` and `Check` entries are never deleted | INTENTIONAL DIFFERENCE | LOGICALLY COVERED | source | none |

## 12. Security findings

This is an internal review only. No independent audit exists.

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Auth boundaries: section 3.1. Frontend and SDK never hold a key; watcher key only in process environment | NO FINDING | LOGICALLY COVERED; wallet boundary BROWSER VERIFIED | source; phase-23 | none |
| Signature enforcement never tested locally or rejected live | TEST GAP | LOGICALLY COVERED | section 3.1 | see 3.1 |
| Indexer API unauthenticated, all interfaces, no rate limit; CORS allowlist explicit | KNOWN LIMITATION | documented | `server.ts` | none |
| The Next app sets no custom security headers (`next.config.ts` has none) | SECURITY CONCERN (low, informational) | SOURCE ONLY | config | consider before any hosting |
| CI: both workflows have no `permissions:` block, and the repository default is `read` for `GITHUB_TOKEN` (API, 2026-09-29); actions are referenced by tag (`@v7`, `@v6`, `@v2`), not commit SHA | SECURITY CONCERN (low) | VERIFIED | `ci.yml`; workflow-permissions API | optional: add an explicit `permissions: contents: read`; pin by SHA |
| Vulnerability reporting: private reporting disabled; public issue only | KNOWN LIMITATION | VERIFIED | API; `SECURITY.md` | none |
| Secret scanning: a manual pattern scan of history only; the dedicated tool did not run | EVIDENCE GAP | UNVERIFIED | recovery and review records | as tracked |
| Dependency and vulnerability scans are dated 2026-09-28 and were not re-run here | EVIDENCE GAP | TESTED LOCALLY (dated) | review record | re-run in a later phase if needed |
| Live contracts' on-chain spec carries stale doc text | DEPLOYMENT DIVERGENCE | KNOWN LIMITATION | section 2 | none |
| Local repository holds an unpublished backup tag `pre-attribution-rewrite-backup` in both repositories (not on the remote, not an ancestor of `main`) | NO FINDING (hygiene note) | VERIFIED | `git tag`; GitHub tags API returned none | none |
| No secret files tracked; `.env`, `.env.local`, `watcher/.env` are gitignored | NO FINDING | VERIFIED | `git ls-files`, `check-ignore` | none |

## 13. Dependency and toolchain findings

Validation, run 2026-09-29 on the current trees:

| Suite | Result |
|---|---|
| vault `cargo check --workspace` | passes |
| vault `cargo test --workspace` | 29 + 17 = 46 pass |
| vault `stellar contract build` | passes |
| vault `cargo fmt --check` | fails, 9 diffs (known drift, unchanged by recent commits) |
| vault `cargo clippy --workspace --all-targets --all-features` | 2 known `needless_borrows_for_generic_args` warnings in `sla-vault` |
| hub `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `build` | pass |
| SDK, web | 29/29, 50/50 |
| indexer `npm test`, `npm run build` | 44/44, passes |
| watcher `go build`, `go vet`, `go test -count=1` | pass (48 tests) |
| docs `pnpm --filter @slasettle/docs run build` | passes |

| Item | Local | CI | Documented |
|---|---|---|---|
| Rust | 1.97.1 | 1.98.1 (`stable`, floating) | "current stable"; 1.91.0 minimum not reverified for 28.0.0 |
| soroban-sdk | 28.0.0 | 28.0.0 | 28.0.0; live 27.0.6 |
| Stellar CLI | 27.0.0 | 27.0.0 (pinned in workflow) | 27.0.0; evidence records 28.1.0 as newest |
| Node | 24.21.0 | `.nvmrc` 24.21.0 | 24.21.0 |
| pnpm | global 12.5.1, `packageManager` pin 12.4.2 used by the repo | 12.4.2 | 12.4.2 |
| Go | 1.25.1 | `1.25` (latest patch) | 1.25; issue #14 |

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Rust differs between local and CI, so the same source has different WASM hashes | TOOLCHAIN/REPRODUCIBILITY ISSUE | KNOWN LIMITATION | section 2 | none |
| Local Go 1.25.1 is behind on standard-library patches; CI uses the current patch | TOOLCHAIN/REPRODUCIBILITY ISSUE | KNOWN LIMITATION (issue #14) | version output | none |
| fmt drift and 2 clippy warnings | KNOWN LIMITATION | VERIFIED | outputs above | none |
| Global pnpm (12.5.1) differs from the repository pin | INTENTIONAL DIFFERENCE | VERIFIED | version output | none |

## 14. Test-quality findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Contract error assertions are precise: 27 use `assert_eq!(result, Err(Ok(Error::X)))`, none is a bare `is_err()` | NO FINDING | TESTED LOCALLY | `grep` of both `test.rs` | none |
| `mock_all_auths()` in every contract test | TEST GAP | see 3.1 | | see 3.1 |
| Permissionless test uses `admin` | TEST GAP | see 3.1 | | see 3.1 |
| **`…caps_payout_at_remaining_balance` passes for a different reason than its name states**: it asserts the exhausted-bond error and the total paid; fixtures never produce a partial payout | TEST GAP | see 3.2 | | see 3.2 |
| Watcher: mocked-RPC tests cover the submit and poll paths; `main.go` (skip, mapping, shutdown) has none | TEST GAP | live-observed for shutdown and Up mapping | `watcher` | optional |
| Indexer: all six routes now have route tests; no test for a non-integer `limit` or a null-`quorum_threshold` row through the route | TEST GAP | TESTED LOCALLY | `routes.test.ts` | with DEF in section 5 |
| Frontend: no tests for the network indicator or the status page; wallet button tests mock Freighter | TEST GAP | BROWSER VERIFIED for the behaviors | source tree | optional |
| SDK: no test for `SorobanSimulationError` | TEST GAP | VERIFIED live | | optional |
| Tests that would fail if the behavior were false (regressions): withdraw twice, quorum zero, settlements limit, `liveReads`, watcher ordering | NO FINDING | TESTED LOCALLY | recorded bidirectional checks | none |

## 15. Documentation findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| `indexer/README.md` said 36/36; the suite has 44 | DOCUMENTATION ERROR | corrected in this phase (`812c820`) | README | none |
| Evidence records classify payout capping as TESTED LOCALLY (parity matrix §14, ledger E5, traceability claim 10, external review Q18, `SEC` note wording, and earlier phase reports): not supported, see 3.2 | DOCUMENTATION ERROR | open | section 3.2 | correct to LOGICALLY COVERED in a later phase; preserve the historical records |
| The docs' TTL sections describe persistent entries only and do not mention instance storage; `SEC` states the persistent-entry behavior accurately | DOCUMENTATION ERROR (omission) | open | `contracts.md`, spec | document with DEF in section 11 |
| The end-user guide does not say the UI can trigger settlement for the current round only | DOCUMENTATION ERROR (omission) | open | section 7 | document |
| Provider-chosen quorum above the watcher count never settles; removed watchers' votes still count | DOCUMENTATION ERROR (omission) | open | section 3.2 | document |
| Other reviewed documents (READMEs, `SECURITY.md`, `CONTRIBUTING.md`, spec, docs site, topology, ledger, matrix, traceability, external review): no further stale or unsupported statement found beyond the two evidence-classification items above | NO FINDING | LOGICALLY COVERED | read on 2026-09-29 | none |
| Historical records (dated evidence, Phase 9 test matrix) preserved | NO FINDING | VERIFIED | git history | none |

## 16. Git and repository findings

| Finding | Category | Current status | Evidence | Action required |
|---|---|---|---|---|
| Working trees are clean apart from local untracked files (`indexer/data/`; `.deployed-testnet.env`, `test_snapshots/` in the vault) | NO FINDING | VERIFIED | `git status` | none |
| Remote branches: vault `main`; hub `main` and `dependabot/npm_and_yarn/eslint-10.11.0` (PR #8). Merged Dependabot branches are gone. No remote tags, no releases, no Pages, deployments or environments | NO FINDING | VERIFIED | GitHub API | none |
| Branch protection: PR required (0 approvals), required checks equal the CI job names, no force push or deletion, `enforce_admins` off | NO FINDING | VERIFIED | earlier API read | none |
| CI green on the current `main` commits (vault `a774609`, hub `2bbd615`) | NO FINDING | VERIFIED | runs on GitHub | none |
| PR #8 open, CI failing on its head, untouched | NO FINDING | VERIFIED | `gh pr list` | none |
| Open issues: hub #10, #11 (updated), #12 (updated), #13, #14; vault #2, #3, #4 | NO FINDING | VERIFIED | `gh issue list` | none |

## 17. Evidence classification

External-reviewer repeat: from the two READMEs, the topology page, the ledger
and the contract spec an outsider can tell what is deployed (two Testnet
contracts), what runs only locally (everything else), what is verified and how,
what is unverified or blocked, and that historical evidence is dated. Remaining
ambiguity is limited to the items in section 15 and to the fact that the
evidence records use internal phase names.

| Class | Items |
|---|---|
| VERIFIED | live deployment and hashes; public interface parity; live settlement, duplicate rejection, cancel and withdraw; eight event shapes; SDK reads; six indexer routes on live data; four daemon rounds; wallet connect and public status page in a browser; CI and branch protection; instance and watcher lifetimes as read from the ledger |
| TESTED LOCALLY | contract role checks and error paths; duplicate vote and settlement; watcher mocked-RPC paths; indexer routes and ordering; SDK encodings; create form |
| LOGICALLY COVERED | signature enforcement (`require_auth`); payout capping; settlement ordering; watcher skip and Down paths; source-only frontend behaviors |
| UNVERIFIED | signed dashboard writes; narrow viewport; dedicated secret scanning; WASM code-entry lifetime; the restore path |
| KNOWN LIMITATION | commit-reveal absent; display-only uptime target; shared watcher set; opaque `round_id`; untuned lifetimes; unauthenticated indexer; Testnet-only explorer link; nothing hosted; no license; unreproducible hashes across toolchains |
| BLOCKED | live zero-balance withdrawal rejection; soroban-sdk 28.0.0 redeploy; any contract-side lifetime fix reaching the live pair |
| DEFECT | instance lifetime never extended (medium, deployed and source); `limit=1.5` returns 500 (low, source-only); repeat `cancel_sla` emits a duplicate event (low, deployed and source) |

### Defect detail

1. **Instance lifetime.** Reproduction: read the two contract-instance ledger
   entries (`getLedgerEntries` with `ScvLedgerKeyContractInstance`); their
   `liveUntilLedgerSeq` values are 5026543 and 5026618. Root cause: no
   `instance().extend_ttl` call in either contract. Affected: both contracts.
   Impact: unavailability from about 2026-10-05 unless entries are restored and
   extended; no data or funds are lost. Deployed and source. Recommended next
   phase: contract change plus a decision on an external extension of the live
   pair (the extension itself needs no redeploy).
2. **`limit=1.5`.** Reproduction and root cause in section 5. Affected:
   `indexer/src/api/routes.ts`. Impact: HTTP 500 for a malformed query. Source
   only. Recommended next phase: integer validation and a regression test.
3. **Repeat `cancel_sla`.** Reproduction: call `cancel_sla` twice on one SLA; the
   source has no status check, so the second call succeeds and emits
   `SlaCancelled` again. Affected: `sla_vault`. Impact: a duplicate event; no
   state or fund effect. Deployed and source. Recommended next phase: reject or
   no-op a repeat cancel, with a test (source change only; live needs a
   redeploy).

## Follow-up lists

**A. Must be fixed before submission**
- Correct the payout-capping classification in the evidence records (LOGICALLY
  COVERED, not TESTED LOCALLY) or add the missing partial-payout test.
- Document the instance-lifetime defect and the watcher-registration lifetime
  behavior; decide what to do about the live instances' expiry date.
- Fix or document the `limit=1.5` 500.

**B. Can remain documented**
- Provider-chosen quorum and removed-watcher votes (document the omissions).
- UI settles the current round only (document).
- Unauthenticated indexer, Testnet-only explorer link, no per-round watcher
  deadline, lazy quorum read cost, CI action pinning and missing headers,
  fmt and clippy, Go patch level, repeat `cancel_sla` event.

**C. Blocked by redeployment**
- Live zero-balance withdrawal rejection; soroban-sdk 28.0.0 build on-chain;
  any contract fix (instance lifetime, repeat cancel, stale on-chain doc text).

**D. Need only stronger evidence**
- Live wrongly-signed rejection; live below-quorum and unregistered-watcher
  rejections; a partial-payout test and live run; the WASM code-entry lifetime;
  the restore path; signed dashboard writes; narrow-viewport checks; a dedicated
  secret scan; re-run of dependency scans; daemon Down mapping.

**E. Historical, no longer active**
- The `accountId is invalid` indexer defect (fixed and re-verified).
- The stale "unverified event shape" statements and fixtures (corrected).
- The 2026-09-28 "verified live" payout-cap sentence (superseded by a note, and
  now further corrected by section 3.2).
- The negative-`limit` defect (fixed).

Phase 30 classification and Phase 31 fixes are not started here.

## Remediation, 2026-09-29 (after the audit above)

The findings above are kept as written. This section records what was done
about the actionable ones and how their classification changed. Three kinds of
fix are kept apart: a **live operational mitigation** (state on the deployed
contracts), a **source-level fix** (code in this repository), and a
**redeployment-dependent fix** (needs a new contract build on-chain).

### Live instance lifetime (section 11)

Before, read at ledger 4932484 (2026-09-29T12:46Z): both instances, and both
WASM code entries, were live until ledgers 5026542 to 5026618 (about 5.4 days).
Four `stellar contract extend --ledgers-to-extend 3000000` transactions were
sent from the admin identity (Stellar CLI 27.0.0, Testnet; no key exposed):
`b8601edc…` (registry instance, ledger 4932489), `1e2b750d…` (vault instance,
4932493), `9efdb520…` (vault code, 4932495), `a130b4f3…` (registry code,
4932497), all `SUCCESS`. After: instances live until 7932489 and 7932493, code
until 7932495 and 7932497 (about 173.6 days). The WASM SHA-256 of both
contracts is unchanged; `get_watcher_count` reads `5`; `get_sla(0)` and
`get_bond_balance(0)` (`46000000`) read as before. Full table:
`apps/docs/testnet-deployment.md`. The previously UNVERIFIED WASM code-entry
lifetime is now known (it matched the instance).

| Finding | Classification now |
|---|---|
| Live instance and code lifetime near expiry | LIVE OPERATIONAL MITIGATION done (VERIFIED). Not a fix |
| Source never extends instance storage | still DEFECT at source level; **REDEPLOYMENT-DEPENDENT**, BLOCKED with the SDK and deployment decision |
| Persistent entries (`Sla`, `BondBalance`, `Watcher`, tallies) | not extended by this action; still due in about 28.5 days; KNOWN LIMITATION, documented |
| Restore path | still UNVERIFIED (not needed for this mitigation) |

### Partial payout (section 3.2)

`test_trigger_settlement_pays_only_the_remaining_bond_when_it_is_below_the_penalty`
(vault commit `304b948`): bond 800, penalty 500; the second settlement pays
exactly the remaining 300 (beneficiary total 800, bond and vault balance 0,
round settled, `SettlementPaid` payout 300), then a further breach gives
`BondExhausted`. With `min()` replaced by an uncapped payout the new test and
the older exhaustion test fail. The change is test-only; the built WASM hashes
are unchanged. Classification: payout-capping implementation and partial-payout
behavior, TESTED LOCALLY (as of this commit; the earlier records that said so
before it existed were premature and are corrected by this note); live cap
execution, UNVERIFIED.

### Non-integer limit (section 5)

`?limit=1.5` now returns HTTP 400
`{"error":"invalid_limit","message":"limit must be an integer"}` before any SQL
is prepared; the regression test fails on the previous `routes.ts`. Other
inputs are unchanged. Live, against the local indexer on Testnet: no limit,
`limit=1`, `limit=20` returned 200 with the real SLA 0 row; `limit=-5` and
`limit=1.5` returned 400. (That run reused the scratch database from an earlier
live run, so its `quorum_threshold` was already cached; the live quorum read
itself was exercised earlier the same day.) Classification: source-level DEFECT
fixed; the DEFECT status above is historical.

### Left unchanged and now documented

Repeat `cancel_sla` events, quorum above the watcher count, removed-watcher
votes, per-row RPC quorum reads, no per-round watcher deadline, unauthenticated
indexer, watcher not continuously hosted, current-round-only UI settlement, and
CI tag pinning and missing `permissions:` are documented in
`apps/docs/limitations.md` and the contract spec. Repeat `cancel_sla` remains a
redeployment-dependent behavior. No contract behavior was changed.

### Still carried forward

UNVERIFIED: signed dashboard writes, narrow-viewport docs, dedicated secret
scanning, a live wrongly-signed rejection, live below-quorum and
unregistered-watcher rejections, live payout-cap execution, a second live
settlement-pagination page, live daemon-to-indexer round read-back. BLOCKED:
the live zero-balance withdrawal rejection, redeploying the soroban-sdk 28.0.0
source, and a permanent source-level instance-lifetime fix.

### Remediation 2, 2026-09-29 (Phase 30 and 31)

The section 3.1 test gap (all tests under `mock_all_auths()`, permissionless
test with the admin as caller) is closed locally by vault `d79c52d`. The
section 11 finding that a watcher registration and other persistent entries
lapse about 28.5 days after being written was mitigated for the live workflow
by extending them on 2026-09-29 (`testnet-deployment.md`); the source-level
behavior is unchanged. Category and rationale for every finding:
`findings-classification-2026-09-29.md`; re-verification of the changed areas:
`final-technical-audit-2026-09-29-r2.md`.

## 20. Gate 2 TypeScript Compatibility Decision

**Verification performed:**
- `apps/web`: `pnpm run typecheck` succeeded with TypeScript 5.9.3.
- `packages/sdk`: `pnpm run typecheck` succeeded with TypeScript 5.9.3.
- `indexer`: `npm ci`, `npm run build`, and `npm test` all passed with TypeScript 7.0.2, including 45/45 tests.

**Compatibility reasoning:**
- The current web and SDK configurations typecheck successfully on TypeScript 5.9.3 with the current Next.js 16.3.8 stack.
- The current indexer configuration builds and passes its complete test suite on TypeScript 7.0.2.
- No TypeScript compatibility errors were observed in the tested configurations.
- The ESLint 9 to 10 compatibility question is intentionally deferred to Gate 3 and is not considered resolved by this gate.

**Decision:**
- Keep `apps/web` on TypeScript 5.9.3.
- Keep `packages/sdk` on TypeScript 5.9.3.
- Keep `indexer` on TypeScript 7.0.2.
- No TypeScript dependency changes are required for Gate 2.

**Evidence:** The build, typecheck, and test results above were executed during Gate 2 verification.
## 21. Gate 3 ESLint PR #8 Investigation

**Verification performed:**
- Reproduced the ESLint 10.11.0 installation locally via `pnpm add -D eslint@10.11.0 --filter @slasettle/web`.
- `pnpm run lint` successfully loaded `eslint.config.mjs` but crashed during file linting with: `TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`.
- `npm view eslint-plugin-react peerDependencies` confirms it only supports ESLint up to `^9.7`.

**Compatibility reasoning:**
- The crash is caused by an API incompatibility: `eslint-plugin-react` uses `context.getFilename()`, an internal ESLint API removed in v10.
- `eslint-config-next@16.3.8` supports ESLint `>=9.0.0`, but its internal dependency `eslint-plugin-react@7.37.5` does not yet support ESLint 10.
- The failure is not a configuration loading issue; the flat config is correctly found and parsed.

**Decision:**
- Keep the project on ESLint 9.39.5, which is the correct, maximally supported version for the current stack.
- PR #8 (ESLint 10 update) remains CLOSED.

**Evidence:** The local reproduction on 2026-10-01 confirmed the stack trace originating from `eslint-plugin-react/lib/util/version.js` within ESLint 10's linter execution path.

## 22. Gate 4 Indexer Package Manager Consistency

**Verification performed:**
- Audited repository structure, CI workflows, and documentation.
- Executed `npm ci`, `npm run build`, and `npm test` in the `indexer` directory on 2026-10-01.

**Reasoning:**
- The `indexer` project is intentionally excluded from the root `pnpm-workspace.yaml`.
- It maintains its own `package-lock.json` and uses `npm` specifically.
- `README.md`, `CONTRIBUTING.md`, and `.github/workflows/ci.yml` all explicitly document and rely on this separate `npm` setup.
- The `npm ci`, `build`, and `test` commands passed successfully (45/45 tests passing).
- The setup is not stale or contradictory; it is an intentional architectural boundary.

**Decision:**
- Retain the separate `npm` setup and `package-lock.json` for the indexer.
- No changes required.

## 23. Gate 5 Go Watcher Audit

**Verification performed:**
- Reviewed `watcher/go.mod` (minimum `go 1.25`, `toolchain go1.25.14`, `go-stellar-sdk v0.7.3`).
- Reviewed `watcher/README.md` and root `README.md` (claims correctly align with the `go.mod` configuration).
- Executed `go build`, `go vet`, and `go test` in the `watcher` directory successfully (using Go 1.25.14).
- Executed `govulncheck ./...` on 2026-10-01 which reported **0 vulnerabilities**, confirming the standard library vulnerabilities identified previously were mitigated by the updated `toolchain` directive.
- Found and removed a stale historical reference to `v0.7.2` in a comment in `watcher/internal/contract/contract.go`.

**Decision:**
- The Go watcher configuration is secure, correct, and current.
- The `v0.7.2` comment was corrected.
- Issue #14 is resolved by the `toolchain` directive, proven by `govulncheck`. (Note: GitHub API timeouts prevented closing it automatically during this run).
