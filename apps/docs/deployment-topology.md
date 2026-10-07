# Deployment topology

What exists, and where it runs. Dated statements below are from 2026-09-29
unless noted; the contract entries describe the current 2026-10-01 deployment. This page describes only
what the repositories and the evidence show; it does not describe hosting,
infrastructure or operators that do not exist. Every arrow in the diagram
below was read from code, and the last section lists where.

Each component is in exactly one of four categories:

- **CURRENTLY DEPLOYED**: running somewhere that persists without anyone
  starting it.
- **LOCALLY RUN**: exists as code that someone runs by hand on their own
  machine. Where it has been run for real, the dated evidence is named.
- **OPTIONAL**: not needed to read or verify anything on-chain.
- **NOT DEPLOYED**: does not exist anywhere.

| Component | Category |
|---|---|
| `watcher_registry` contract | CURRENTLY DEPLOYED (Stellar Testnet) |
| `sla_vault` contract | CURRENTLY DEPLOYED (Stellar Testnet) |
| Stellar Testnet RPC | external service, not operated by this project |
| Native XLM token contract (Testnet SAC) | external, part of the Stellar network |
| Watcher daemon | LOCALLY RUN, OPTIONAL. Run live on 2026-09-29 and 2026-10-06; no continuous deployment |
| Indexer | CURRENTLY DEPLOYED on Cloudflare Workers; also LOCALLY RUN |
| Database | Cloudflare D1 (production); SQLite (local dev) |
| Frontend (`apps/web`) | CURRENTLY DEPLOYED on Vercel; also LOCALLY RUN |
| SDK (`packages/sdk`) | library; runs inside whatever imports it |
| User's browser | runs the frontend's JavaScript |
| Freighter | external browser extension |
| Documentation site (`apps/docs`) | CURRENTLY DEPLOYED on Vercel (2026-09-29) |
| Permanent 24/7 watcher daemon | NOT DEPLOYED |

## What is deployed, and what has only been run

- **Two Soroban contracts, on Stellar Testnet only.** See
  [Current Testnet deployment](/testnet-deployment) for IDs, hashes and
  evidence. Source and deployment parity holds for the current 2026-10-01
  pair. Nothing is on Stellar mainnet.
- **The watcher daemon has been run live, for verification, and is not
  continuously deployed.** On 2026-09-29 the real `watcher` process ran on
  one developer machine against live Testnet RPC and the then-live
  `watcher_registry` of the superseded 2026-09-27 pair for four consecutive
  rounds, using a disposable
  account registered for the purpose and removed afterward. Each
  submission was confirmed on-chain. That is **VERIFIED**. See
  `evidence/phase-23-verification-2026-09-29.md`, Part C. Earlier votes, on
  2026-09-27 (`slasettle-vault/evidence/testnet-2026-09-27.md`), were
  submitted directly with the Stellar CLI, not by the daemon. No watcher
  process runs today or continuously anywhere, and no one operates a
  standing watcher set; the five registered watcher addresses are accounts
  used for evidence. "The daemon can submit live votes" is **VERIFIED**;
  "the daemon is deployed as a service" is **NOT DEPLOYED**.
- **The indexer is deployed as a public service on Cloudflare Workers**,
  operating at `https://slasettle-indexer.slasettle-indexer.workers.dev` and backed
  by a Cloudflare D1 database with scheduled cron ingestion (`* * * * *`, every minute).
  It can also be run locally with SQLite as documented in `indexer/README.md`.

## Not deployed anywhere

- **No permanent 24/7 watcher daemon service.** The watcher daemon has been verified
  live on Testnet in multiple test passes (most recently on 2026-10-06 with complete
  on-chain submission, indexer ingestion, and readback verified), but no standing daemon
  runs continuously.
- **No managed dedicated database cluster, load balancer, or secrets manager.**
- **No permanent watcher service.**
- **No automatic deployment pipeline.** The two Vercel deployments below
  were made by hand with the Vercel CLI on 2026-09-29; the Vercel projects are
  not connected to the GitHub repositories, so a push does not redeploy. The
  hub's CI does not build the documentation site. Each repository has one workflow,
  `ci.yml` (build, lint, typecheck and test only), plus GitHub's
  Dependabot. For the hub, the GitHub API showed no Pages site, no
  deployments, no environments, no releases and no homepage before the
  2026-09-29 publishing pass; the vault returned no Pages site and no
  deployments, and the same two workflows.

