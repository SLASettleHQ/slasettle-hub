# External reviewer simulation, 2026-09-29

Phase 28. This reads SLASettle as an outsider would: only what the two public
repositories, their issue trackers, GitHub metadata and the linked evidence
show. It states facts and gaps. It gives no score and no ranking.

Baselines: vault `b4243ff`, hub `24ed862` plus the documentation corrections
made in this pass (see section 10). Claim-level chains are in
`evidence/claim-traceability-2026-09-29.md`; claim IDs such as "claim 14"
refer to it.

## 1. Reviewer entry point

An outsider arrives at `github.com/SLASettleHQ`. The repository descriptions
say "Watcher daemon, event indexer, SDK, and frontend for SLASettle. Testnet
only, unaudited." (hub). Reading order that works:

1. `slasettle-hub/README.md`: what it is, repository layout, current Testnet
   status, known limitations, links to `SECURITY.md` and `evidence/index.md`.
2. `slasettle-vault/README.md`: the two contracts, the deployed IDs, the
   source-versus-deployed warning, CI and branch protection.
3. `slasettle-vault/SLASettle-contract-spec.md`: interface, authorization,
   events, errors, round IDs.
4. `slasettle-hub/evidence/index.md`, then the dated records it cites.
5. `slasettle-hub/apps/docs/` (VitePress source; not hosted, so read as
   Markdown or build locally).

Both repositories have issues enabled. Neither has a release, a `LICENSE`,
GitHub Pages, deployments or private vulnerability reporting, and the hub has
no environments and no discussions (GitHub API, 2026-09-29).

## 2. What is easy to verify

- **Testnet deployment and hashes.** Anyone with the Stellar CLI can run
  `stellar contract fetch --id <ID> --network testnet --out-file x.wasm` and
  `sha256sum x.wasm` and compare with `README.md`
  (`watcher_registry` `4c626d2c…`, `sla_vault` `69097132…`). Verified on
  2026-09-29 (`parity-matrix` §0.1).
- **Deployed interface.** `stellar contract info interface --id <ID>
  --network testnet` matches the spec's function list (`parity-matrix` §0.2).
- **Live state.** Read-only invokes (`get_watcher_count`, `get_sla`,
  `get_bond_balance`, `is_round_settled`) return the values in the evidence
  (`parity-matrix` §0.3).
- **Tests and CI.** Vault `cargo test --workspace` (46), hub `pnpm test`
  (SDK 29, web 50), indexer `npm test` (44), watcher `go test ./...` (48).
  CI is green on both `main` branches (runs `36548663143` vault, `36548680306`
  hub).
- **Branch protection and Dependabot** are readable on GitHub.
- **What is not hosted.** No live site or API exists to try; everything is run
  locally (`apps/docs/deployment-topology.md`).

## 3. What requires repository reading

- Who may call what: `contracts/*/src/lib.rs` and `SLASettle-contract-spec.md`.
- Which off-chain code calls which contract method: SDK `packages/sdk/src`,
  watcher `internal/contract/contract.go`, indexer `src/rpc/liveReads.ts`;
  compared in `parity-matrix` §1.
- Route shapes and error behavior of the indexer: `indexer/src/api/routes.ts`,
  `apps/docs/api.md`.
- That the frontend and SDK never hold a key: grep of `apps/web` and
  `packages/sdk` (the claim has no test, only source).
- That every contract test uses `mock_all_auths()`: read `test.rs`.

## 4. What requires Testnet evidence

- Deployment, settlement, cancellation, withdrawal, pause, duplicate
  rejection, all eight event shapes: `vault/evidence/testnet-2026-09-27.md`
  (transaction hashes on Testnet; a reviewer can open each on an explorer).
- The watcher daemon's four live rounds and the browser/Freighter check:
  `hub/evidence/phase-23-verification-2026-09-29.md`.
- A reviewer cannot re-run the browser or daemon evidence without their own
  wallet, watcher account and admin key; the on-chain effects (four extra
  `check_submitted` events, a registration and a removal) can be re-read from
  the contract's event stream (`parity-matrix` §0.6).
- Event history older than about seven days may no longer be retrievable from
  a public RPC; the transactions remain on the ledger.

## 5. What is still unverified

- Signed dashboard writes (create, top-up, cancel, withdraw) through the UI.
- The documentation site at a narrow viewport.
- A live rejection of an unregistered watcher, and of a below-quorum
  settlement.
- Live execution of the payout cap (the one live settlement never reached it).
- A dedicated secret-scanning tool (only manual pattern scans exist).
- The first-click "Connecting…" hang seen once and not reproduced.
- The daemon's own log line for round 29844195.
- A second live page of settlement pagination.

