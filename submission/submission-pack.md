# SLASettle Submission Pack

Prepared 2026-09-29 from the repositories' evidence, source and GitHub state
as they stood at hub `8773628` and vault `caae637` (both `main`), updated after the 2026-09-29 publishing pass. Every number,
hash and status below is taken from a record in the repositories or from a
check made on 2026-09-29; the records are named in each section. The
repositories are in **submission freeze**: this pack changes no source.

Repository-relative paths below (for example `evidence/index.md`) are paths
inside `slasettle-hub` unless a `vault:` prefix says otherwise. They are file
locations in the repositories, not hosted documentation URLs.

## 1. Project

- **Name:** SLASettle
- **What it is:** a Stellar Soroban system in which a service provider locks a
  token bond in a contract for an uptime promise. Watchers registered by the
  project admin check the service each round and vote up or down in a registry
  contract. When a round has at least as many down votes as the SLA's
  `quorum_threshold`, anyone can call a settlement function and a fixed
  penalty is paid from the bond to the SLA's beneficiary.
- **Network:** Stellar Testnet only (`Test SDF Network ; September 2015`).
  Nothing is deployed to mainnet.
- **Status:** a Testnet prototype. It is not production-deployed and not
  audited by a third party. The two contracts are deployed on Testnet; the
  frontend and the documentation are hosted on Vercel (frontend without an
  indexer); nothing else is hosted.
- **Public URLs:** application https://slasettle-web.vercel.app (Testnet; SLA
  data read live, but no hosted indexer, so the round-status and
  settlement-history panels show "indexer not configured");
  documentation https://slasettle-docs.vercel.app. Both are on a personal
  Vercel account, deployed by hand on 2026-09-29 (`evidence/final-technical-audit-2026-09-29-r3.md`).

## 2. Repository URLs

- Hub: https://github.com/SLASettleHQ/slasettle-hub
- Vault: https://github.com/SLASettleHQ/slasettle-vault

The two repositories are complementary, not duplicates:

- **`slasettle-vault`** holds the two Soroban contracts (`watcher_registry`,
  `sla_vault`), their tests, the contract specification and the Testnet
  contract evidence. It is the only place contract logic is defined.
- **`slasettle-hub`** holds everything that talks to the contracts: the
  Next.js frontend (`apps/web`), the TypeScript SDK (`packages/sdk`), the
  event indexer (`indexer`), the Go watcher daemon (`watcher`), the VitePress
  documentation source (`apps/docs`) and the cross-repository evidence
  (`evidence/`). It refers to the contracts only by deployed contract ID.

## 3. Current Testnet contracts