### Hosted on Vercel (2026-09-29)

| Surface | URL | Deployed from | Configuration |
|---|---|---|---|
| Documentation | https://slasettle-docs.vercel.app | the hub commit recorded in `evidence/final-technical-audit-2026-09-29-r3.md`, first deployed 2026-09-29T15:15Z and redeployed after the documentation changes | `apps/docs/vercel.json`; Vercel root directory `apps/docs` |
| Frontend | https://slasettle-web.vercel.app | hub `main` at `0c1e107`, uploaded with the Vercel CLI (not Git-connected), deployment `dpl_3GiQGWRH4t59vp55cSkZD5obLQUF`, built with the cache bypassed, created 2026-10-07T11:33Z | `apps/web/vercel.json`; root directory `apps/web`; Production environment variables set explicitly for the Testnet RPC, passphrase, the two current contract IDs and `NEXT_PUBLIC_INDEXER_API_URL` (the hosted Cloudflare indexer) |

Both run on a personal Vercel account (`*.vercel.app` addresses, Hobby plan), not
a project-owned domain. The frontend deployment was checked over HTTPS and in a
browser: the landing page, dashboard and status page load, the network badge
reads Testnet, the SLA configuration and bond balance are read live from
Testnet, the four public values are inlined, no secret appears in the client
bundle, and the two indexer-dependent panels show the "indexer not configured"
message. (That describes the 2026-09-29 check; wallet connection and signed
writes on the hosted origin were verified on 2026-10-07, see
`evidence/phase7-live-write-verification-2026-10-07.md`.)

## The picture

```text
                      user's machine
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                    │
 │   browser ──loads──► apps/web (Next.js, localhost:3000)            │
 │      │                                                             │
 │      ├──signs via───► Freighter extension                          │
 │      ├──fetch───────► indexer HTTP API (localhost:8787)            │
 │      └──JSON-RPC────► Stellar Testnet RPC   (SDK, in the browser)  │
 │                                                                    │
 │   indexer ──getEvents, getLatestLedger, get_sla──► Testnet RPC     │
 │      └──reads/writes──► SQLite file (indexer/data/indexer.db)      │
 │                                                                    │
 │   watcher (optional) ──HTTP GET──► TARGET_URL                      │
 │      └──simulate, send, poll──► Testnet RPC ──► watcher_registry   │
 │                                                                    │
 └──────────────────────────────────────────────────────────────────┘
                                   │
                          Stellar Testnet
   sla_vault ──get_round_tally──► watcher_registry
   sla_vault ──transfer──────────► token contract (native XLM SAC)
```

The frontend's Next.js server only serves the app. Every call to the
indexer and to the Soroban RPC is made by the **browser**, because the
hooks that make them are client code (`"use client"`, for example
`lib/use-round-status.ts` and `lib/use-sla-config.ts`) and the SDK runs
inside that bundle. That is why the indexer sets CORS (`ALLOWED_ORIGINS`)
and why the SDK is configured with `NEXT_PUBLIC_*` variables.

## Components

Each block lists the repository and root, runtime, build and start
commands, environment variables, what depends on it, what it depends on,
and its boundaries. Variable classes are BUILD-TIME, RUNTIME, PUBLIC and
SECRET; the per-variable tables are in
[Environment variables](/environment-variables) and in
`evidence/parity-matrix-2026-09-29.md`, section 8.

### `watcher_registry` contract

- **Repository / root:** `slasettle-vault`, `contracts/watcher_registry`.
- **Runtime:** Soroban WASM on Stellar Testnet. Deployed 2026-10-01,
  `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF`, built with
  soroban-sdk 28.0.0 and stellar-cli 28.1.0. No lifetime extension of this
  contract is recorded; the source does not extend instance storage itself, so
  it needs maintenance (see [Limitations](/limitations)). The hand extensions
  of 2026-09-29 were made on the superseded 2026-09-27 pair.
