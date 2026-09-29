# Final Technical Audit, revision 3

Rerun after a submission-critical post-freeze change: public presentation and
hosting. It re-verifies the changed areas and the areas those changes could
affect; it does not restate the earlier revisions
(`final-technical-audit-2026-09-29.md`, `…-r2.md`). No contract source, contract
behavior, SDK version, dependency, application source or branch protection was
changed, and nothing was redeployed on-chain.

## 1. What changed since revision 2

| Change | Where | Commit |
|---|---|---|
| Vercel configuration for the two hosted surfaces | `apps/docs/vercel.json`, `apps/web/vercel.json` | hub `f787e55` |
| README badges and public links; hosting statements updated in the docs | hub `README.md`, `apps/docs/*.md` | hub `8773628` |
| README badge and links | vault `README.md` | vault `caae637` |
| Documentation hosted on Vercel | https://slasettle-docs.vercel.app | deployed from hub `8773628` (git archive of that commit), 2026-09-29 |
| Frontend hosted on Vercel, without an indexer | https://slasettle-web.vercel.app | deployed from hub `9262026` plus `apps/web/vercel.json` (committed as `f787e55`), 2026-09-29T15:26Z; no `apps/web` source changed since |
| GitHub Website fields | hub: the frontend URL; vault: the documentation URL | GitHub settings |

The first docs deployment (from `9262026`, 15:15Z) served the home page but
returned 404 for every sub-page because VitePress's clean URLs need
`cleanUrls` on Vercel; the configuration was corrected and the site redeployed
before anything was recorded as live.

## 2. Verification of the new public surfaces (2026-09-29)

| Check | Result | Status |
|---|---|---|
| Docs over HTTPS, unauthenticated | `/` and 11 sub-pages returned 200; an unknown path returns 404; production alias is publicly readable (Vercel protection applies to preview URLs) | VERIFIED |
| Docs in a real browser | home page renders; local search for "quorum" returns results with heading paths; all five top-navigation links resolve; the GitHub link points at the hub repository | VERIFIED |
| Docs content matches the repository | the hosted `deployment-topology` and `end-user-guide` pages carry the new hosting text | VERIFIED |
| Frontend over HTTPS | `/`, `/dashboard`, `/status/0` return 200, an unknown path 404 | VERIFIED |
| Frontend configuration | in a browser the four public values (RPC URL, Testnet passphrase, both contract IDs) are inlined in the client bundle; no `localhost` reference; no secret-shaped string found (regex count 0) | VERIFIED |
| Frontend network claim | the header badge reads "Testnet" (the configured network); the wallet control reads "Connect Wallet" and no wallet was connected | VERIFIED |
| Frontend live reads | `/status/0` shows SLA #0 Active, provider, beneficiary, token, bond balance `4.6 native`, penalty `1 native`, quorum `3`, read live from Testnet | VERIFIED |
| Indexer-dependent panels | the round-status and settlement-history panels show "NEXT_PUBLIC_INDEXER_API_URL is not set" | VERIFIED (documented behavior, not hidden) |
| Freighter connection on the hosted origin | not tested; the earlier Freighter verification was on a local origin | UNVERIFIED |
| Signed dashboard writes on the hosted origin | not tested | UNVERIFIED |
| Indexer | no long-running host was available; nothing was deployed and no URL invented | unavailable |
| Contract explorer links | the explorer's API returned both contracts with creator `GBWM5N2S…` and the recorded WASM hashes (`4c626d2c…`, `69097132…`); the contract pages return 200. A Stellar Lab page loads but takes a contract by input, so no deep link was verified for it | VERIFIED (explorer used) |
| GitHub Website fields | hub `homepage` = the frontend URL; vault `homepage` = the documentation URL; descriptions and topics present on both | VERIFIED |
| CI badges | both render "passing" from the workflow | VERIFIED |

Limits on what is verified: the deployments run on a personal Vercel account
(Hobby plan, `*.vercel.app` addresses), are not connected to the GitHub
repositories, and are redeployed by hand; there is no project-owned domain.

## 3. Re-run of the standing checks

| Area | Result |
|---|---|
| Live contracts | WASM hashes `4c626d2c…`, `69097132…`; instance lifetimes live until ledgers 7932489 and 7932493 (about 173.5 days at ledger 4934679); unchanged |
| Vault | `cargo test` 34 + 18 = 52 pass; `stellar contract build` passes with the same local hashes (`10c53424…`, `73a3fbaa…`); `cargo fmt --check` 9 diffs and 2 clippy warnings, unchanged |
| Hub | `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `build` pass; SDK 29/29, web 50/50; docs build passes |
| Indexer | 45/45, build passes |
| Watcher | `go build`, `go vet`, `go test -count=1` pass (48) |
| CI | vault `caae637` run `36591677083`, job `check, test, build`: success; hub `8773628` run `36591669274` and `f787e55` runs `36591484500`, `36591482360`: success |
| Source change since revision 2 | none in contracts, SDK, indexer, watcher or `apps/web` source; the hub diff is configuration, READMEs and docs |
| Attribution | no Claude or Anthropic text in any commit message |
| PR #8 | open, head `449e285`, last updated 2026-09-29T01:17Z: untouched |
| Issues and branch protection | not modified |

## 4. Consistency of claims

- The READMEs, the documentation, the submission pack and the evidence ledger
  agree that the frontend and documentation are hosted, that the indexer is not,
  and that the hosted frontend has no indexer.
- Every statement about the contracts (interface parity, artifact difference,
  zero-balance behavior, lifetimes, known limitations) is unchanged from
  revision 2; the hosting change touched none of it.
- Historical records (the topology page's earlier "not deployed" text before
  2026-09-29, the classification record, revisions 1 and 2) are preserved.

## 5. Findings

No new defect in the changed areas. New or changed items:

| Item | Class | Status |
|---|---|---|
| Hosted frontend has no indexer, so two panels cannot load there | C, known limitation (indexer hosting unavailable) | VERIFIED behavior, documented |
| Vercel projects sit on a personal account, are not Git-connected, and need manual redeploys | C | documented in `deployment-topology.md` |
| Freighter and signed writes on the hosted origin | E | UNVERIFIED (hub #12) |
| Docs and frontend are not built or deployed by CI | E | unchanged (hub #15) |

All earlier UNVERIFIED and BLOCKED items are unchanged: signed dashboard
writes, narrow-viewport checks, a dedicated secret scan, live wrongly-signed,
below-quorum and unregistered-watcher rejections, live payout cap, a second
pagination page, daemon-to-indexer read-back, the restore path; and, blocked,
the live zero-balance rejection, the soroban-sdk 28.0.0 redeploy and a
permanent source-level instance-lifetime fix.

Submission freeze remains active.
