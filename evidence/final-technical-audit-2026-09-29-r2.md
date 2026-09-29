# Final Technical Audit, revision 2

Phase 31 re-audit. This does not restate the first audit
(`final-technical-audit-2026-09-29.md`); it re-checks every area that Phases 29
remediation, 30 and 31 changed, and re-tests the rest of the system's claims
that those changes touch. Baselines: vault `a27f5b1`, hub `04e6a72`, read at
ledger about 4933237 on 2026-09-29. The classification of every finding is in
`findings-classification-2026-09-29.md`.

## 1. What changed since the first audit

| Change | Where | Kind |
|---|---|---|
| Live contract instances and WASM code entries extended by 3,000,000 ledgers | Testnet | live operational mitigation, no redeploy |
| Live persistent entries the workflow needs extended (12 transactions) | Testnet | live operational mitigation |
| Partial-payout test | vault `304b948`, `4b33bd6` (format) | test-only |
| Signature and permissionless tests | vault `d79c52d` | test-only |
| Fractional `limit` rejected with 400 | hub `8b06779` | source fix, indexer |
| Documentation and evidence updates, one new hub issue (#15), vault issue #3 rewritten | both repositories, GitHub | documentation |

No contract behavior was changed and nothing was redeployed.

## 2. Re-verification by area

| Area | Check performed on 2026-09-29 | Result | Status |
|---|---|---|---|
| Live artifacts | fetched both contracts and hashed them | `4c626d2c…` (registry) and `69097132…` (vault), identical to every earlier reading | VERIFIED |
| Current build | `stellar contract build` on vault `a27f5b1` | `73a3fbaa…` and `10c53424…`, identical to the pre-test-change build: the added tests did not change the artifact | VERIFIED |
| Interface, runtime, artifact | unchanged from the first audit (section 2 there) | interface identical; artifact differs; one runtime behavior differs (zero-balance withdrawal) | unchanged |
| Instance and code lifetimes | `getLedgerEntries` on both instances and both code entries | live until ledgers 7932489, 7932493, 7932495, 7932497 (about 173.6 days) | VERIFIED |
| Persistent lifetimes | same, for `Watcher(watcher1)`, `Sla(0)`, `BondBalance(0)`, `SettledRounds(0,1)` | 7932956, 7932968, 7932970, 7932981 (about 173.6 days); `Tally(0,1)` still 5424162 (about 28.4 days) as documented | VERIFIED |
| Live state unchanged by the extensions | `get_watcher_count`, `get_bond_balance(0)`, `is_round_settled(0,1)` | `5`, `46000000`, `true` | VERIFIED |
| Source still lacks instance extension | grep for `instance().extend_ttl` in both contracts | none | DEFECT at source level, unchanged; classified C (redeployment-dependent) |
| Signature tests discriminate | mutations on vault `cancel_sla`, vault `trigger_settlement`, registry `require_auth` | the matching new tests fail; unmutated tree passes | TESTED LOCALLY |
| Partial-payout test discriminates | `min()` replaced by an uncapped payout | new test and the older exhaustion test fail | TESTED LOCALLY |
| Non-integer limit | route test fails on the previous `routes.ts`; live `limit=1.5` gave 400, negative 400, absent, 1 and 20 gave 200 with the real SLA 0 row | as recorded in the earlier remediation | VERIFIED |
| Auth boundaries | re-read every state-changing method against the new tests | missing-signature rejection is now TESTED LOCALLY for `top_up_bond`, `cancel_sla`, `create_sla`, `withdraw_remaining_bond`, vault `pause`, registry `register_watcher`, `pause`, `submit_check`; NOT covered by the new tests: `initialize`, `unpause`, `remove_watcher`; a live wrongly-signed call remains UNVERIFIED | TESTED LOCALLY / UNVERIFIED |
| Settlement path | re-read `trigger_settlement`; partial-payout branch now executed | no change in behavior; branch coverage gap closed | TESTED LOCALLY |
| Indexer routes | full indexer suite | 45 tests pass, including the two limit regressions | TESTED LOCALLY |
| Event, SDK, watcher, frontend sources | no source change in this phase (hub source diff since the first audit is `routes.ts` only) | first-audit findings for these areas stand unchanged | unchanged |

## 3. Validation results

| Suite | Result |
|---|---|
| vault `cargo check --workspace` | passes |
| vault `cargo test --workspace` | 34 + 18 = 52 pass |
| vault `stellar contract build` | passes |
| vault `cargo fmt --check` | 9 diffs (the pre-existing drift; this work adds none) |
| vault `cargo clippy --workspace --all-targets --all-features` | the same 2 warnings |
| hub `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `build` | pass |
| SDK, web | 29/29, 50/50 |
| indexer `npm test`, `npm run build` | 45/45, passes |
| watcher `go build`, `go vet`, `go test -count=1` | pass (48 tests) |
| docs build | passes |

## 4. Source and documentation consistency

- The documents that describe TTL, signatures, payout capping and the limit
  (`limitations.md`, `testnet-deployment.md`, `testing.md`, `api.md`, the
  contract spec, both READMEs, `index.md`, the traceability record, the
  external review) were re-read; the statements about test counts (vault 52,
  indexer 45), lifetime coverage and test scope match the results above.
- The historical statements that the new tests supersede (external review
  section 3, traceability claims 7 and 11, the first audit's section 3.1) are
  kept and carry dated follow-ups.
- The on-chain spec text of the live contracts is still stale (frozen in the
  deployed WASM); documented.
- The ledger's counts and rows AH, AJ, AK, AL agree with
  `findings-classification-2026-09-29.md` (A 0, B 1, C 19, D 3, E 20).

## 5. GitHub state

- Open issues: hub #10, #11, #12, #13, #14, #15 (new backlog issue); vault #2,
  #3 (rewritten), #4. None was closed: no issue's acceptance criteria are
  complete.
- Hub PR #8: open, head `449e285`, last updated 2026-09-29T01:17Z, no comments;
  untouched.
- Releases, tags, Pages, deployments: none (unchanged).
- CI on the resulting commits (read from GitHub): vault `d79c52d` run
  `36575751213` and `a27f5b1` run `36576997735`, job `check, test, build`
  success; hub `8b06779` run `36571901837` and `04e6a72` run `36576941369`,
  jobs `web and sdk`, `indexer`, `watcher` success.
- Branch protection settings were not changed.

## 6. Findings after the re-audit

No new defect was found in the changed areas. The active defect list is
unchanged from the classification: source-level missing instance-lifetime
extension (C, redeployment-dependent), a repeat `cancel_sla` event (C), and
the lifetime behavior of persistent entries in general (C, with the
workflow-critical live entries mitigated).

| Class | Items |
|---|---|
| VERIFIED | live hashes, lifetimes and state after the extensions; limit behavior; CI; issue and PR state |
| TESTED LOCALLY | signature rejection and permissionless settlement for the listed methods; partial payout; 45 indexer tests |
| UNVERIFIED | signed dashboard writes; narrow-viewport docs; dedicated secret scan; live wrongly-signed, below-quorum and unregistered-watcher rejections; live payout cap; a second pagination page; live daemon-to-indexer read-back; the restore path |
| KNOWN LIMITATION | as in the classification (C rows) |
| BLOCKED | live zero-balance rejection; soroban-sdk 28.0.0 redeploy; a permanent source-level instance-lifetime fix |

## 7. Submission freeze

**SUBMISSION FREEZE: ACTIVE.** From this record onward only
submission-critical fixes are permitted: no features, dependency upgrades,
README redesign, architecture changes, cosmetic refactors or branch-protection
changes. Any submission-critical change after this point requires another
audit. One standing obligation is not a change: the live instances and code
entries must be extended again before about ledger 7932489 if the deployment
is to stay available beyond that.