- **Build:** `stellar contract build` (it must be built before `sla_vault`).
  **Start:** none; it is on-chain.
- **Environment variables:** none. Deployment is done with the Stellar CLI
  and an admin identity that is not in either repository.
- **Inbound:** the watcher daemon (`has_watcher_voted`, `submit_check`), the
  SDK and frontend (reads), the indexer (events), `sla_vault`
  (`get_round_tally`), and the admin (registration, pause).
- **Outbound:** none.
- **Public/private boundary:** everything stored and every event is public.
  The admin address is the only privileged role.
- **Wallet/secret boundary:** admin and watcher keys sign with their own
  tools; no key is in the contract or the repositories.

### `sla_vault` contract

- **Repository / root:** `slasettle-vault`, `contracts/sla_vault`.
- **Runtime:** Soroban WASM on Stellar Testnet. Deployed 2026-10-01,
  `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN`, built with
  soroban-sdk 28.0.0 and stellar-cli 28.1.0. Same lifetime maintenance note as
  `watcher_registry`.
- **Build:** `stellar contract build` (it needs `watcher_registry.wasm`
  built first, because of `contractimport!`). **Start:** none.
- **Environment variables:** none.
- **Inbound:** the SDK and frontend (reads and unsigned transactions), the
  indexer (events and one `get_sla` read), and any account
  (`trigger_settlement` is permissionless).
- **Outbound:** `watcher_registry.get_round_tally`; the token contract's
  `transfer` in `create_sla`, `top_up_bond`, `trigger_settlement` and
  `withdraw_remaining_bond`.
- **Boundaries:** bonds are held by the contract address on-chain; a
  provider's signature (Freighter, in the frontend flow) authorizes their
  own bond movements; no signature is needed to trigger a settlement.

### Watcher daemon

- **Category:** LOCALLY RUN, OPTIONAL. One live verification on
  2026-09-29; nothing runs it continuously.
- **Repository / root:** `slasettle-hub`, `watcher/` (a separate Go
  module).
- **Runtime:** Go 1.25 (`go.mod`, toolchain 1.25.14; verified with 1.25.1 and 1.25.14). One process per
  `SLA_ID`.
- **Build:** `go build ./cmd/watcher`. **Start:**
  `go run ./cmd/watcher`, or the built binary, with the variables exported.
  The daemon has no `.env` loader.
- **Environment variables (all RUNTIME):** `WATCHER_REGISTRY_CONTRACT_ID`,
  `TARGET_URL`, `SLA_ID`, `RPC_URL`, `NETWORK_PASSPHRASE`,
  `ROUND_LENGTH_SECONDS`, `HTTP_TIMEOUT_SECONDS` and
  `HTTP_EXPECT_MAX_STATUS` are PUBLIC; `WATCHER_SECRET_KEY` is **SECRET**.
- **Inbound:** none. It listens on no port.
- **Outbound:** an HTTP `GET` to `TARGET_URL` each round; Soroban RPC for
  account loading, simulation, submission and polling. It calls only
  `watcher_registry` (`has_watcher_voted`, `submit_check`).
- **Network path:** process to the Testnet RPC over HTTPS; the RPC relays to
  the network.
- **Public/private boundary:** the target URL it checks is hashed into
  `endpoint_hash`, which travels as a transaction argument (public in
  transaction history; the contract does not store it); the URL is not sent.
- **Secret boundary:** `WATCHER_SECRET_KEY` lives in the process
  environment and is the only place in the hub where a secret key is held.
  It is read once, never logged, and `watcher/.env` is gitignored. Its
  address must be registered by the contract admin before votes count.
- **Database / wallet:** none / none (it signs directly with its own key).

### Indexer

- **Category:** LOCALLY RUN, OPTIONAL.
- **Repository / root:** `slasettle-hub`, `indexer/` (a separate npm
  project with its own lockfile).
- **Runtime:** Node (`engines` `>=22`; the repository pins 24.21.0 in
  `.nvmrc`).
- **Build:** `npm ci && npm run build`. **Start:** `npm start`, which runs
  `node --env-file=.env dist/index.js` and so loads `indexer/.env`;
  `npm run dev` (`tsx watch`) does not load `.env`.
