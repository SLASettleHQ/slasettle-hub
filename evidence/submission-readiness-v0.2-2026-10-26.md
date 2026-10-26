# Current v0.2 submission-readiness record — 2026-10-26

This is the concise reviewer entry point. It describes a **Testnet-only,
unaudited** system and supersedes older readiness conclusions where they conflict.

## Source, releases, and CI

| Item | Verified value |
|---|---|
| Hub main | `e2b9e3f10d71eeee268bc4ddc26a8b405e08cf8c` |
| Vault main | `e6fa37f77fc78843a939bc6581f6910483d0b312` (docs-only reconciliation after release) |
| [Hub v0.2.0](https://github.com/SLASettleHQ/slasettle-hub/releases/tag/v0.2.0) | targets `e2b9e3f10d71eeee268bc4ddc26a8b405e08cf8c` |
| [Vault v0.2.0](https://github.com/SLASettleHQ/slasettle-vault/releases/tag/v0.2.0) | intentionally targets shipped contract source `371ca2e66adb1c161ed967d3676ae4e0f1f0a419` |
| Hub main CI | [run 40328025294](https://github.com/SLASettleHQ/slasettle-hub/actions/runs/40328025294), success: web/SDK, indexer, watcher |
| Vault reconciliation CI | [run 40330086282](https://github.com/SLASettleHQ/slasettle-vault/actions/runs/40330086282), success |

## Current public GREEN Testnet stack

- Web: https://slasettle-web.vercel.app
- Indexer: https://slasettle-indexer-v02.slasettle-indexer.workers.dev
- `watcher_registry`: `CDTIVQ6I77EMFP42522RIFKMSMJID3BDLNR5LPLJEGVAS4Q2DJDMN3DY`
- `sla_vault`: `CA5R7V5IGMYOBRSAMP4R5MWURSNTY6565NSKEEVR6626PLC3VM2A3EZ2`
- Registry Wasm SHA-256: `e433b7e36580889b1a2aa94570ed7adee7e9048d4d211a10031ffcfa8fc53171`
- Vault Wasm SHA-256: `23ea6cdc28a11883fd5979c06fcdea3b3f68a5b2aa9f0bace855de0149d8ac79`
- Stellar Testnet Protocol 29 at deployment/cutover verification.

The BLUE/v0.1 Worker, D1, contracts, and Web deployment remain preserved as
rollback/legacy infrastructure.

## Validation

- 595 automated tests: Vault 72, SDK 89, Web 277, indexer 69, watcher 88.
- The [production-cutover record](v0.2-production-cutover-2026-10-26.md)
  verifies the promoted artifact, public services, GREEN identities, isolated
  D1, CORS, and preserved rollback state.
- The [Testnet deployment record](../apps/docs/testnet-deployment.md) records a
  real Preview/Freighter lifecycle: create, top-up, three project-controlled
  watcher observations, settlement, cancellation, and withdrawal.
- The [claim ledger](claim-traceability-v0.2-2026-10-26.md) maps current claims
  to code, tests, CI, live evidence, and caveats.

## Current limitations and residual findings

- No independent third-party security audit; Testnet only.
- Three GREEN watcher identities are project-controlled. Endpoint commitment
  binds votes to an endpoint commitment but does not prove truthful HTTP
  observation. There is no commit-reveal and the watcher registry is shared.
- `uptime_target_bps` is descriptive; settlement is per round and is not
  automatically scheduled.
- Residual VitePress/Vite and Wrangler/Miniflare development/deployment-tool
  advisories require breaking upgrades; they were not forced into v0.2.
- Open issues: Hub [#12](https://github.com/SLASettleHQ/slasettle-hub/issues/12)
  for remaining physical-device/reduced-motion browser observations; Hub
  [#15](https://github.com/SLASettleHQ/slasettle-hub/issues/15) for unexecuted
  live edge evidence and hardening; Vault
  [#4](https://github.com/SLASettleHQ/slasettle-vault/issues/4) for commit-reveal.

## Not verified / no claim made

No interviews, customers, users, adoption, revenue, partnerships, or demand
statistics were verified. No exact uniqueness claim is made; ApexChainx is a
materially similar Soroban SLA project. No live payout-cap edge case, complete
rejected-call set, second live pagination page, dedicated secret-scanner run,
archive-restore execution, physical-device pass, independent watcher operation,
Mainnet deployment, or rollback drill is claimed.

## Reviewer conclusion

The current evidence supports a final demo or appeal pack for an implemented
and publicly deployed v0.2 Testnet prototype. It does not support a Mainnet,
audited, decentralized-monitoring, market-adoption, or production-security claim.
