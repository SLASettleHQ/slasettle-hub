# SLASettle Submission Pack

Prepared 2026-09-29 and realigned on 2026-10-06 with the Protocol 28
deployment of 2026-10-01. State described here is hub `60e7929` and vault
`6fa5ad6` (both `main`), before the consistency commits of 2026-10-06 that
include this pack. Every number, hash and status below is taken from a record
in the repositories or from a check whose date is given; the records are named
in each section. Evidence is split into **current** (the 2026-10-01 Protocol 28
deployment) and **historical** (the 2026-09-27 and 2026-09-29 verification of
older deployments). The repositories are in **submission freeze**: this pack
changes no source.

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
- **Status:** a Testnet prototype. It is not production-deployed on mainnet and not
  audited by a third party. The two contracts are deployed on Testnet (section 3); the
  indexer is deployed as a public service on Cloudflare Workers and D1; the
  frontend and the documentation are hosted on Vercel.
- **Public URLs:**
  - application: https://slasettle-web.vercel.app (Testnet; SLA data read live via SDK and hosted indexer);
  - indexer API: https://slasettle-indexer.slasettle-indexer.workers.dev (Cloudflare Workers + D1);
  - documentation: https://slasettle-docs.vercel.app. Both frontend and docs are on a personal
  Vercel account.


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