- **Environment variables (all RUNTIME, none SECRET):** the two contract
  IDs (required), `RPC_URL`, `NETWORK_PASSPHRASE`, `DB_PATH`, `HTTP_PORT`,
  `POLL_INTERVAL_MS`, `MAX_LEDGERS_PER_REQUEST`, `ROUND_LENGTH_SECONDS`,
  `START_LEDGER`, `ALLOWED_ORIGINS` and `LOG_LEVEL`, all PUBLIC.
- **Inbound:** HTTP from browsers and any client on `HTTP_PORT` (default
  `8787`). It calls `app.listen(port)` without a host, so it is not bound to
  localhost only. The API has no authentication; CORS restricts which
  browser origins may read it, not who may connect.
- **Outbound:** Soroban RPC (`getEvents`, `getLatestLedger`, and a
  `simulateTransaction` of `get_sla` for `quorum_threshold`); its local
  SQLite file.
- **Public/private boundary:** everything it serves is derived from public
  on-chain events.
- **Secret / wallet boundary:** none; it never holds a key.

### SQLite database

- **Category:** LOCALLY RUN. A file, not a service.
- **Where:** `DB_PATH`, default `./data/indexer.db` relative to the
  indexer's working directory (WAL mode, so `-wal` and `-shm` files sit
  beside it). Opened by a single indexer process with `better-sqlite3`; it
  is not designed for several writers.
- **Nature:** a derived cache. The contracts are authoritative. If the file
  is lost, the indexer rebuilds it from the RPC, but only as far back as
  the RPC retains events (the code assumes roughly seven days); older event
  history cannot be recovered from RPC alone.
- **Git:** `*.db` is ignored; the `data/` directory and the `-wal`/`-shm`
  files are not, so keep them out of commits by hand.

### Frontend (`apps/web`)

- **Category:** CURRENTLY DEPLOYED on Vercel without an indexer (see above); also run locally.
- **Repository / root:** `slasettle-hub`, `apps/web` (Next.js 16.3.6, React
  19.3.0), in the root pnpm workspace with `packages/sdk`.
- **Build:** `pnpm run build` from the root (builds the SDK, then web).
  **Start:** `pnpm dev` from the root or
  `pnpm --filter @slasettle/web dev`; `pnpm --filter @slasettle/web start`
  after a build. Default port `3000`.
- **Environment variables (BUILD-TIME, PUBLIC):**
  `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_NETWORK_PASSPHRASE`,
  `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID`,
  `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID`,
  `NEXT_PUBLIC_INDEXER_API_URL`. Next.js inlines `NEXT_PUBLIC_*` values into
  the client bundle, so they are visible to anyone who loads the page and
  changing one means rebuilding (or restarting the dev server). None is a
  secret. Values live in `apps/web/.env.local`, which is gitignored.
- **Inbound:** the user's browser.
- **Outbound at build time:** Google Fonts, through `next/font/google`
  (Geist) in `app/layout.tsx`.
- **Outbound at run time, from the browser:** the indexer API, the Soroban
  RPC (through the SDK) and Freighter. The Next.js server makes none of
  these calls for the pages that were checked.
- **Wallet boundary:** the frontend and SDK never hold a key; every write is
  an unsigned transaction handed to Freighter (`lib/wallet.ts`).
- **Verified:** wallet connect, disconnect, reconnect, network display, the
  mismatch indicator and the public status page, in a real browser with a
  real Freighter on 2026-09-29. The dashboard write forms (create, top-up,
  cancel, withdraw) through a signed transaction were **VERIFIED** live on
  2026-10-07; a frontend-driven settlement was not exercised (no genuine
  quorum round existed).

### SDK (`packages/sdk`)

- **Category:** a library, not a process. Not published anywhere.
- **Root:** `slasettle-hub/packages/sdk`. **Build:**
  `pnpm --filter @slasettle/sdk build` (emits `dist/`, which `apps/web`
  consumes through the workspace protocol). **Start:** none.
- **Environment variables:** the first four `NEXT_PUBLIC_*` values above,
  read when a function is called (`getSdkConfig`); the SDK does not read
  the indexer URL.
