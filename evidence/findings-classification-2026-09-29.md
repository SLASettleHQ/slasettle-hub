# Findings classification, 2026-09-29

Phase 30. Every material finding from the final technical audit
(`final-technical-audit-2026-09-29.md`), the external review
(`external-review-2026-09-29.md`), the parity matrix, the evidence ledger and
the traceability record is given exactly one category. Classification is by
impact and disclosure, never by how easy a fix is.

**Categories.** A blocker (prevents a truthful submission or materially breaks
the core workflow). B stale or cosmetic (an outdated artifact misrepresents
current state). C known limitation (disclosed, intentionally left for later).
D important pre-submission fix (not a blocker, but materially improves
correctness, security or review clarity). E non-blocking backlog (legitimate
later work, kept as an issue).

**Decision questions**, answered for every row in the columns below:
Q1 breaks the core workflow? Q2 makes the submission untruthful? Q3 a current
misleading claim? Q4 already disclosed? Q5 source-only or deployed? Q6 fixable
without a redeployment? Q7 needs a new evidence run? Q8 backlog?

The "core workflow" is: provider bonds an SLA, registered watchers vote, anyone
settles a quorum-reached round, the provider cancels and withdraws, and the
indexer, SDK and frontend read and display it, all on the live Testnet pair.

Live state at classification time (read 2026-09-29, ledger about 4932985):
contract instances and code entries live until ledgers 7932489 to 7932497;
watcher, SLA, bond-balance and settled-round entries listed in section 4 live
until ledgers 7932956 to 7932981; WASM hashes `4c626d2c…` and `69097132…`.

Abbreviations: **S** source-only, **D** deployed (present in the live
contracts), **SD** both, **n/a** not applicable. "Redeploy" means a new
contract deployment, which no finding here classified below A requires.

## 1. Classification table

