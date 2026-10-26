# v0.2 claim traceability — 2026-10-26

This is the current v0.2 claim ledger. The 2026-09-29 ledger remains a dated
historical record. Paths beginning `vault/` refer to
`SLASettleHQ/slasettle-vault`; other paths are in this repository.

**Evidence basis.** Hub main `e2b9e3f10d71eeee268bc4ddc26a8b405e08cf8c`;
Vault release source `371ca2e66adb1c161ed967d3676ae4e0f1f0a419`;
Hub main CI [40328025294](https://github.com/SLASettleHQ/slasettle-hub/actions/runs/40328025294);
Vault reconciliation CI [40330086282](https://github.com/SLASettleHQ/slasettle-vault/actions/runs/40330086282);
and the dated live records linked below. “Verified” never means independently
audited.

| Current claim | Code | Deterministic test | CI | Deployment / live evidence | Limitation / status |
|---|---|---|---|---|---|
| An SLA stores an endpoint commitment | `vault/contracts/sla_vault/src/storage.rs`, `lib.rs`; `packages/sdk/src/sla-vault.ts` | Vault `sla_vault/src/test.rs`; SDK `sla-vault.test.ts` | Both current CI runs | GREEN SLA #0 config in [Testnet lifecycle](../apps/docs/testnet-deployment.md) | Commitment is not proof of an HTTP observation. **VERIFIED.** |
| Endpoint hashing is SHA-256 of `slasettle:endpoint:v1:` plus ASCII-trimmed URL | `packages/sdk/src/hash.ts`; `watcher/internal/endpoint/endpoint.go` | `hash.test.ts`; Go `endpoint_test.go`, cross-language vectors | Hub CI | Preview create flow committed the configured endpoint; verifier matched it | URL canonicalization is intentionally only ASCII trim. **TESTED; LIVE INTEGRATED.** |
| One vote per watcher per SLA/round, even with a different endpoint hash | `vault/contracts/watcher_registry/src/lib.rs`, key `Check(sla_id, round_id, watcher)` | `test_endpoint_hash_isolation_and_one_vote_invariant` | Vault CI | Lifecycle quorum used three distinct project-controlled identities | Rejected duplicate was simulated; no second tx was submitted. **TESTED / LIVE QUORUM.** |
| Tallies are isolated by endpoint commitment | `vault/.../watcher_registry/src/lib.rs`, `Tally(sla_id, round_id, endpoint_hash)` | Same isolation test plus tally tests | Vault CI | GREEN lifecycle tally matched SLA #0 commitment | Malicious watchers can spend their single vote on another hash. **TESTED / LIVE MATCHING TALLY.** |
| Round acceptance derives from ledger timestamp and permits current or immediately previous round | `vault/.../watcher_registry/src/lib.rs::submit_check` | current, previous, future, and stale round cases in registry tests | Vault CI | GREEN watcher submissions landed in accepted rounds | Not wall-clock truth; depends on ledger close time. **TESTED / LIVE USED.** |
| Quorum must be nonzero and no larger than registered watcher count | `vault/contracts/sla_vault/src/lib.rs::create_sla` | zero/over-count/valid quorum tests | Vault CI | SLA #0 was created at 2-of-3 | Global registered count can later change. **TESTED / LIVE USED.** |
| `uptime_target_bps` must be in `1..=10_000` | `vault/.../sla_vault/src/lib.rs` | boundary/rejection cases in vault tests and SDK validation | Both CI runs | SLA #0 stores the configured value | Descriptive only; settlement does not calculate cumulative uptime. **TESTED.** |
| Repeated cancellation is rejected | `vault/.../sla_vault/src/lib.rs::cancel_sla` | cancellation state tests | Vault CI | Duplicate cancel simulation returned `SlaNotActive`; no second tx | Simulation evidence, not a second submitted call. **VERIFIED READ-ONLY.** |
| Contract instance and persistent entries receive TTL extensions | both Vault contracts' `lib.rs` and `storage.rs`; public `extend_contract_ttl` | TTL threshold/extension tests in both crates | Vault CI | v0.2 Wasm hashes match deployment | Archive/restore execution was not exercised. **TESTED, RESTORE UNVERIFIED.** |
| The TypeScript SDK exposes typed reads and unsigned writes for v0.2 | `packages/sdk/src/{client,sla-vault,watcher-registry,types}.ts` | 89 SDK tests including strict decoding and amount validation | Hub `web and sdk` job | Web lifecycle used SDK-built contract operations | SDK reports restore-required simulations but does not itself submit a restore transaction. **TESTED / LIVE INTEGRATED.** |
| The Web create flow performs a genuine contract write | `apps/web/components/dashboard/create-sla-form.tsx`, `lib/use-transaction.ts` | create form, transaction, validation, mismatch-block tests | Hub `web and sdk` job | Create tx `3ad48c0f…a9223` through Preview/Freighter | Physical mobile use was not tested. **VERIFIED LIVE.** |
| The Web can locally verify a URL against the stored commitment | `apps/web/components/status/endpoint-verifier.tsx`, `lib/endpoint-commitment.ts` | corresponding verifier and commitment tests | Hub `web and sdk` job | Included in production smoke surface | A local hash match proves only equality to the commitment. **TESTED / DEPLOYED.** |
| Watcher preflight refuses a configured endpoint mismatch | `watcher/cmd/watcher/main.go::checkEndpointCommitment` | `cmd/watcher/main_test.go`; contract and endpoint tests | Hub watcher job | Three GREEN watchers reported for the committed endpoint | Current operators are project-controlled. **TESTED / LIVE INTEGRATED.** |
| Watcher RPC/submission uses bounded retry behavior | `watcher/internal/retry`, retry calls in `internal/contract/contract.go` | `internal/retry/retry_test.go`, RPC transport tests | Hub watcher job | GREEN watcher quorum reached on Testnet | No explicit per-round submission deadline. **TESTED / LIVE USED.** |
| Watcher live decoder handles Soroban `i128` and vec-wrapped enum values | `watcher/internal/contract/contract.go::scValToNative` | `contract_internal_test.go` i128/vec cases and RPC tests | Hub watcher job | v0.2 watchers successfully read SLA state and submitted votes | Live success establishes the exercised shapes, not every XDR form. **VERIFIED.** |
| Indexer accepts only vec-wrapped `Up` or `Down`; unknown values are quarantined | `indexer/src/ingest/classify.ts::mustCheckStatusEnum` | explicit Up/Down, unknown, missing, and wrong-shape cases in `classify.test.ts` | Hub indexer job | GREEN watcher rows decode to the expected three identities | Future contract variants require an indexer update. **TESTED / LIVE USED.** |
| Top-up, cancel, and withdraw lifecycle events persist and are served | classifier, SQLite/D1 stores, `/v1/slas/:slaId/lifecycle` routes | classifier, DB, D1, route, and Worker tests | Hub indexer job | GREEN SLA #0 lifecycle returns all three events | Read-side cache is not canonical contract state. **VERIFIED LIVE.** |
| v0.2 schema migration preserves endpoint/lifecycle fields | `indexer/migrations/0002_v0.2_endpoint_lifecycle.sql` | `db/d1.test.ts`, Worker migration tests | Hub indexer job | GREEN D1 serves v0.2 rows | Migration was applied to GREEN, not BLUE. **TESTED / DEPLOYED.** |
| BLUE and GREEN data are isolated | canonical and rollback Wrangler configs; separate D1 IDs | `db/cutover-collision.test.ts` proves same-D1 collision hazard | Hub indexer job | GREEN D1 `17b47ce0…804b`; BLUE D1 `c45540af…4e69`, both preserved | This is operational isolation, not schema-level multi-deployment support. **VERIFIED.** |
| Public Web is configured for GREEN contracts and indexer | Web deployment configuration recorded in cutover evidence | build/config tests and 277 Web tests | Hub main CI | alias, confirmation bundle, `/status/0`, and GREEN indexer smoke checks | Deployment was manually staged because the Vercel project is not Git-connected. **VERIFIED.** |
| A public Testnet lifecycle completed create, top-up, settlement, cancel, withdraw | Contract, SDK, Web, watcher, and indexer code above | 595 total automated tests | Both current CI runs | txs `3ad48c0f…`, `4f894907…`, `bf43521f…`, `0c82c70f…`, `bd8dde21…` | Testnet only; watcher-submission hashes are not invented. **VERIFIED LIVE.** |
| Settlement is permissionless and pays at most the remaining bond | `vault/.../sla_vault/src/lib.rs::trigger_settlement` | permissionless, quorum, duplicate, and payout-cap tests | Vault CI | GREEN settlement tx `bf43521f…97a085` paid one full penalty | The below-penalty payout cap has not been executed live. **CORE FLOW VERIFIED; EDGE LIVE-UNVERIFIED.** |
| Provider cancellation and withdrawal are separate authenticated actions | Vault `cancel_sla` / `withdraw_remaining_bond`; Web actions | Vault and Web action/state tests | Both CI runs | GREEN cancel and withdrawal txs above | No claim that cancellation refunds automatically. **VERIFIED LIVE.** |
| BLUE remains a usable rollback path | `indexer/wrangler.blue-v01.rollback.jsonc`; cutover runbook | config and build coverage only | Hub CI | BLUE Worker health and rollback deployment Ready at cutover/post-merge verification | Rollback command has not been executed in v0.2 production. **PRESERVED, NOT DRILLED.** |
| Published artifacts identify exact release source and Wasm | Hub/Vault release metadata; Vault build source | Vault rebuild/hash verification and 72 tests | Both CI runs | registry `e433b7…53171`; vault `23ea6c…8ac79`; deployed IDs in release notes | Vault tag intentionally predates docs-only main reconciliation. **VERIFIED.** |

## Evidence links

- [v0.2 production cutover](v0.2-production-cutover-2026-10-26.md)
- [current Testnet deployment and lifecycle](../apps/docs/testnet-deployment.md)
- [Hub v0.2.0 release](https://github.com/SLASettleHQ/slasettle-hub/releases/tag/v0.2.0)
- [Vault v0.2.0 release](https://github.com/SLASettleHQ/slasettle-vault/releases/tag/v0.2.0)
- [Vault v0.2 current deployment evidence](https://github.com/SLASettleHQ/slasettle-vault/blob/main/evidence/testnet-v0.2-2026-10-26.md)

## Claims not established

This matrix does not establish independent watcher operation, truthful HTTP
observation, automatic settlement scheduling, cumulative SLA accounting,
Mainnet readiness, an independent security audit, adoption, customers,
revenue, or uniqueness. It also does not turn the unexecuted live edge cases
listed in Hub issue #15 into verified claims.