- **Outbound:** Soroban RPC only: `simulateTransaction` for reads,
  `getAccount` and `prepareTransaction` for write builders. It also reads
  the token contract's `decimals` and `symbol`.
- **Boundaries:** it imports no signing code and accepts no secret key.

### User's browser and Freighter

- **Browser:** runs the frontend, the SDK and every call to the indexer and
  RPC. Stores only a theme preference locally (`localStorage`).
- **Freighter:** an external extension. It holds the user's key, prompts
  for each signature, and reports the wallet's network. It is not part of
  this project. The frontend talks to it through `@stellar/freighter-api`.
  Connection, display and network detection are **VERIFIED**
  (2026-09-29); signing dashboard writes (create, top-up, cancel, withdraw) is
  **VERIFIED** (2026-10-07).

### Stellar Testnet RPC

- **Category:** external, at `https://soroban-testnet.stellar.org`. Not
  operated by this project. Reachable and reporting the Testnet
  passphrase on 2026-09-29.
- **Used by:** the indexer, the watcher, and the SDK in the browser.
- **Boundary:** public. Nothing secret is sent to it except signed
  transactions.
- **Retention:** the indexer assumes about seven days of event history; that
  figure is in the indexer's code and README and was not re-checked against
  the provider.

### Documentation site (`apps/docs`)

- **Category:** CURRENTLY DEPLOYED on Vercel (see above). Not built in CI.
- **Runtime:** VitePress 1.6.4. **Build:**
  `pnpm --filter @slasettle/docs run build`. **Start:**
  `pnpm --filter @slasettle/docs run dev` (or `preview` after a build).
- **Environment variables:** none.
- **Boundaries:** static content only; no keys and no calls beyond the
  browser loading the site. Desktop review was done on 2026-09-29; the
  narrow-viewport review is **UNVERIFIED**.

## Secrets, wallets and data, in one place

- **Secret boundary.** The only secret in the hub is `WATCHER_SECRET_KEY`,
  in the watcher process's environment (and, locally, a gitignored
  `watcher/.env`). The indexer, the SDK, the frontend and the documentation
  site hold no secret. Contract admin keys live in the Stellar CLI's local
  identity store, outside both repositories.
- **Wallet boundary.** Provider actions are signed in Freighter inside the
  user's browser. The watcher signs only its own `submit_check`.
  `trigger_settlement` needs no role beyond paying its own fee.
- **Database locality.** One SQLite file on the machine running the
  indexer. Nothing in this project replicates or backs it up.
- **Public versus private.** Contract state, events, the indexer's API
  output and every `NEXT_PUBLIC_*` value are public. Private: the watcher
  key and the admin keys.

## Where each arrow comes from

| Arrow | Source |
|---|---|
| browser to frontend | `apps/web` (Next.js) |
| browser to Freighter | `apps/web/lib/wallet.ts` |
| browser to indexer | `apps/web/lib/indexer.ts` (`fetch` to `NEXT_PUBLIC_INDEXER_API_URL`) |
| browser to RPC | `packages/sdk/src/client.ts` (`rpc.Server`), called from client hooks |
| indexer to RPC | `indexer/src/rpc/client.ts`, `api/ledgerInfo.ts`, `rpc/liveReads.ts` |
| indexer to SQLite | `indexer/src/db/db.ts` (`better-sqlite3`, `DB_PATH`) |
| watcher to target | `watcher/internal/health/health.go` |
| watcher to RPC and registry | `watcher/internal/contract/contract.go` |
| `sla_vault` to `watcher_registry` | `sla_vault/src/lib.rs` (`get_round_tally`) |
| `sla_vault` to token | `sla_vault/src/lib.rs` (`token::Client::transfer`) |
| SDK to token | `packages/sdk/src/token.ts` (`decimals`, `symbol`) |

## If this were to go beyond a single machine

That would need decisions this project has not made and this page does not
make for it: where the indexer's SQLite file would live and how it would be
backed up, how `WATCHER_SECRET_KEY` would be held other than in a local
environment, who would run a standing watcher set, where the frontend and
indexer would be hosted, and how the documentation would be published. None
of that exists today; see [Limitations](/limitations).