| # | Finding | Cat. | Q1 | Q2/Q3 | Q4 | Q5 | Q6 | Q7 | Justification and action |
|---|---|---|---|---|---|---|---|---|---|
| 1A | Live instance and WASM code lifetime was near expiry; extended on 2026-09-29 | C | no, now covered to about ledger 7932489 | no | yes | D | yes (done) | done | The mitigation is complete and recorded (four transactions). What remains is an obligation: extend again before about ledger 7932489. Disclosed in `limitations.md`, `testnet-deployment.md`. Not a source fix. |
| 1B | Source never extends instance storage | C | no (live is covered) | no | yes | SD | no | yes if redeployed | A real source defect, but the live pair is covered for about 174 days and the fix is code plus a redeployment, which is a separate authorized operation. Tracked in vault issue #3. Not A: workflow not broken and the claim is truthful. Not D: no fix exists without a redeploy. |
| 1C-i | Live persistent entries needed by the workflow (5 watcher registrations, SLAs 0 to 2, their bond balances, settled round 0/1) were due in about 28.5 days | D | yes after about 2026-10-27 (an expired watcher is not eligible, an expired SLA is unreadable) | partly (docs said only "about 30 days") | yes | D | yes | done | Fixed operationally in this phase: 12 extension transactions, no state changed (section 4). Kept D, not C, because it materially affected whether the live demo works during evaluation. |
| 1C-ii | Persistent entries generally are extended only when written; history entries (tallies, per-watcher check records for the evidence rounds) were not extended | C | no | no | yes | SD | no (source) | no | Disclosed. Vote history is not needed to operate the live pair. A per-read refresh is a contract change. |
| 2a | Current source differs from the live contracts (SDK, comments, one behavior) | C | no | no (documented everywhere) | yes | SD | n/a | n/a | Interface identical; artifact and one behavior differ; each difference is documented with evidence. Not a blocker: nothing misleads a reviewer and the workflow works on the live pair. |
| 2b | Live `withdraw_remaining_bond` lacks the zero-balance rejection (repeat withdrawal is a no-op emitting `amount: 0`) | C | no (no funds at risk) | no | yes | D | no | yes | Behavior verified live; BLOCKED on redeploy. |
| 2c | soroban-sdk 28.0.0 source is not deployed | C | no | no | yes | S | no | yes | Vault issue #3. |
| 2d | The live contracts' on-chain spec carries stale doc strings | C | no | no | yes | D | no | n/a | Frozen in the deployed WASM; cannot be changed without a redeploy; the docs state it. |
| 3a | Payout-capping implementation | (closed) | | | | | | | Now TESTED LOCALLY (partial payout test, `304b948`). Historical finding, see section 2. |
| 3b | Live execution of the payout cap | E | no | no | yes | D | yes | yes (new live run) | The branch is a two-line `min`, tested locally; a live run would need a new SLA and votes. Status UNVERIFIED, kept, not upgraded. |
| 4 | Negative and fractional settlements limit | (closed) | | | | | | | Fixed and verified live; historical, section 2. |
| 5 | Repeat `cancel_sla` emits another `SlaCancelled` | C | no | no | yes | SD | no | yes if changed | State and funds unchanged; the hub indexer ignores the event; a consumer counting events would over-count. Changing it would widen source/live divergence. |
| 6 | `quorum_threshold` can exceed the watcher count (SLA can never settle) | C | no | no | yes | SD | no | n/a | The specification states no invariant; the provider chooses the threshold and can cancel and withdraw. Documented. |
| 7 | A removed watcher's earlier votes still count | C | no | no | yes | SD | no | n/a | Current semantics, documented; no specification statement is violated. |
| 8 | Indexer may make one RPC `get_sla` read per uncached settlement row | E | no | no | yes | S | yes | no | Performance observation on a first request only; a failed read gives 500. |
| 9 | Watcher has no per-round submission deadline | E | no | no | yes | S | yes | no | The design specifies none; a stall delays the loop and the vote is then skipped or recorded. |
| 10 | Indexer API unauthenticated and bound to all interfaces | C | no | no | yes | S | n/a | n/a | Local-only architecture; it serves public on-chain data; adding authentication would be new infrastructure. |
| 11 | Watcher is not continuously hosted | C | no | no | yes | n/a | n/a | n/a | Product scope: the daemon was run live for verification; no hosted service exists or is claimed. |
| 12 | Status UI triggers settlement for the current round only | C | no (anyone can settle earlier rounds with another tool) | no | yes | S | n/a | n/a | UI design; documented. |
| 13 | CI actions are tag-pinned; no explicit `permissions:` block | E | no | no | yes | S | yes | no | The repository default token permission is `read`, so effective permissions are the same; hardening is backlog and would change CI at freeze. |
| 14 | Contract tests all used `mock_all_auths()`, so a missing signature was never tested | D | no | partly (evidence read as stronger than it was) | yes | S (tests) | yes | done | Fixed in this phase (vault `d79c52d`): tests with explicit narrow authorizations, discriminating mutations recorded. |
| 15 | Permissionless-settlement test used the admin as caller | D | no | partly | yes | S (tests) | yes | done | Fixed with 14: an unrelated caller with no authorization at all settles. |
| 16 | No SDK test for `SorobanSimulationError` | E | no | no | yes | S | yes | no | Verified live on 2026-09-29; low risk. |
| 17 | No automated tests for the network indicator, the status page, or a signed dashboard flow | E | no | no | yes | S | yes | partly | Browser-verified; signed writes tracked by issue #12. |
| 18 | Mobile or narrow-viewport documentation review | E | no | no | yes | n/a | n/a | yes | UNVERIFIED because the environment could not resize a window; not a defect; issue #12. |
| 19 | Secret scan: only a manual pattern and history scan exists | E | no | no | yes | n/a | n/a | yes | Documented as manual only; a dedicated scanner run is later evidence. |
| 20 | No live wrongly-signed rejection | E | no | no | yes | D | n/a | yes | Local test now covers it (14); a live rejection would cost a failed transaction. |
| 21 | No live below-quorum rejection | E | no | no | yes | D | n/a | yes | Local coverage exists. |
| 22 | No live unregistered-watcher rejection | E | no | no | yes | D | n/a | yes | Local coverage exists. |
| 23 | No second live page of settlement pagination | E | no | no | yes | S | n/a | yes | Route and cursor tested; only one settlement exists on-chain. |
| 24 | No live daemon-to-indexer round read-back | E | no | no | yes | n/a | n/a | yes | Daemon submission and the indexer decoder are each verified; issue #11 keeps the open criterion. |
| 25 | WASM hashes are not reproducible across Rust versions or comment edits | C | no | no | yes | SD | n/a | n/a | Toolchain observation, recorded. |
| 26 | Indexer `explorer_url` is hardcoded to Testnet | C | no | no | yes | S | yes | no | Testnet-only scope. |
| 27 | An unknown status symbol is stored as `up` | E | no | no | yes | S | yes | no | Unreachable with the two-variant contract. |
| 28 | Provider chooses beneficiary, quorum and penalty | C | no | no | yes | SD | n/a | n/a | Documented design. |
| 29 | SDK, frontend and watcher have no archived-entry restore handling | E | no (after 1C-i) | no | yes | S | yes | yes | Documented in `limitations.md` (this phase); the restore path is UNVERIFIED. |
| 30 | Dependency scans are dated 2026-09-28 | E | no | no | yes | n/a | n/a | yes | Re-run when convenient. |
| 31 | Local Go 1.25.1 behind on patches | E | no | no | yes | n/a | n/a | no | Issue #14. |
| 32 | No license file | C | no | no | yes | n/a | n/a | n/a | Issues hub #10, vault #2; not chosen here by instruction. |
| 33 | No commit-reveal | C | no | no | yes | SD | no | n/a | Vault issue #4. |
| 34 | `cargo fmt` drift (9 diffs) and 2 clippy warnings in the vault | C | no | no | yes | S | yes | no | Pre-existing and disclosed; this work adds none. |
| 35 | Docs site not built in CI | E | no | no | yes | S | yes | no | Listed in the backlog issue. |
| 36 | `main.go` in the watcher and the null-quorum route path have no tests | E | no | no | yes | S | yes | no | Backlog. |
| 37 | Evidence records that still describe test coverage as "every contract test uses `mock_all_auths()`" and payout-cap coverage in the past tense | B | no | yes (outdated after the new tests) | n/a | n/a | yes | no | Corrected by dated follow-ups in the external review, traceability record and ledger (this phase); originals preserved. |
| 38 | Internal phase names in historical evidence text | E | no | no | n/a | n/a | n/a | n/a | Historical records are not rewritten; no action. |