## 6. What is blocked

- Live verification of the zero-balance withdrawal rejection: needs a redeploy.
- Redeploying and re-verifying against soroban-sdk 28.0.0 (vault issue #3).

Neither redeploy is allowed in the current scope.

## 7. Stale or confusing material found

Corrected in this pass:

- "paid out automatically" and "automatic payout" in the vault README, hub
  introduction and problem pages. Settlement requires a caller and nothing here
  makes the call.
- "independent watchers" stated as a present fact. The five registered watcher
  addresses were set up by the project admin for evidence runs.
- "public per-SLA status page" read as hosted.
- `endpoint_hash` documented as stored on the check record. The contract
  discards it; it is only a transaction argument (claim 20).
- Three references to internal phase numbers ("Phase 10", "Phase 11",
  "Phase 23") that an outsider cannot resolve; replaced by dates.
- `TEST-MATRIX.md` at the hub root reads as current but is a 2026-09-28
  snapshot; its banner now lists superseded rows including an SDK error-test
  claim that the SDK suite does not support.

Still present, not changed:

- Contract source comments: `submit_check` ("stored on the check record") and
  `trigger_settlement` ("`caller` is recorded only in the event").
- `watcher/internal/round/round.go`: "the way the contract spec defines them".
- Landing page copy: "Independent watchers check the service every round",
  the layout description ("public settlement"), and the footer ("settled on
  Stellar", not "on Stellar Testnet"). These are product strings; changing them
  needs a frontend commit and test run.
- Evidence records use internal phase names in their text (historical, not
  rewritten): `testnet-2026-09-27.md` refers to "the Phase 9 test matrix",
  `recovery-2026-09-28.md` to "Phase 11".
- The vault evidence file `testnet-2026-09-27.md` ends with a remark that
  the README "still describes the historical deployment"; that was fixed the
  next day (`2cfd288`) and the historical text is kept as written.
- `security-review-2026-09-28.md` still contains the superseded "verified
  live" sentence; a dated correction note sits above it.
- The vault has cargo fmt drift and two clippy warnings, disclosed in its
  README.

## 8. Issue tracker observations

Hub, open: #10, #11, #12, #13, #14, and PR #8. Vault, open: #2, #3, #4. No
issue is a release or hosting claim; none was modified in this pass.

| Issue | Still real? | Notes |
|---|---|---|
| hub #10 license | yes | no `LICENSE` in either repository; not chosen here. |
| hub #11 run the daemon live | partly stale | the issue says the daemon "has never been observed live" and asks for one full round. On 2026-09-29 it ran four rounds (`phase-23`, Part C). It asks for a "long-lived process"; nothing runs continuously. Closure or a rewrite of scope is the maintainer's call. |
| hub #12 browser + Freighter | partly stale | the issue says nobody has ever clicked Connect Wallet. Connect, disconnect, network display, mismatch and the public status page were verified on 2026-09-29. Signed create/top-up/cancel/withdraw and responsive/reduced-motion checks remain open, so it should not simply be closed. |
| hub #13 mismatch should block | yes | `network-indicator.tsx` warns only; correctly scoped and referenced in the docs. |
| hub #14 local Go toolchain | yes | local Go is 1.25.1; CI uses current 1.25.x. |
| hub PR #8 (ESLint 9 to 10) | yes | open, CI failing on its head commit; untouched. |
| vault #2 license | yes | same as hub #10. |
| vault #3 redeploy against 28.0.0 | yes | still accurate. It could add that the zero-balance rejection is also undeployed. |
| vault #4 commit-reveal | yes | correctly scoped; documented everywhere as a known limitation. |

## 9. Reviewer questions and factual answers

1. **What does SLASettle do?** A provider locks a token bond in `sla_vault`
   for an SLA. Watchers registered in `watcher_registry` vote `Up` or `Down`
   each round. When `votes_down` reaches the SLA's `quorum_threshold` for a
   round, anyone can call `trigger_settlement` and the contract pays
   `min(penalty_per_breach, remaining bond)` to the beneficiary, once per
   round. Testnet only.
2. **Where is the contract code?** `slasettle-vault/contracts/watcher_registry`
   and `contracts/sla_vault`.
3. **Frontend?** `slasettle-hub/apps/web` (Next.js).
4. **Indexer?** `slasettle-hub/indexer` (Node, SQLite).
5. **Watcher?** `slasettle-hub/watcher` (Go).
6. **SDK?** `slasettle-hub/packages/sdk` (TypeScript; not published).
7. **What is deployed?** The two contracts on Stellar Testnet. Nothing else:
   no frontend, indexer, database, watcher or docs site is hosted.
8. **Which network?** Stellar Testnet
   (`Test SDF Network ; September 2015`); nothing on mainnet is claimed.
9. **Current contract IDs?** `watcher_registry`
   `CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`, `sla_vault`
   `CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL` (deployed
   2026-09-27). An earlier pair (`CBEZ3XBI…`, `CBA4DFNU…`) is historical.
10. **How to verify the deployment?** Section 2.
11. **How does settlement happen?** A caller invokes
    `sla_vault.trigger_settlement(caller, sla_id, round_id)`. The vault calls
    `watcher_registry.get_round_tally`, checks quorum, transfers the payout,
    and marks the round settled. Nothing in either repository calls it
    automatically; the frontend has a button for it.
12. **Who can trigger it?** Any account (`caller` is never authorized). A live
    settlement was triggered by an account that was not admin, provider or
    beneficiary.
13. **What prevents duplicate settlement?** A persistent `SettledRounds`
    flag per `(sla_id, round_id)`; a second call fails with `AlreadySettled`
    (#4), observed live.
14. **How are votes represented?** `submit_check(watcher, sla_id, round_id,
    endpoint_hash, status)`; `status` is `Up` or `Down`. The contract stores
    one status per `(sla_id, round_id, watcher)` and a running tally, and emits
    `check_submitted`. It does not store or emit `endpoint_hash`.
15. **Can a watcher copy another?** Yes. State is public and there is no
    commit-reveal (vault issue #4, known limitation).
16. **Aggregate uptime enforced?** No. `uptime_target_bps` is stored and
    displayed only; settlement is per round with a fixed penalty.
17. **Where is the money held?** By the `sla_vault` contract address, as the
    SLA's token (the native XLM contract on Testnet), tracked per SLA in
    `BondBalance`.
18. **Penalty?** `payout = min(penalty_per_breach, remaining balance)`; zero
    payout fails with `BondExhausted`. The cap is tested locally, not
    exercised live.
19. **After cancellation?** Status becomes `Cancelled`; settlement fails with
    `SlaNotActive`; `withdraw_remaining_bond` becomes possible; `top_up_bond`
    has no status check and still works.
20. **After withdrawal?** The tracked balance is `0`. A repeat withdrawal on the
    live contract succeeds as a no-op and emits `amount: 0`; current source
    rejects it with `InvalidAmount`.
21. **Is the deployed contract identical to current source?** Not byte for
    byte. The public interface matches apart from one omitted storage-key spec
    entry; WASM hashes differ, and behavior differs in the zero-balance
    withdrawal.
22. **What changed between SDK versions?** The live build embeds soroban-sdk
    27.0.6 (rustc 1.97.1); current source builds with 28.0.0 and its WASM
    carries an extra `rssdk_spec_shaking: 2` metadata entry and omits the
    private `DataKey` spec. The 46 contract tests pass on 28.0.0. SDK release
    notes were not consulted, so no other change is claimed.
23. **Is the zero-balance fix live?** No.
24. **Can the frontend be used with a wallet?** Yes with Freighter: connect,
    disconnect, reconnect and network display were verified in a real browser
    on 2026-09-29.
25. **Was a signed browser transaction verified?** No.
26. **Is the indexer public?** No; it runs locally.
27. **Is the watcher continuously running?** No. It ran for four rounds on
    2026-09-29 for verification.
28. **Is the docs site hosted?** No.
29. **Independent security audit?** No. An internal review exists
    (2026-09-28).
30. **How are vulnerabilities reported?** By opening a public GitHub issue
    with minimal detail and asking for a private channel. Private
    vulnerability reporting is disabled and no contact address exists.
31. **Unverified?** Section 5.
32. **Blocked?** Section 6.
33. **Known limitations?** No commit-reveal; one shared watcher set; display-only
    uptime target; `round_id` not validated on-chain; untuned storage TTLs;
    watcher has no in-round retry and serves one SLA; indexer has no
    authentication, binds all interfaces, and loses event history beyond RPC
    retention; network mismatch is a warning only; WASM hashes not reproducible
    across toolchains; live contract lacks two source-side changes (SDK 28.0.0,
    withdraw rejection); no license; nothing hosted; nothing audited.
34. **Ready to be evaluated from the evidence provided?** Factual summary by
    category, not a rating:

| Category | What the evidence supports |
|---|---|
| Contract behavior on Testnet | deployment, quorum settlement, permissionless call, duplicate rejection, cancel/withdraw, pause, eight event kinds: live transactions recorded. Payout cap, below-quorum rejection, unregistered-watcher rejection: local tests only. |
| Source versus deployed | interface parity verified; artifact parity not established; one behavior differs and cannot be checked live without a redeploy. |
| Contract tests | 46 pass; all use mocked authorization, so signature enforcement is not locally tested. |
| Off-chain services | watcher: four live rounds, otherwise mocked-RPC tests; indexer: live routes and events checked, 44 tests; SDK: reads verified live, writes tested only as unsigned transactions. |
| Frontend | wallet connect and public pages verified in a browser once; signed writes and responsive layout unverified. |
| Security | internal review only; scans dated 2026-09-28; no independent audit; no private reporting channel. |
| Operations | nothing hosted or continuously run; CI and branch protection present. |
| Legal | no license. |

## 10. Exact documentation and code corrections required

Made in this pass (documentation only): the wording changes listed in
section 7 and in `claim-traceability` "Claims that were weakened", the
`endpoint_hash` corrections in `SLASettle-contract-spec.md`,
`apps/docs/contracts.md` and `apps/docs/deployment-topology.md`, three
phase-number references, and the `TEST-MATRIX.md` banner.

Required and not made:

1. `slasettle-vault/contracts/watcher_registry/src/lib.rs`: comments at
   `submit_check` and at `let _ = &endpoint_hash` (hash is not stored).
2. `slasettle-vault/contracts/sla_vault/src/lib.rs`: comment above
   `trigger_settlement` (`caller` is not recorded in the event).
3. `slasettle-hub/watcher/internal/round/round.go`: header comment.
4. `slasettle-hub/apps/web`: landing hero, layout description, footer strings.
5. Maintainer decision on hub issues #11 and #12 (scope update or closure) and
   on adding the redeploy caveat to vault issue #3.
6. Optional: a test that asserts signatures are required (contract tests use
   `mock_all_auths`), and a permissionless-settlement test using an unrelated
   account. Not created in this pass.

## 12. Follow-up after the final audit (2026-09-29)

Two statements in this record are outdated. Section 3 says every contract test
uses `mock_all_auths()`; since vault `d79c52d` five tests use explicit narrow
authorizations and show that a missing or wrong signature is rejected and that
`trigger_settlement` needs neither a signature nor a role (the older tests
still use `mock_all_auths()`). Question 18 (penalty) says the cap is tested
locally and not live; that is now true, because a partial-payout test exists
(`304b948`), and the live cap is still UNVERIFIED. Question 33's list of known
limitations gains: instance-storage lifetime is not extended by the source
(the live one was extended by hand), and persistent entries the workflow
needs were extended by hand on 2026-09-29. Classification of everything found:
`findings-classification-2026-09-29.md`.

## 11. Follow-up: corrections made after this review (2026-09-29)

Items 1 to 4 of section 10 and the issue observations of section 8 were acted
on. The findings above are kept as originally written.

- `watcher_registry/src/lib.rs`: the `submit_check` doc comment and the comment
  at `let _ = &endpoint_hash` now say the hash is accepted, not persisted and
  not emitted, and is observable only from the transaction. Comments only.
- `sla_vault/src/lib.rs`: the `trigger_settlement` doc comment now says
  `caller` is not authorized, not stored, not in `SettlementPaid`, and visible
  from the transaction. Comment only.
- `watcher/internal/round/round.go`: the package comment now describes the
  off-chain convention, and that the contracts treat `round_id` as opaque.
- Landing copy: hero "Independent watchers check the service every round"
  became "Registered watchers check the service each round"; the layout
  description now ends "… on-chain bonds and watcher votes, on Stellar Testnet."
  instead of "public settlement"; the footer reads "uptime bonds on Stellar
  Testnet" and its "Documentation" link, which points at the hub repository, is
  labeled "Hub source".
- Docs: "independent watchers" became "registered watchers" in
  `apps/docs/index.md`, `introduction.md` and `testnet-deployment.md`.
- Issues #11 and #12 were rewritten to record what 2026-09-29 completed and
  what remains. #11 keeps one open criterion (the indexer route reflecting a
  daemon vote). #12 keeps signed dashboard writes, app theme observation,
  `prefers-reduced-motion` and mobile checks open. Neither was closed.

Unchanged and still open: UNVERIFIED (signed dashboard writes, narrow-viewport
docs, dedicated secret scanning, live rejections, live payout cap, second live
pagination page) and BLOCKED (live zero-balance withdrawal rejection,
soroban-sdk 28.0.0 redeploy). Landing-page hero text no longer needs a
correction; item 6 of section 10 (extra tests) was not attempted.
