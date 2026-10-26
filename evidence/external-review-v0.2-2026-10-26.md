# Skeptical external review — v0.2, 2026-10-26

This review starts from public repositories and services rather than the
maintainer's intent. It does not constitute an independent security audit. The
historical [2026-09-29 review](external-review-2026-09-29.md) is preserved.

## Executive finding

SLASettle v0.2 is a materially implemented, publicly inspectable Testnet
prototype with a real browser-to-contract lifecycle. Stellar is load-bearing
for escrow custody, deterministic settlement, token transfers, permissionless
invocation, and source/Wasm/deployment traceability. The evidence is sufficient
for a candid demo or appeal pack, but not for claims of adoption, decentralized
monitoring, production security, or uniqueness.

No remaining finding makes the documented v0.2 Testnet lifecycle false. The
most important reviewer risks are the project-controlled watcher committee,
the absence of an independent audit or user validation, and the existence of a
materially similar Stellar/Soroban SLA comparator (ApexChainx).

## Reviewer questions

### 1. Is the problem understandable?

**Yes, with a narrower framing than some historical project prose.** Public
provider SLAs show claim deadlines, evidence requirements, exclusions, and
provider review. SLASettle addresses pre-funded, programmable per-round
penalties after a registered watcher quorum—not all SLA measurement, dispute,
or monthly-credit problems. See [problem validation](../research/problem-validation.md).

### 2. Is Stellar load-bearing?

**Yes.** The implementation uses Soroban for custody, validation, tally reads,
atomic token transfer, permissionless settlement, and observable state/events.
The same monitoring and workflow UI could be implemented off-chain, but then a
conventional operator would control the database, escrow account, and payout
process. Stellar does not make the HTTP observation truthful; it makes the
recorded condition and transfer independently executable and inspectable.

### 3. Is the project meaningfully implemented?

**Yes.** It includes two Rust contracts, a typed SDK, a Web application, a Go
watcher, a Worker/D1 indexer, migrations, runbooks, 595 tests, and deployed
Testnet artifacts. The test total is not used as a proxy for quality: the
contract invariant tests, cross-language hash vectors, strict decoder tests,
route/DB tests, and real lifecycle evidence matter more than the aggregate.

### 4. Is the public deployment real?

**Yes, for Testnet.** The public Web and GREEN indexer were smoke-tested after
promotion; GREEN SLA #0 has create, top-up, settlement, cancellation, and
withdrawal transactions. BLUE remains a separate rollback stack. “Production”
here means the project's current public Testnet service, not Mainnet readiness.

### 5. Can source → release → Wasm → Testnet identity be traced?

**Yes.** Hub v0.2.0 targets `e2b9e3f10d71eeee268bc4ddc26a8b405e08cf8c`.
Vault v0.2.0 intentionally targets the shipped contract source
`371ca2e66adb1c161ed967d3676ae4e0f1f0a419`; later Vault main changes are
documentation-only. Rebuilt registry/vault hashes match the recorded deployed
hashes `e433b7…53171` and `23ea6c…8ac79`.

### 6. Are tests meaningful or inflated?

**Meaningful but not comprehensive.** The 595 count spans five different test
frameworks and includes focused invariant, boundary, decoding, database, UI,
and integration tests. It should not be interpreted as coverage percentage,
formal verification, adversarial review, or independent testing. Several live
edge cases remain unexecuted.

### 7. Does the UI perform genuine contract writes?

**Yes.** The v0.2 Preview/Freighter flow created SLA #0, topped up its bond,
triggered settlement, cancelled it, and withdrew the remainder. The production
alias uses the same promoted deployment artifact. A signing delay was observed
but was not established as a repository defect.

### 8. Is watcher functionality real?

**Yes, with a critical trust caveat.** The Go daemon hashes and preflights its
endpoint, reads the contract round and duplicate-vote state, probes HTTP, signs,
retries bounded RPC operations, and submits a check. The v0.2 decoder fix was
exercised by the GREEN run. All three current identities are project-controlled;
the run is not evidence of an independent committee or truthful observations.