Deployed 2026-09-27 (evidence: `vault:evidence/testnet-2026-09-27.md`).
Transaction links use the explorer's transaction pages. Contract pages:
[`watcher_registry`](https://stellar.expert/explorer/testnet/contract/CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF)
and [`sla_vault`](https://stellar.expert/explorer/testnet/contract/CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN)
(the explorer's API returned both, with creator `GBWM5N2S…` and the WASM hashes
below, on 2026-09-29). Stellar Lab's contract explorer loads but takes a contract
by input, so no Lab deep link is given.

| Contract | Contract ID | Live WASM SHA-256 | Deployment tx (create) | Ledger, time (UTC) |
|---|---|---|---|---|
| `watcher_registry` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | `4c626d2c62e6f9b56b271e1a19798d2530c355b16724ff4e53c1e6ac6a3e4c6e` | [`da13eca3…`](https://stellar.expert/explorer/testnet/tx/da13eca35efa337ae17b570e207f7f2bad8f4dbe32299472907a151d7f0ac395) | 4905584, 2026-09-27T23:25:07Z |
| `sla_vault` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | `6909713244bf5837954b8d584343e2136bd7570a10da8db7b30533e613b67830` | [`cc3494a1…`](https://stellar.expert/explorer/testnet/tx/cc3494a158bee2fd6f08bd9676b4070dd900075b5fd58814d2d171c395fd1167) | 4905659, 2026-09-27T23:31:22Z |

- WASM upload transactions: registry
  [`07e0a6a3…`](https://stellar.expert/explorer/testnet/tx/07e0a6a32f0fd2d412f26254192cac7cad52ea7d67763a3f6bfacf2a3e8f44b7),
  vault
  [`1e19aa0d…`](https://stellar.expert/explorer/testnet/tx/1e19aa0d00cf334ebe0f8bebb5c2182490bc0c6d6b33c9289136894278d41902).
  Initialization: registry
  [`7a51b818…`](https://stellar.expert/explorer/testnet/tx/7a51b8187cd35161a7485dc84072f28dbcd45e7782a476fb8322e27cb9fa749e),
  vault
  [`338c9ef1…`](https://stellar.expert/explorer/testnet/tx/338c9ef18fdaf386000cc58235767ddbfa6899518a00fa9e5affb1398507f5ab).
- RPC: `https://soroban-testnet.stellar.org`. Admin:
  `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`. Token used:
  the native XLM contract on Testnet, `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.
- **Re-checked 2026-09-29:** the on-chain WASM of both contracts was fetched
  and its SHA-256 equals the hashes above (`evidence/parity-matrix-2026-09-29.md`
  section 0.1; re-read again in `evidence/final-technical-audit-2026-09-29-r2.md`).
- **Historical deployment, not current:** an earlier pair,
  `watcher_registry` `CBEZ3XBIWK2AWYGZRNDGNZG3AZTJHFMQL5HVWTEUZZ5HLSCO4QDFJB77`
  and `sla_vault` `CBA4DFNUBVCPLEAUD5O2CHSUB6DRWUNM7A537EBVPAGDETFBB2CABXI2`,
  predates the `quorum_threshold == 0` fix. It is kept as historical
  evidence only; whether it is still live was not re-checked.

## 4. Deployment and source status

Stated directly:

- The live contracts were **built and deployed with soroban-sdk 28.0.0** and **stellar-cli 28.1.0** on 2026-10-01. Current vault source also uses **soroban-sdk 28.0.0**.
- **Strict source and deployment parity is established**. The 2026-10-01 deployment completely eliminates the historical mismatch between the SDK 27.0.6 live deployment and the SDK 28.0.0 source.
- Live verified features now include the zero-balance withdrawal rejection, matching the current source behavior.

- The `quorum_threshold == 0` rejection **is** live (it predates the
  deployment; rejected live with error `#7`).
- The live contracts' on-chain spec still contains stale comments about
  `endpoint_hash` and `caller`; the current source's comments are corrected.
- **TTL:** current source never extends instance storage, and extends a
  persistent entry only when it writes it. On 2026-09-29 the live contract
  instances and WASM code entries, which were due to expire about 2026-10-05,
  were **extended by hand** by 3,000,000 ledgers (transactions
  [`b8601edc…`](https://stellar.expert/explorer/testnet/tx/b8601edc018bc487355fb086ea719369e4f543f951fc26da3e8777021bb8fec0),
  [`1e2b750d…`](https://stellar.expert/explorer/testnet/tx/1e2b750d8b84ff3f672f9ecca240eb78432f87abaa3f9b0dc1b56a381a5e07c8),
  [`9efdb520…`](https://stellar.expert/explorer/testnet/tx/9efdb520759d278a990ba481b59e10bbee6a67c2017e9961f9af0bc848631281),
  [`a130b4f3…`](https://stellar.expert/explorer/testnet/tx/a130b4f30b641a4cdae1e671c7f5d89b1ca7f04359b6f8a7561e1288d599fdff)),
  and the persistent entries the workflow needs (five watcher registrations,
  SLAs 0 to 2 with their bond balances, settled round 0/1) were extended by
  twelve further transactions (list in `apps/docs/testnet-deployment.md`). They
  are live until about ledgers 7932489 to 7932981, roughly 174 days from
  2026-09-29. This is an operational mitigation, not a source fix: the source
  policy is unchanged, so the live lifetimes need to be extended again by hand
  before then. Vote-history entries were not extended.
- **No contract was redeployed** in any phase after 2026-09-27, and the WASM
  hashes and live state were unchanged by the extensions.

## 5. Product workflow

```text
registered watcher --HTTP check--> submit_check (watcher_registry)
   --> vote counted per (sla_id, round_id)
anyone --> trigger_settlement (sla_vault)
   --> reads the registry tally --> votes_down >= quorum_threshold ?
   --> pays min(penalty_per_breach, remaining bond) to the beneficiary
```

- Watchers are registered by the project admin. On the current deployment the
  five registered addresses were set up for evidence runs; they are not
  independent operators.
- Triggering settlement is permissionless (the contract never authorizes the
  caller). **Nothing currently triggers settlement automatically** and no
  service runs continuously to do so; the frontend has a button for it and the
  Stellar CLI works too.
- The settlement rule is at least N down votes; up votes are not consulted.
- `uptime_target_bps` is stored and displayed only; it is never enforced.
- Settlement is per round with a fixed penalty; it is not a monthly or
  aggregate uptime enforcement mechanism. `round_id` is an opaque `u64` the
  contracts never check against time; the off-chain convention is
  `floor(unix_seconds / 60)`.

## 6. Live evidence

All on Testnet; source `vault:evidence/testnet-2026-09-27.md` unless stated.
Explorer form: `https://stellar.expert/explorer/testnet/tx/<hash>`.

| Purpose | Date | Transaction | Contract | What it proved |
|---|---|---|---|---|
| Watcher registration (watcher1) | 2026-09-27 | `e1958d645972f6e048f4a136f5b2b0358d5900bd3e59180993e6000560c5b869` | registry | admin registration; `is_watcher` true; `watcher_registered` event |
| Vote Up (SLA 999, round 1) | 2026-09-27 | `d160961e81c3324eef1ba7a016de4802e6167250fc5f43ace1633480daa8130e` | registry | `submit_check` Up; `check_submitted` event |
| Vote Down (SLA 999, round 1) | 2026-09-27 | `6ef581c8c74fbed46460732ae1ed377ce3c0befab4071efd24b3f556ac50a16f` | registry | Down vote; tally `{1,1}` |
| `create_sla` (SLA 0: bond 50000000, penalty 10000000, quorum 3) | 2026-09-27 | `819dd54031a2391d9ead3dbd0a902f5fdaeb597f0914a8307cfacfecc7031083` | vault | bond locked; `sla_created` event |
| Three Down votes for SLA 0, round 1 | 2026-09-27 | `a1982e81bdba921d71822485a5c6ed7172081bce312ef97fe0bd9a64e66a3f66`, `94eea09b7d87b04239a87cab22132eed740b2f5abf1e9302fe6816ed78a078cc`, `c2b2e6f9d46a41642a01972f05515bd0d669d4dba0241daef5d0b49e56b178ce` | registry | quorum of 3 reached; tally `{0,3}` |
| Settlement, called by an account that is not admin, provider or beneficiary | 2026-09-27 | `6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147` | vault | permissionless payout: beneficiary `+10000000`, bond `−10000000`; `settlement_paid` event |
| Duplicate vote and duplicate settlement | 2026-09-27 | (rejected simulations, no hash) | both | `#4` `DuplicateCheck` and `#4` `AlreadySettled` |
| `create_sla` (SLA 1), `cancel_sla`, `withdraw_remaining_bond` | 2026-09-27 | `2d2f8d43bbfef7e49ba65a9e8b1fc749f02a248fdd6aa68de37bc5f81855eb00`, `25fb9d95f34c9f155bd039cbcd80e5ab88eec7049067bab415d74bd4eadda6e8`, `f2d1be379addfe39a2ab0fc6f3933be1e55b00c01dd3b85d1b104741a06f3173` | vault | cancellation, then withdrawal of the 20 XLM bond; withdraw before cancel rejected `#3` |
| Registry pause / unpause | 2026-09-27 | `b7836cf9036e9d1aa421e5854d15de53bd6cb16923402fab3199d5609ea0f9d5` / `463ecb6a43babdd9db27a25b37930cb4e1e97037999a6f3f29841246fabf1040` | registry | vote rejected `#5` while paused |
| Vault pause / unpause | 2026-09-27 | `cf4b174aea690625575301225665b37bfcb8f7f012e4df95d434ca1d913a6212` / `4d0f51ad47c6d04235314cf580c60f1144ac7c11f10ba04784bf49cea81c234e` | vault | `create_sla` rejected `#8` while paused; `top_up_bond` still worked |
| **Live watcher daemon**, four rounds (disposable registered account) | 2026-09-29 | `fd8de72475cfcaaab089db130a7d5d87689c8b57400a84b287d8c74d7e6071b6`, `ccc7fabb84bb423fa61c3e3ea0da48ba179a2b4adbc77c668a3ba57404cfe840`, `563bd1766c0353ec7855375a5e3cc74dcf4bf0c85e5d06719d6e6c3ae04c9bea`, `fb8b4462ec31a9fea1a488971af3c90e8d17ec7e6d0e50bbc9cece3adbf7e722` (rounds 29844195 to 29844198; registered by `a9b53ca277558dc525e696f3597f15efae1908c69445ceef5dfad4cb32e1dc84`, removed by `b6e129cac5de0d7f5509250bf0a474d406038fc7fd82cd52a6452b2eec049142`) | registry | the real `watcher` process checked a real endpoint and submitted votes confirmed on-chain, then shut down cleanly (`evidence/phase-23-verification-2026-09-29.md` Part C) |

Also verified live (details and dates in `evidence/index.md` and the parity
matrix): all eight event kinds observed on real transactions and re-decoded on
2026-09-29; the SDK's read functions against the live contracts; all six
indexer routes against live data from a locally run indexer, and the settlement
history fix (a route that returned HTTP 500 until 2026-09-29, then returned the
real SLA 0 settlement row); the frontend in a real browser with a real Freighter
extension (section 7). The only daemon run was these four rounds; nothing runs a
watcher continuously.

## 7. Frontend

- Source: `apps/web` (Next.js 16, React 19). It is run locally with the
  repository's scripts.
- Browser-verified on 2026-09-29 with a real Freighter extension and the live
  Testnet deployment: wallet connect, address display, disconnect and
  reconnect, network identification, the wallet-network-mismatch indicator, and
  the public `/status/0` page with live Testnet data and no wallet connected.
  After the indexer fix the settlement-history panel on `/status/0` was also
  verified rendering the real settlement row. Record:
  `evidence/phase-23-verification-2026-09-29.md` Part B.
- The mismatch indicator is a warning only; it does not block a transaction.
- **Public hosted frontend:** https://slasettle-web.vercel.app (Testnet
  configuration; no indexer, so two panels show "indexer not configured").
  Verified over HTTPS and in a browser on 2026-09-29: landing, dashboard and
  status pages load, the network badge reads Testnet, the SLA configuration and
  bond balance are read live, no secret is in the client bundle. Connecting
  Freighter on this hosted origin was not tested.
- **Signed dashboard writes** (create, top-up, cancel, withdraw) through the UI
  remain UNVERIFIED. **Narrow-viewport and mobile checks** remain UNVERIFIED.

## 8. Documentation

- A VitePress documentation site is in `apps/docs` (source Markdown, built with
  `pnpm --filter @slasettle/docs run build`, which passes on 2026-09-29).
  Start at `apps/docs/index.md`, `introduction.md`, `how-it-works.md`,
  `contracts.md`, `testnet-deployment.md`, `deployment-topology.md`,
  `limitations.md`.
- A desktop visual review of the site (14 pages, light and dark themes,
  search, navigation) was performed on 2026-09-29.
- Mobile and narrow-viewport review remains UNVERIFIED.
- The site is hosted at https://slasettle-docs.vercel.app (Vercel, deployed
  2026-09-29 from hub `8773628`); home page, search, navigation and the contract
  and Testnet deployment pages were verified. It is not built in CI and is
  redeployed by hand.

## 9. API and SDK

Indexer (`indexer/`, Node with SQLite; run locally, not hosted):
`GET /v1/health`, `GET /v1/watchers`, `GET /v1/slas/:slaId/current-round`,
`GET /v1/slas/:slaId/settlements` (query `limit` and `before`),
`GET /v1/providers/:address/slas`, `GET /v1/clock`. Settlement history uses
cursor pagination over `(ledger_close_time, event_id)`; `limit` defaults to 20,
is capped at 100, and a negative or fractional value returns HTTP 400. CORS is
an explicit environment-driven origin allowlist. Amounts are strings. The API
has no authentication and binds all interfaces. Reference: `apps/docs/api.md`.

SDK (`packages/sdk`, TypeScript, not published): read functions `getSla`,
`getBondBalance`, `isRoundSettled` (vault) and `getRoundTally`,
`hasWatcherVoted`, `isWatcher`, `getWatcherCount` (registry), plus token
`decimals` and `symbol`, all through Soroban RPC simulation; unsigned
transaction builders `buildCreateSlaTx`, `buildTopUpBondTx`,
`buildTriggerSettlementTx`, `buildCancelSlaTx`, `buildWithdrawBondTx`. It never
signs and holds no secret key. It does not wrap vault `initialize`, `pause`,
`unpause` or registry `initialize`, `register_watcher`, `remove_watcher`,
`pause`, `unpause`, `submit_check` (admin and watcher operations, by design).
It maps no contract error to a name; a failed call surfaces the RPC's message.

## 10. Security

- An **internal security review** was completed (`vault:evidence/security-review-2026-09-28.md`,
  2026-09-28). There is **no independent third-party audit**; nothing in either
  repository claims one.
- **Secret scanning** is manual: a pattern scan over both repositories' history
  found nothing; the dedicated scanner build did not complete, so no
  dedicated-scanner result exists.
- **Dependency scans (2026-09-28, not re-run):** `cargo audit`, one warning
  (`paste` unmaintained, transitive through soroban-sdk); `pnpm audit --prod`,
  none; `npm audit --omit=dev` (indexer), none; `govulncheck` (watcher), 25
  findings, all in the Go standard library and fixed in later 1.25.x patch
  releases (the local toolchain is 1.25.1; CI uses the current patch).
- **Vulnerability reporting:** private vulnerability reporting is disabled on
  both repositories and no security contact exists; both `SECURITY.md` files
  say to open a public issue asking for a private channel.
- **Watcher key handling:** `WATCHER_SECRET_KEY` is read once from the process
  environment and never logged; `watcher/.env` is gitignored. The frontend and
  SDK never hold a key.
- **Signatures:** the contracts call `require_auth`; since 2026-09-29 local
  tests show that a missing or wrong signature is rejected for the methods
  listed in `evidence/index.md` row AJ. No live wrongly-signed call was recorded.
- **Network mismatch** in the frontend is visual only.
- This project is not described as audited or security-certified.

## 11. Testing

Run 2026-09-29 (`evidence/final-technical-audit-2026-09-29-r2.md`):

| Suite | Result |
|---|---|
| vault `cargo test --workspace` | 52/52 (34 sla_vault, 18 watcher_registry) |
| SDK | 29/29 |
| web | 50/50 |
| indexer | 45/45 |
| watcher | 48/48 (`go test`) |
| hub `pnpm lint`, `typecheck`, `build`; indexer build; watcher `go build`, `go vet`; docs build; vault `stellar contract build` | pass |
| vault `cargo fmt --check` | fails, 9 diffs (pre-existing drift; informational in CI) |
| vault `cargo clippy` | 2 known warnings |

CI on GitHub for the heads before this pack's own commit: vault `caae637` run
`36591677083`, job `check, test, build`, success; hub `8773628` run
`36591669274`, jobs `web and sdk`, `indexer`, `watcher`, success.

What these counts do not show: most contract tests run under
`mock_all_auths()` (a separate group checks signatures); the payout cap has a
local test but no live execution; the frontend's signed write flow, the
network indicator and the watcher's `main.go` have no automated tests. See
sections 12 and 13.

## 12. Known limitations (current)

- No commit-reveal: a late watcher can see earlier votes (vault issue #4).
- `uptime_target_bps` is display-only.
- One shared watcher set for every SLA; watchers are admin-registered.
- No continuously hosted watcher; one daemon process serves one SLA.
- No hosted indexer; the hosted frontend and documentation are on a personal Vercel account, not Git-connected, deployed by hand.
- The indexer API is unauthenticated and binds all interfaces.
- A repeat `cancel_sla` succeeds and emits another `SlaCancelled` event; no
  funds move.
- `quorum_threshold` is not bounded by the number of registered watchers (a
  threshold above it can never be reached).
- A removed watcher's earlier votes still count in the tally.
- The indexer may make one RPC read per settlement row whose quorum is not
  cached yet.
- The watcher has no explicit per-round submission deadline and no in-round
  retry.
- CI action references are pinned by tag, not commit SHA, and the workflows
  declare no `permissions:` block (the repository default is read-only).
- The status page triggers settlement for the current round only.
- Live SDK mismatch (27.0.6 versus 28.0.0), the live zero-balance withdrawal
  difference, unreproducible WASM hashes across toolchains, and the frozen
  stale on-chain spec comments (section 4).
- Source-level instance-lifetime policy is unresolved; live lifetimes need
  manual maintenance (section 4).
- The SDK, frontend and watcher have no archived-entry restore handling.
- Testnet-only explorer link in the indexer; no license file (hub #10, vault #2).

## 13. Unverified items

- Signed dashboard writes through the UI.
- Narrow-viewport and mobile verification of the documentation site (and the app).
- A dedicated secret-scanning tool run.
- A live wrongly-signed call rejection.
- A live below-quorum settlement rejection.
- A live unregistered-watcher rejection.
- Live payout-cap execution (the one live settlement paid the full penalty from
  a larger bond).
- A second live page of settlement pagination.
- Daemon-to-indexer round read-back.
- The archived-entry restore path.

## 14. Blocked items

- Live verification of the zero-balance withdrawal rejection: it needs a
  redeployment of the current source.
- Redeploying the soroban-sdk 28.0.0 source.
- A permanent source-level instance-lifetime fix, which also needs a contract
  build and redeployment.

These need a deliberate source and toolchain decision, a fresh build and
deployment, fresh Testnet evidence, updated hashes and updated records. They
are tracked in vault issue #3 and classified in
`evidence/findings-classification-2026-09-29.md`; none was done or forgotten.

## 15. Open issues and planned work

Read from GitHub on 2026-09-29; none was closed or modified in this phase.

| Repo | # | Title | Kind |
|---|---|---|---|
| hub | 10 | LICENSE: no authoritative license exists | limitation |
| hub | 11 | watcher: daemon run live on 2026-09-29; indexer read-back criterion still open | future work (one open criterion: the indexer route reflecting a daemon vote) |
| hub | 12 | frontend: finish real-browser verification (signed writes, app themes, reduced motion, mobile) | future work (connection and status page already verified) |
| hub | 13 | frontend: network mismatch should block submission, not just warn | limitation |
| hub | 14 | watcher: local Go toolchain is behind on stdlib security patches | maintenance |
| hub | 15 | Backlog from the 2026-09-29 final audit (non-blocking) | future work (live evidence gaps and hardening) |
| hub | PR 8 | chore(deps-dev): bump eslint from 9.39.5 to 10.11.0 | compatibility; open, CI failing on its head, untouched |
| vault | 2 | LICENSE: no authoritative license exists | limitation |
| vault | 3 | Deployment/source parity: live contracts predate the soroban-sdk 28.0.0 bump | compatibility (redeployment decision) |
| vault | 4 | watcher_registry: add commit-reveal to prevent last-mover vote copying | future work |

## 16. Release

There is currently **no release** and no tag on either repository. Release URL:
not currently released.

## 17. Demo

Demo verification pending Phase 33. No demo video or URL exists.

## 18. Repository status

- Default branch `main`, protected on both repositories: pull request required
  (0 required approvals), required checks equal the CI job names
  (`check, test, build` for the vault; `web and sdk (build, lint, typecheck,
  test)`, `indexer (build, test)`, `watcher (build, vet, test)` for the hub),
  force pushes and deletions disabled, not enforced for administrators.
- GitHub repository Website fields: hub = https://slasettle-web.vercel.app, vault = https://slasettle-docs.vercel.app; both READMEs carry a CI badge (the hub README also carries docs and app badges).
- Dependabot is configured on both (cargo or npm and gomod, and
  github-actions, weekly).
- Heads when this pack was prepared: hub `8773628`, vault `caae637`; the pack's
  own commit follows. Working trees are clean apart from untracked local files
  that are not committed (a local indexer database directory in the hub, local
  environment and test-snapshot files in the vault).
- The commit history contains no Claude or Anthropic attribution.

## 19. Reviewer entry path

1. `README.md` (hub): what it is, layout, current status, limitations.
2. `vault:README.md`: the contracts, deployed IDs, source-versus-deployed
   warning.
3. `vault:SLASettle-contract-spec.md`: interface, authorization, events, errors,
   round IDs.
4. `apps/docs/`: the documentation source.
5. `evidence/index.md`: the claim ledger with sources and statuses.
6. `vault:evidence/testnet-2026-09-27.md` and `apps/docs/testnet-deployment.md`:
   the Testnet deployment and lifetime evidence.
7. `evidence/parity-matrix-2026-09-29.md`: contract, SDK, watcher, indexer,
   frontend and docs compared field by field.
8. `evidence/claim-traceability-2026-09-29.md`: 80 claims traced to code, test,
   live evidence and documentation.
9. `evidence/final-technical-audit-2026-09-29.md`, `…-r2.md` and
   `evidence/findings-classification-2026-09-29.md`: the audit, its
   re-verification and how every finding is classified.
10. `evidence/external-review-2026-09-29.md`: an outsider's review and answers to
    34 reviewer questions.

## 20. Evidence map

| Claim | Strongest evidence |
|---|---|
| Contracts are deployed on Testnet at the IDs in section 3 | on-chain WASM fetch and hash, 2026-09-29; `vault:evidence/testnet-2026-09-27.md` |
| Quorum settlement is permissionless and pays the beneficiary | tx `6522d8b7…`; local test `test_trigger_settlement_needs_no_signature_and_no_role_from_its_caller` |
| Duplicate votes and settlements are rejected | live rejected simulations `#4`; local tests |
| Cancellation and withdrawal work | txs `25fb9d95…`, `f2d1be37…` |
| A real watcher daemon can submit live votes | four txs, section 6; `evidence/phase-23-verification-2026-09-29.md` |
| Event shapes match the indexer | eight kinds decoded from live events, `evidence/parity-matrix-2026-09-29.md` section 4 |
| The SDK decodes live contract state | `evidence/parity-matrix-2026-09-29.md` section 0.4 |
| The frontend connects to Freighter and the status page works | `evidence/phase-23-verification-2026-09-29.md` Part B |
| Current source differs from the deployed contracts as stated | `evidence/final-technical-audit-2026-09-29.md` section 2 |
| Missing signatures are rejected (local) | vault tests, `evidence/index.md` row AJ |
| The indexer and watcher are not hosted, and nothing is released or audited | GitHub API reads, 2026-09-29; `apps/docs/deployment-topology.md`; both `SECURITY.md` |

## 21. Submission truth statement

**Exists:** two Soroban contracts and their tests and specification; a Go
watcher, a Node indexer, a TypeScript SDK, a Next.js frontend and a VitePress
documentation source; dated evidence records, an audit, and a classification of
every finding; CI, Dependabot and protected `main` on both repositories.

**Live:** the two contracts on Stellar Testnet, deployed 2026-09-27 with the
hashes in section 3, and their lifetimes extended by hand on 2026-09-29.

**Verified:** live settlement, duplicate prevention, cancellation, withdrawal,
pause behavior, all eight event shapes, four live daemon rounds, SDK reads,
the indexer routes on live data, and Freighter connection with the public status
page in a real browser.

**Hosted:** the frontend (without an indexer) and the documentation on Vercel.
**Local-only:** the indexer, database and watcher run from source on a developer
machine; no release or demo exists.

**Unverified:** section 13. **Blocked:** section 14. **Known limitations:**
section 12. The current source and the live contracts differ as described in
section 4.