**Current evidence.** The current deployment is the Protocol 28 deployment of
2026-10-01, built with soroban-sdk 28.0.0 and stellar-cli 28.1.0 (record:
`vault:evidence/testnet-2026-10-01.md`). Contract pages:
[`watcher_registry`](https://stellar.expert/explorer/testnet/contract/CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF)
and [`sla_vault`](https://stellar.expert/explorer/testnet/contract/CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN).

| Contract | Contract ID | WASM SHA-256 | WASM upload tx | Create tx | Init tx |
|---|---|---|---|---|---|
| `watcher_registry` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | `5478788ea6c6ae46ddb85c399015139d3b883b7c253dd9abe50e096bf0bcdfb5` | [`40d728b6…`](https://stellar.expert/explorer/testnet/tx/40d728b69f8854275ed68394465f1c1e8de7f1dcaad7b1d3fbc60551e4ce4616) | [`ca6c382c…`](https://stellar.expert/explorer/testnet/tx/ca6c382cc1d551419ecbfcfe1ee8c90b3e34fbb1e51b7e356ddce4521d28959a) | [`f16ff6ef…`](https://stellar.expert/explorer/testnet/tx/f16ff6ef3effe24bbe73f948a6f5d874c693a1772e5170690ebf029a5860c677) |
| `sla_vault` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | `e177a76f3888575c3c9666689ab905e25a1b3001fb4d85045d05ee43fa298bcd` | [`1687043e…`](https://stellar.expert/explorer/testnet/tx/1687043e0d89c9180f0446b13e26b3bcbec0634e07ac41b367869458e0d4bf0b) | [`cc134bb4…`](https://stellar.expert/explorer/testnet/tx/cc134bb4aa560ff13bf60c429d6e7e62f8bc53aa2882f1131ecddcbe3c3be8e2) | [`38cf9f59…`](https://stellar.expert/explorer/testnet/tx/38cf9f59e772f55d3c91984a43e0aa0a4b2c2866e0958ad1fdc8732779296c7a) |

- RPC: `https://soroban-testnet.stellar.org`. Admin and deployer:
  `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`. Five watchers
  were registered by the admin (registration transactions are listed in the
  October 1 evidence).
- **Checked 2026-10-06:** the WASM of both contracts was fetched from Testnet
  with `stellar contract fetch` and its SHA-256 equals the hashes above.

**Historical evidence, superseded.** Earlier Testnet deployments are kept as
history only. They are not evidence for the current deployment:

- 2026-09-27 pair (soroban-sdk 27.0.6, stellar-cli 27.0.0):
  `watcher_registry` `CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`
  (WASM `4c626d2c62e6f9b56b271e1a19798d2530c355b16724ff4e53c1e6ac6a3e4c6e`) and
  `sla_vault` `CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL`
  (WASM `6909713244bf5837954b8d584343e2136bd7570a10da8db7b30533e613b67830`).
  Record: `vault:evidence/testnet-2026-09-27.md`, which carries a notice saying
  so. Whether these contracts are still live was not re-checked.
- An earlier pair, `watcher_registry`
  `CBEZ3XBIWK2AWYGZRNDGNZG3AZTJHFMQL5HVWTEUZZ5HLSCO4QDFJB77` and `sla_vault`
  `CBA4DFNUBVCPLEAUD5O2CHSUB6DRWUNM7A537EBVPAGDETFBB2CABXI2`, predates the
  `quorum_threshold == 0` fix. Whether it is still live was not re-checked.

## 4. Deployment and source status

Stated directly:

- The current contracts were **built and deployed with soroban-sdk 28.0.0** and
  **stellar-cli 28.1.0** on 2026-10-01. Current vault source also uses
  soroban-sdk 28.0.0, and the fetched on-chain WASM hashes equal the hashes
  recorded for that deployment (section 3). Source and deployment parity is
  established for the current pair.
- The `quorum_threshold == 0` rejection is live on the current pair (rejected
  with error `#7`), and so is the zero-balance rejection in
  `withdraw_remaining_bond` (a repeat withdrawal on an emptied bond was
  rejected with `#7`). Source: `vault:evidence/testnet-2026-10-01.md`.
- **TTL:** current source never extends instance storage, and extends a
  persistent entry only when it writes it. The hand extensions recorded on
  2026-09-29 (`apps/docs/testnet-deployment.md`) were made on the superseded
  2026-09-27 pair. No extension of the current pair is recorded in this
  repository, so its live lifetimes need to be checked and extended by hand
  when needed.
- The 2026-09-27 and 2026-09-29 verification records in sections 6 and 7
  describe the superseded pair and are historical.

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

### 6a. Current evidence: Protocol 28 deployment, 2026-10-01

Source: `vault:evidence/testnet-2026-10-01.md`. Explorer form:
`https://stellar.expert/explorer/testnet/tx/<hash>`.

| Purpose | Transaction | Result |
|---|---|---|
| Quorum-zero rejection | (rejected call, no hash) | `create_sla` with `quorum_threshold` 0 failed with `#7` (InvalidAmount) |
| `create_sla` (SLA 0) | `84c7626116ec6a26a4c79a40a94263c060bb677b92470ae80a3465f9fc994591` | SLA created |
| `top_up_bond` (SLA 0) | `9ac7a137a8dde586574b4d8b589bf580f10ef0f3fa8747287e1ba27fea0ec244` | bond topped up |
| Three Down votes, round 123 | `29388269dafac7b55998e76e8d2c183b72b2131eb972a1707bd599c3c46b0421`, `af94d8ced4cddeca2e55b71248b6757f7e4dca8014bb5a42d1bfae54b215e009`, `278ffdc5d41cd49809ea7d86f94a2bc52f874677537144ce7937b1445dccd697` | quorum reached |
| `trigger_settlement` | `70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b` | settlement paid |
| Duplicate settlement | (rejected call, no hash) | failed with `#4` (AlreadySettled) |
| `create_sla` (SLA 1), `cancel_sla`, `withdraw_remaining_bond` | `91b6bc65ff299a1c823ba470829293a732bbcb16e1560b7c9617976991492eb6`, `ca52984cababecc9ca27318bddbfeb9b8941e2faba1d6a203f39108875f07187`, `9270fb2f858eabaa7e8e9f706b9e8abab158ebe0783fec88ffdb72252aac335f` | cancellation, then withdrawal |
| Repeat withdrawal on a zero balance | (rejected call, no hash) | failed with `#7` (InvalidAmount) |
| Vault pause / unpause | `9c470a3b83448f96283254b21b95bfe21e7b9063037bde4d195f4e377b496e5b` / `d7321224da8487cd8c1f40345b22ecf0a31305aca58314e513fbac68e184cfda` | pause and unpause confirmed |

The October 1 evidence does not record a registry pause test, a payout-cap
run, event decoding, or a watcher daemon run on the current pair.

### 6b. Historical evidence: superseded 2026-09-27 pair

This evidence belongs to the older deployment (section 3) and is **not**
evidence for the current one. Source: `vault:evidence/testnet-2026-09-27.md`
unless stated.

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

Also verified live on the superseded pair (details and dates in
`evidence/index.md` and the parity matrix): all eight event kinds observed on real transactions and re-decoded on
2026-09-29; the SDK's read functions against the live contracts; all six
indexer routes against live data from a locally run indexer, and the settlement
history fix (a route that returned HTTP 500 until 2026-09-29, then returned the
real SLA 0 settlement row); the frontend in a real browser with a real Freighter
extension (section 7). The only daemon run was these four rounds, against the superseded pair;
none has been run against the current pair, and nothing runs a watcher
continuously.

## 7. Frontend

- Source: `apps/web` (Next.js 16, React 19). It is run locally with the
  repository's scripts.
- Browser-verified on 2026-09-29 with a real Freighter extension and the live
  Testnet deployment of that date (the superseded pair; not repeated against the
  current pair): wallet connect, address display, disconnect and
  reconnect, network identification, the wallet-network-mismatch indicator, and
  the public `/status/0` page with live Testnet data and no wallet connected.
  After the indexer fix the settlement-history panel on `/status/0` was also
  verified rendering the real settlement row. Record:
  `evidence/phase-23-verification-2026-09-29.md` Part B.
- The mismatch indicator warns, and since hub #13 the write actions and the
  transaction layer also block when the wallet is on another network. This is
  unit-tested with a mocked wallet and not yet verified in a real browser.
- **Public hosted frontend:** https://slasettle-web.vercel.app (Testnet
  configuration; as of 2026-10-07 its bundle contains the hosted indexer URL, which
  came from a code fallback removed in hub #21, so a rebuild needs
  `NEXT_PUBLIC_INDEXER_API_URL` set).
  **On 2026-10-06 its deployed JavaScript bundle contains the superseded
  2026-09-27 contract IDs (`CBKAQETJ…`, `CD4FSW2E…`), not the current
  Protocol 28 pair.** The hosted app has not been redeployed against the
  current pair. Verified over HTTPS and in a browser on 2026-09-29, against the
  superseded pair: landing, dashboard and
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

Indexer (`indexer/`, Cloudflare Workers with Cloudflare D1 in production, or Node with SQLite locally):
`GET /v1/health`, `GET /v1/watchers`, `GET /v1/slas/:slaId/current-round`,
`GET /v1/slas/:slaId/settlements` (query `limit` and `before`),
`GET /v1/providers/:address/slas`, `GET /v1/clock`. Settlement history uses
cursor pagination over `(ledger_close_time, event_id)`; `limit` defaults to 20,
is capped at 100, and a negative or fractional value returns HTTP 400. CORS is
an explicit environment-driven origin allowlist. Amounts are strings. The API
has no authentication. Reference: `apps/docs/api.md` and `indexer/README.md`.


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
- **Dependency scans (2026-09-28, except where stated):** `cargo audit`, one warning
  (`paste` unmaintained, transitive through soroban-sdk); `pnpm audit --prod`,
  none; `npm audit --omit=dev` (indexer), none; `govulncheck` (watcher), 25
  findings on 2026-09-28, all in the Go standard library. `watcher/go.mod` now
  requests toolchain `go1.25.14`, and `govulncheck ./...` reported 0
  vulnerabilities on 2026-10-01 (`evidence/final-technical-audit-2026-09-29.md`).
  The other scans were not re-run.
- **Vulnerability reporting:** private vulnerability reporting is disabled on
  both repositories and no security contact exists; both `SECURITY.md` files
  say to open a public issue asking for a private channel.
- **Watcher key handling:** `WATCHER_SECRET_KEY` is read once from the process
  environment and never logged; `watcher/.env` is gitignored. The frontend and
  SDK never hold a key.
- **Signatures:** the contracts call `require_auth`; since 2026-09-29 local
  tests show that a missing or wrong signature is rejected for the methods
  listed in `evidence/index.md` row AJ. No live wrongly-signed call was recorded.
- **Network mismatch** in the frontend blocks writes (unit-tested, not yet
  browser-verified).
- This project is not described as audited or security-certified.

## 11. Testing

Run 2026-10-06 on hub `60e7929` and vault `6fa5ad6`, plus the cleanup commits
that change only documentation and ignore files:

| Suite | Result |
|---|---|
| vault `cargo check --workspace` | pass |
| vault `cargo test --workspace` | 52/52 (34 sla_vault, 18 watcher_registry) |
| vault `stellar contract build` | pass; the rebuilt WASM SHA-256 values equal the deployed hashes in section 3 |
| SDK | 29/29 |
| web | 50/50 |
| indexer | 45/45 |
| watcher | 48/48 top-level tests (`go test`; 58 including subtests); `cmd/watcher` has no test files |
| hub `pnpm install --frozen-lockfile`, `build`, `lint`, `typecheck`; indexer `npm ci` and build; watcher `go build`, `go vet`; docs build | pass |
| vault `cargo fmt --check` | fails (pre-existing drift; informational in CI) |
| vault `cargo clippy` | pre-existing style warnings; CI does not deny warnings |

The formatting drift and clippy warnings are left as they are during submission
freeze. No contract source was changed by the 2026-10-06 cleanup.

CI on GitHub: see the final status recorded in the cleanup report; the
repositories' Actions pages show every run.

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
- The indexer is hosted (Cloudflare Workers and D1) but browser access to it, including CORS from the deployed origin, is not yet verified; the hosted frontend and documentation are on a personal Vercel account, not Git-connected, deployed by hand.
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
- Source-level instance-lifetime policy is unresolved; live lifetimes need
  manual maintenance (section 4).
- The SDK, frontend and watcher have no archived-entry restore handling.
- Testnet-only explorer link in the indexer.
- The network-mismatch block (hub #13) is unit-tested only, not yet verified in
  a real browser with Freighter.
- The hosted frontend still reads the superseded 2026-09-27 contract pair
  (section 7).
- No independent security audit.

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
- On the current 2026-10-01 pair: a registry pause test, event decoding, a live
  watcher daemon run, an indexer run, a payout-cap run, and a frontend browser
  check. The hosted frontend also still points at the superseded pair.
- The archived-entry restore path.

## 14. Blocked items

- A permanent source-level instance-lifetime fix.

This requires a contract build and redeployment, which is out of scope during
submission freeze. It is classified in
`evidence/findings-classification-2026-09-29.md`; no open issue tracks it.

## 15. Open issues and planned work

Read from GitHub on 2026-10-06. Remaining runway:

| Repo | # | Title | Kind |
|---|---|---|---|
| hub | 12 | frontend: finish real-browser verification (signed writes, app themes, reduced motion, mobile) | future work |
| hub | 15 | Backlog from the 2026-09-29 final audit (non-blocking) | future work (remaining evidence gaps and hardening) |
| vault | 4 | watcher_registry: add commit-reveal to prevent last-mover vote copying | future work |

Resolved since the first version of this pack and closed on GitHub on
2026-10-06 (not current work): hub #11 (watcher daemon to indexer read-back pipeline verified live on Testnet and closed), hub #10 and vault #2 (MIT license added), hub #14
(Go toolchain 1.25.14 requested, `govulncheck` 0 vulnerabilities on
2026-10-01), vault #3 (the 2026-10-01 deployment restored source and deployment
parity). Hub #13 (network mismatch blocks writes) is implemented and
unit-tested; its real-browser check stays under hub #12. Dependabot PR hub #8 (ESLint 10) is closed and not merged; the project
intentionally stays on ESLint 9.x and does not claim ESLint 10 support.

## 16. Release

Both repositories have a public `v0.1.0` release, "v0.1.0: Protocol 28 Ready",
published 2026-10-01:

- https://github.com/SLASettleHQ/slasettle-hub/releases/tag/v0.1.0
- https://github.com/SLASettleHQ/slasettle-vault/releases/tag/v0.1.0

Both are Testnet-only and unaudited. The tags were not moved or recreated.

## 17. Demo

The required final submission demo video is not yet complete. No demo video or
URL exists.

## 18. Repository status

- Default branch `main`, protected on both repositories: pull request required
  (0 required approvals), required checks equal the CI job names
  (`check, test, build` for the vault; `web and sdk (build, lint, typecheck,
  test)`, `indexer (build, test)`, `watcher (build, vet, test)` for the hub),
  force pushes and deletions disabled, not enforced for administrators.
- GitHub repository Website fields: hub = https://slasettle-web.vercel.app, vault = https://slasettle-docs.vercel.app; both READMEs carry a CI badge (the hub README also carries docs and app badges).
- Dependabot is configured on both (cargo or npm and gomod, and
  github-actions, weekly).
- Both repositories are MIT licensed and recognized as such by GitHub.
- Heads described here: hub `60e7929`, vault `6fa5ad6`; the 2026-10-06
  consistency commits follow. Local runtime data in the hub (`indexer/data/`)
  and local environment and test-snapshot files in the vault are gitignored
  and not committed.
- Repository history was reviewed for unintended attribution trailers.

## 19. Reviewer entry path

1. `README.md` (hub): what it is, layout, current status, limitations.
2. `vault:README.md`: the contracts, current deployed IDs and hashes, and
   which evidence files are current or historical.
3. `vault:SLASettle-contract-spec.md`: interface, authorization, events, errors,
   round IDs.
4. `apps/docs/`: the documentation source.
5. `evidence/index.md`: the claim ledger with sources and statuses.
6. `vault:evidence/testnet-2026-10-01.md` (current deployment) and
   `vault:evidence/testnet-2026-09-27.md` (historical, superseded deployment),
   with `apps/docs/testnet-deployment.md`.
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

Rows marked current rest on the 2026-10-01 deployment. Rows marked historical
rest on the superseded 2026-09-27 pair and its 2026-09-29 verification.

| Claim | Strongest evidence | Status |
|---|---|---|
| Contracts are deployed on Testnet at the IDs in section 3 | on-chain WASM fetch and SHA-256, 2026-10-06; `vault:evidence/testnet-2026-10-01.md` | current |
| Source and deployment parity | same hashes as the 2026-10-01 record, section 4 | current |
| Quorum settlement pays the beneficiary and a duplicate is rejected | txs `70395bae…` and `#4` rejection, `vault:evidence/testnet-2026-10-01.md` | current |
| Quorum of zero is rejected at `create_sla` | `#7` rejection, same record | current |
| Cancellation, withdrawal and repeat-withdrawal rejection | txs `ca52984c…`, `9270fb2f…`, `#7` rejection, same record | current |
| Vault pause and unpause | txs `9c470a3b…`, `d7321224…`, same record | current |
| Settlement is permissionless | tx `6522d8b7…`; local test `test_trigger_settlement_needs_no_signature_and_no_role_from_its_caller` | historical (live), local test current |
| A real watcher daemon can submit live votes | four txs, section 6b; `evidence/phase-23-verification-2026-09-29.md` | historical |
| Event shapes match the indexer | eight kinds decoded from live events, `evidence/parity-matrix-2026-09-29.md` section 4 | historical |
| The SDK decodes live contract state | `evidence/parity-matrix-2026-09-29.md` section 0.4 | historical |
| The frontend connects to Freighter and the status page works | `evidence/phase-23-verification-2026-09-29.md` Part B | historical |
| Missing signatures are rejected (local) | vault tests, `evidence/index.md` row AJ | current (local) |
| The watcher is not hosted, the indexer is hosted with browser access unverified, and no independent audit exists | GitHub reads; `apps/docs/deployment-topology.md`; both `SECURITY.md` | current |

## 21. Submission truth statement

**Exists:** two Soroban contracts and their tests and specification; a Go
watcher, a Node indexer, a TypeScript SDK, a Next.js frontend and a VitePress
documentation source; dated evidence records, an audit, and a classification of
every finding; CI, Dependabot and protected `main` on both repositories.

**Live (current):** the two contracts on Stellar Testnet, deployed 2026-10-01
with soroban-sdk 28.0.0 and stellar-cli 28.1.0 at the IDs and WASM hashes in
section 3. Both on-chain hashes were re-checked on 2026-10-06 and equal the
hashes recorded for that deployment.

**Verified on the current deployment:** quorum-zero rejection, SLA creation,
top-up, three down votes, settlement, duplicate settlement rejection,
cancellation, withdrawal, repeat zero-balance withdrawal rejection, and vault
pause and unpause.

**Verified on the superseded 2026-09-27 pair only (historical):** registry pause
behavior, all eight event shapes, four live daemon rounds, SDK reads, the
indexer routes on live data, and Freighter connection with the public status
page in a real browser. This was not repeated on the current pair.

**Hosted:** the frontend (still reading the superseded contract pair) and the
documentation on Vercel, and the indexer on Cloudflare Workers with D1 (checked
with `curl` on 2026-10-07; browser access not yet verified). **Local-only:** the
watcher runs from source on a developer machine. **Released:** both
repositories have a public Testnet-only `v0.1.0`, unaudited. **Demo:** the
required final submission demo video is not yet complete.

**Unverified:** section 13. **Blocked:** section 14. **Known limitations:**
section 12. Current source and the current live contracts have matching WASM
hashes (section 4).