## 2. Closed historical findings (no active category)

| Finding | Original state | Fix | Verification | Now |
|---|---|---|---|---|
| Negative `limit` returned an empty page | HTTP 200 empty page | HTTP 400 `limit must not be negative` (2026-09-29) | route test, live `?limit=-5` gave 400 | closed |
| Fractional `limit` returned 500 | HTTP 500 | HTTP 400 `limit must be an integer` (2026-09-29) | route test fails on the old code; live `?limit=1.5` gave 400 | closed |
| Partial-payout branch had no test | classified TESTED LOCALLY without a test reaching it | test added (`304b948`) | fails when `min()` is removed | TESTED LOCALLY; live cap UNVERIFIED (3b) |
| `accountId is invalid` in the settlements route | HTTP 500 | random keypair source account | test, live | closed |
| Stale event-shape, `endpoint_hash` and "automatic" wording | misleading | corrected | reread | closed |

## 3. Totals

45 table rows: 2 of them (3a, 4) are closed historical findings shown for
completeness, leaving 43 active findings, each with exactly one category:
A 0, B 1, C 19, D 3, E 20. The closed historical findings, five in all
counting the three that only appear in section 2, carry no active category.

There is no A. No finding breaks the core workflow on the live pair or makes
the submission untruthful, and every source-versus-deployed difference is
disclosed. The contract deployment gap (zero-balance withdrawal, SDK 28.0.0,
source instance lifetime) is **C, not A or D**: the workflow works, the
documentation prevents confusion, and a redeployment needs a deliberate
toolchain decision, a fresh build and deployment, fresh Testnet evidence,
updated hashes, cross-repository re-verification and updated records; none of
that is done here, and it stays pending under vault issue #3.

## 4. Fixes made in Phase 31 (for D and B)

- **1C-i, live persistent entries.** Twelve `stellar contract extend
  --key-xdr … --ledgers-to-extend 3000000` transactions from the admin
  identity (Stellar CLI 27.0.0, Testnet), all successful, no state changed:

| Entry | Transaction | Ledger | Live until after |
|---|---|---|---|
| registry `Watcher` (5 registered watchers) | `78f0ec30…`, `8e0bb304…`, `4864446b…`, `2648644c…`, `6f00e768…` | 4932956, 4932958, 4932960, 4932962, 4932965 | 7932956 to 7932965 |
| vault `Sla(0)`, `BondBalance(0)` | `f4bbc75a…`, `0a6203f7…` | 4932968, 4932970 | 7932968, 7932970 |
| vault `Sla(1)`, `BondBalance(1)` | `ead7bdd9…`, `80096747…` | 4932972, 4932975 | 7932972, 7932975 |
| vault `Sla(2)`, `BondBalance(2)` | `32270cb5…`, `05d13fa8…` | 4932977, 4932979 | 7932977, 7932979 |
| vault `SettledRounds(0,1)` | `e6e0661a…` | 4932981 | 7932981 |

  Full hashes are in the evidence ledger. Instances and code entries were not
  re-extended; their remaining lifetime was read and is about 173.6 days.
- **14 and 15, signature tests.** Vault `d79c52d`; five new tests (sla_vault 4,
  watcher_registry 1). Removing `require_auth` from `cancel_sla`, adding it to
  `trigger_settlement`, or removing it from the registry each makes the
  matching test fail. Test-only: WASM hashes unchanged.
- **37 (B).** Follow-up notes added to the external review, the traceability
  record and the ledger.
- **29.** One sentence added to `limitations.md`.
- **Issues.** Vault #3 rewritten with the current facts; one new hub issue
  holds the E items; nothing was closed (no acceptance criteria are complete).
  See section 5.

Not fixed on purpose: every C and E finding, and every finding that would
create a new source-versus-deployed divergence.

## 5. Issue review

| Issue | Still real | Stale | Action |
|---|---|---|---|
| hub #10 license | yes | no | keep open; not chosen |
| hub #11 daemon live | partly done | already rewritten on 2026-09-29 | keep open; one criterion (indexer read-back) unchecked |
| hub #12 browser and Freighter | partly done | already rewritten on 2026-09-29 | keep open; signed writes, app themes, reduced motion, mobile open |
| hub #13 mismatch should block | yes | no | keep open |
| hub #14 local Go toolchain | yes | no | keep open |
| hub PR #8 | yes | no | untouched |
| vault #2 license | yes | no | keep open |
| vault #3 redeploy against 28.0.0 | yes | stale in that it did not mention the lifetime extension or the other source-only items | rewritten with an update |
| vault #4 commit-reveal | yes | no | keep open |
| new hub issue: post-audit backlog | n/a | n/a | created to keep the E items visible in one place |