### 9. Is the indexer real and independently hosted?

**It is real and separately hosted, not independently operated.** A Cloudflare
Worker and isolated D1 ingest contract events and serve health, watcher, round,
settlement, provider, and lifecycle reads. It is operationally separate from
the Vercel Web, but both remain project-controlled. The indexer is a cache, not
canonical settlement state.

### 10. Are security limitations honestly disclosed?

**Current v0.2 docs largely do so.** They state Testnet-only, no independent
audit, project-controlled watchers, no commit-reveal, a shared registry,
endpoint-attestation limits, descriptive uptime target, per-round settlement,
and no automatic scheduler. Historical evidence still contains dated obsolete
conclusions, so the current evidence index must clearly route reviewers.

### 11. Are claims stronger than evidence?

**Some historical claims were.** The Phase 12 repository-wide attribution
claim was inaccurate and is superseded in place. “Decentralized watcher” or
“automatic settlement” wording would also be stronger than the deployment.
The ecosystem search found ApexChainx, so no category-uniqueness claim is
supported. The current records avoid those claims.

### 12. Does the repository look maintained rather than deadline-generated?

**Mostly, with presentation debt.** Multiple rounds of bug fixes, dependency
maintenance, CI hardening, migrations, operational cutover, and preservation of
rollback state show ongoing maintenance. Conversely, the large number of
phase-numbered evidence files is difficult to navigate and some old records use
overconfident language. The current reviewer path mitigates that without
rewriting history.

### 13. Is there a credible contribution runway?

**Yes.** Vault issue #4 (commit-reveal), Hub #12 (remaining browser/device
observations), and Hub #15 (live edge evidence and operational hardening) are
concrete. Broader work includes independent watcher operation, per-SLA watcher
sets, automatic keepers, cumulative accounting, audit, and Mainnet readiness.

### 14. Does public material conflict with current deployment state?

**No current-facing conflict was identified in this pass.** The v0.2 GREEN IDs,
Protocol 29-at-cutover wording, 595 tests, and rollback state agree across the
current README/docs/evidence/release. Dated v0.1 and pre-cutover records remain
historical and are not evidence of current production.

## Findings

### BLOCKER

None for a truthful final demo or appeal pack. This is not a conclusion that
the system is ready for Mainnet or custody of production value.

### IMPORTANT

- No independent third-party security audit has been performed.
- The current watcher committee is project-controlled; endpoint commitment
  does not prove honest observation, and commit-reveal is absent.
- No interviews, users, customers, adoption, revenue, or demand metrics were
  verified. The problem is publicly evidenced; product demand is not.
- ApexChainx is a materially similar Stellar/Soroban SLA project. Any appeal
  must differentiate the actual endpoint-bound watcher design rather than claim
  categorical novelty.

### NON-BLOCKING

- Live payout-cap, rejected-call set, second pagination page, and archive
  restore execution remain unverified.
- No dedicated entropy-based secret scanner has completed, and dependency
  scans are manual rather than scheduled.
- The app's reduced-motion media query has not been triggered in a real browser;
  no physical-device/touch pass is recorded.
- A rollback configuration is preserved, but no v0.2 production rollback drill
  was executed.
- Residual development-tool advisories remain in VitePress/Vite and
  Wrangler/Miniflare chains; documented remediation requires breaking upgrades.

### FUTURE HARDENING

- commit-reveal or another last-mover mitigation;
- independently operated and possibly per-SLA watcher sets;
- an explicit watcher submission deadline and automated settlement keeper;
- cumulative/monthly SLA accounting if the product claims monthly availability;
- independent audit, adversarial testing, production key management, and
  Mainnet operational design.

## Verdict

**Review-ready as an honest Testnet prototype.** The evidence supports a final
demo or appeal pack that clearly states limitations and comparative position.
It does not support “production-ready,” “trustless monitoring,” “decentralized
committee,” “audited,” “adopted,” or “unique.”
