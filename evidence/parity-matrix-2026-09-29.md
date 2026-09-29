# Cross-repository parity matrix, 2026-09-29

Phase 24. This audits `SLASettleHQ/slasettle-vault` (the two contracts) and
`SLASettleHQ/slasettle-hub` (SDK, watcher, indexer, frontend, docs site) as one
system, by comparing source, not by asking whether each builds.

- **Audited baselines:** vault `8449bd7`, hub `85e4f10` (hub `main` at the
  start of the batch). Fixes made by this audit are in the vault commit
  `c7eef75` and the hub commits that follow `85e4f10`; nothing below was
  reconciled silently.
- **Not touched:** deployed contracts, `soroban-sdk` versions, hub PR #8,
  licensing, releases, hosting.
- **Status vocabulary:** `VERIFIED`, `TESTED LOCALLY`, `LOGICALLY COVERED`,
  `UNVERIFIED`, `KNOWN LIMITATION`, `BLOCKED`, as defined in the hub's
  `CONTRIBUTING.md`.
- **Mismatch classes**, written in the `Match?` column: *real defect*, *stale
  documentation*, *intentional difference*, *historical evidence*, *known
  limitation*, *blocked/unverified*. A row that matches says `MATCH`.
- **Source quality order used for every row:** live Testnet evidence, then
  current source, then deterministic test output, then CI output, then
  documentation. Documentation is never used to prove implementation.
- **Dates:** every "checked" date is 2026-09-29. Evidence that was gathered
  earlier keeps its own date (2026-09-27 contract evidence, 2026-09-28
  recovery and security review, 2026-09-29 Phase 23 verification).

## 0. Live and local checks run for this audit (2026-09-29)

Everything here was read-only against Testnet. No transaction was sent, no
contract was changed, and no evidence below was taken from memory.

| # | Check | Result |
|---|---|---|
| 0.1 | `stellar contract fetch` of both live contracts, then `sha256sum` | `sla_vault` `6909713244bf5837954b8d584343e2136bd7570a10da8db7b30533e613b67830`, `watcher_registry` `4c626d2c62e6f9b56b271e1a19798d2530c355b16724ff4e53c1e6ac6a3e4c6e`. Both equal the hashes in `slasettle-vault/evidence/testnet-2026-09-27.md`. |
| 0.2 | `stellar contract info interface --output json-formatted` on the live WASM versus on a fresh local build of vault `8449bd7` (`stellar contract build`, soroban-sdk 28.0.0) | Functions, structs, enums, errors and events identical. The only difference is that the live spec also lists the private `DataKey` union for each contract; the 28.0.0 build omits it. |
| 0.3 | `stellar contract invoke --send=no` reads on the live contracts | `get_watcher_count` = `5`; `get_sla(0)` = provider `GBWM5N2S…`, token `CDLZFC3S…`, bond `50000000`, `uptime_target_bps` `9990`, quorum `3`, penalty `10000000`, beneficiary `GBAKUA3A…`, status `Active`; `get_bond_balance(0)` = `46000000`; `is_round_settled(0,1)` = `true`. |
| 0.4 | `@slasettle/sdk` (built `dist/`) run against live Testnet with the live IDs | `getSla(0n)` decoded all 8 fields (bigints for `bondAmount`/`penaltyPerBreach`, `status: "Active"`); `getSla(1n).status` = `"Cancelled"`, `getBondBalance(1n)` = `0n`; `getBondBalance(0n)` = `46000000n`; `isRoundSettled(0n,1n)` = `true`, `(0n,2n)` = `false`; `getRoundTally(0n,1n)` = `{votesUp:0, votesDown:3}`; `getRoundTally(999n,1n)` = `{votesUp:2, votesDown:1}`; `hasWatcherVoted(0n,1n,watcher1)` = `true`; `isWatcher(watcher1)` = `true`; `getWatcherCount()` = `5`; `getTokenSymbol`/`getTokenDecimals` of the native SAC = `native` / `7`; `getSla(999n)` threw `SorobanSimulationError` whose `rpcMessage` starts `HostError: Error(Contract, #9)`. |
| 0.5 | `getEvents` on `sla_vault` from ledger 4905650 through the indexer's own `SorobanEventClient`, `decodeEvent` and `classifyEvents` | 9 events: `sla_created` ×3, `bond_topped_up` ×2, `settlement_paid` ×1, `sla_cancelled` ×1, `bond_withdrawn` ×2. Classified into 3 SLA rows and 1 settlement row; the other kinds are recognized and not persisted. Details in section 4. |
| 0.6 | Same on `watcher_registry` from ledger 4905580 | `watcher_registered` ×7, `check_submitted` ×10, `watcher_removed` ×2. Classified into 9 watcher events and 10 check rows (6 `up`, 4 `down`). Cross-check against the evidence records: 5 registrations + the watcher5 re-registration + the Phase 23 disposable watcher = 7; watcher5 removal + the Phase 23 disposable removal = 2; 6 votes from 2026-09-27 + 4 daemon votes from 2026-09-29 = 10; 4 `down` are watcher2 on SLA 999 plus the three SLA 0 votes, and the 4 daemon votes are `up`. |
| 0.7 | A fresh indexer process (`node dist/index.js`, empty database in the scratchpad, port 8791, `START_LEDGER=4905580`) against live Testnet, then `curl` of all six routes | Shapes recorded in section 10. Process stopped afterward; the repository's own `indexer/data/` was not touched. |
| 0.8 | `curl` `getNetwork` on `https://soroban-testnet.stellar.org` | `passphrase: "Test SDF Network ; September 2015"`. |
| 0.9 | Branch-protection API for both repositories, read with the repository owner's credentials | Both `main` branches: PR required, 0 required approvals, force pushes and deletions disabled, `enforce_admins` off. Required checks are exactly the CI job names listed in section 12. |
| 0.10 | GitHub Actions logs for vault run `36486254192` (commit `8449bd7`) | Job `check, test, build` succeeded; `cargo test` 29 + 17 passed; `sla_vault.wasm` `Wasm Hash: 2f958b86a2ca24fdbfc7f12536d2b8ce2160b5dcedb81b5c84c83fb80da5d42d` with rustc 1.98.1. |
| 0.11 | Local builds and tests, hub `85e4f10` and vault `8449bd7` | Hub: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `build` pass; SDK 29/29, web 50/50; indexer `npm test` 36/36, `npm run build` passes; watcher `go build`, `go vet` pass, `go test` 48 pass; docs build passes. Vault: `stellar contract build` passes; `cargo check` passes; `cargo test` 29 + 17 = 46 pass; `cargo fmt --check` fails (known drift, informational in CI); `cargo clippy` has 2 known warnings. A local `sla_vault.wasm` built with rustc 1.97.1 hashes to `5a5ee41b…`, which is not the CI hash `2f958b86…` for the same source, so WASM hashes are not reproducible across toolchains. |

## 1. Contract interfaces

Source of truth: `slasettle-vault/contracts/*/src/lib.rs` and `storage.rs`.
"Hub" means the SDK (`packages/sdk/src`), the Go watcher
(`watcher/internal/contract/contract.go`), the frontend (`apps/web`), the
indexer, and `apps/docs/contracts.md`. Unless a row says otherwise the
documentation columns of `apps/docs/contracts.md` and
`SLASettle-contract-spec.md` list the same method, argument order, types and
authorization as the source.

### 1.1 `watcher_registry`

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `initialize(admin: Address) -> Result<(), Error>` | State-changing. `admin.require_auth()`. `AlreadyInitialized` (#2) if `DataKey::Admin` is set. `lib.rs:33`. | No hub code calls it; deployment is by CLI (vault `README.md` "Deploying"). Docs list it correctly. | MATCH | VERIFIED | `evidence/testnet-2026-09-27.md` "watcher_registry initialization": init tx `7a51b818…`, second call rejected `#2`. |
| `register_watcher(caller, watcher: Address)` | State-changing. Admin via `require_admin`. Already-registered is a no-op, count not doubled. Emits `watcher_registered` only for a new watcher. `lib.rs:49`. | No caller in hub code. The indexer consumes the event (section 4). | MATCH | VERIFIED | Five registrations `e1958d64…`, `a85db64c…`, `8e08a99c…`, `e4efb9ae…`, `33ad2cc0…` plus re-registration `38b3026c…` (2026-09-27); disposable watcher `a9b53ca2…` (Phase 23, 2026-09-29). Event count re-derived in 0.6. |
| `remove_watcher(caller, watcher: Address)` | State-changing. Admin. Not-registered is a no-op. Emits `watcher_removed` only if it was registered. `lib.rs:80`. | No caller in hub code. | MATCH | VERIFIED | `f739bb0b…` (2026-09-27); `b6e129ca…` (Phase 23 cleanup). |
| `is_watcher(watcher: Address) -> bool` | Read-only. `lib.rs:105`. | SDK `isWatcher(watcher: string)` (`watcher-registry.ts:61`) encodes an address and requires a `boolean`. Not called by `apps/web`. | MATCH | VERIFIED | Check 0.4 (`isWatcher(watcher1)` = `true`); `watcher-registry.test.ts`. |
| `get_watcher_count() -> u32` | Read-only. `lib.rs:110`. | SDK `getWatcherCount()` (`watcher-registry.ts:75`) requires a `number`. Not called by `apps/web`. | MATCH | VERIFIED | Check 0.4 and 0.3 (`5`). |
| `pause(caller)` / `unpause(caller)` | State-changing, admin. Blocks `submit_check` only. `lib.rs:120,127`. | No hub caller. | MATCH | VERIFIED | Pause `b7836cf9…`, rejected vote `#5`, unpause `463ecb6a…` (2026-09-27). |
| `submit_check(watcher, sla_id: u64, round_id: u64, endpoint_hash: BytesN<32>, status: CheckStatus) -> Result<(), Error>` | State-changing. `watcher.require_auth()`. Errors `ContractPaused` #5, `NotAWatcher` #3, `DuplicateCheck` #4, checked in that order. `lib.rs:161`. | Go `Client.SubmitCheck` (`contract.go:127`) builds the args in exactly this order: account address, `ScvU64`, `ScvU64`, `ScvBytes` of 32 bytes (SHA-256 of `TARGET_URL`), status as `ScvVec[ScvSymbol("Up"\|"Down")]`. No SDK or frontend wrapper. | MATCH. The missing SDK wrapper is an *intentional difference*: `packages/sdk/src/types.ts` states the frontend never votes. | VERIFIED | Daemon run 2026-09-29, four consecutive rounds: `fd8de724…`, `ccc7fabb…`, `563bd176…`, `fb8b4462…` (`phase-23-verification-2026-09-29.md` Part C); the four extra `check_submitted` events were re-read in 0.6. |
| `get_round_tally(sla_id: u64, round_id: u64) -> RoundTally { votes_up: u32, votes_down: u32 }` | Read-only. Zeros when nothing was submitted. `lib.rs:229`. | SDK `decodeRoundTally` requires `votes_up`/`votes_down` and maps to `votesUp`/`votesDown` (`watcher-registry.ts`). Used by `apps/web/lib/use-round-status.ts`. `sla_vault` calls it through `contractimport!`. | MATCH | VERIFIED | Check 0.4; `trigger_settlement` on the live vault succeeded only via this call (`testnet-2026-09-27.md`). |
| `has_watcher_voted(sla_id, round_id, watcher) -> bool` | Read-only. `lib.rs:237`. | SDK `hasWatcherVoted` (`watcher-registry.ts:37`) and Go `HasVoted` (`contract.go:103`) both send `(sla_id, round_id, watcher)`. Not called by `apps/web`. | MATCH | VERIFIED | Check 0.4; the Go daemon calls it before every submission (Phase 23 Part C). |

### 1.2 `sla_vault`

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `initialize(admin, watcher_registry: Address)` | State-changing, `admin.require_auth()`, one-time. `lib.rs:53`. | No hub caller. | MATCH | VERIFIED | Init tx `338c9ef1…`. The stored registry address could not be read directly; the link is proven functionally by the settlement (`testnet-2026-09-27.md`), which stays **UNVERIFIED by direct storage read**. |
| `create_sla(provider, token: Address, bond_amount: i128, uptime_target_bps: u32, quorum_threshold: u32, penalty_per_breach: i128, beneficiary: Address) -> Result<u64, Error>` | State-changing; `provider.require_auth()`; transfers `bond_amount` of `token`. Errors `ContractPaused` #8, `InvalidAmount` #7 (bond ≤ 0, penalty ≤ 0, penalty > bond, quorum = 0). `lib.rs:76`. | SDK `buildCreateSlaTx` (`sla-vault.ts:60`): same order, `i128` as bigint, `u32` as number, source account = provider. Used by `create-sla-form.tsx`. The returned `sla_id` is not consumed by hub code (the tx is unsigned). | MATCH | Contract: VERIFIED. SDK argument encoding: TESTED LOCALLY. A signed `create_sla` built by the UI: UNVERIFIED | `testnet-2026-09-27.md` "SLA 0"; `sla-vault.test.ts`. `end-user-guide.md` and `limitations.md` already state the dashboard write forms were not exercised in Phase 23. |
| `get_sla(sla_id: u64) -> Result<SLAConfig, Error>` | Read-only; `SlaNotFound` #9. `lib.rs:161`. | SDK `decodeSlaConfig` requires all eight keys (`provider`, `token`, `bond_amount`, `uptime_target_bps`, `quorum_threshold`, `penalty_per_breach`, `beneficiary`, `status`) and decodes `status` from a one-element vec. Indexer `fetchQuorumThreshold` reads only `quorum_threshold`. | MATCH | VERIFIED | Check 0.4 (both SLA 0 and SLA 1), check 0.7 (`quorum_threshold: 3` in the settlements response); Phase 23 browser check. |
| `get_bond_balance(sla_id) -> i128` | Read-only; `0` if absent. `lib.rs:169`. | SDK `getBondBalance` requires a `bigint`. | MATCH | VERIFIED | Check 0.4 (`46000000n`). |
| `top_up_bond(caller, sla_id: u64, amount: i128)` | State-changing; `caller.require_auth()` and `caller == provider`; no pause or status check. `lib.rs:178`. | SDK `buildTopUpBondTx` (`sla-vault.ts:82`): order and types match. Used by `top-up-bond-form.tsx`. | MATCH | Contract: VERIFIED. UI path: UNVERIFIED | `50d35d47…`, and `a852c1a9…` while paused (2026-09-27). |
| `trigger_settlement(caller, sla_id: u64, round_id: u64)` | State-changing; `caller` is never authorized; errors in order `SlaNotFound`, `SlaNotActive`, `AlreadySettled`, `QuorumNotMet`, `BondExhausted`. `lib.rs:220`. | SDK `buildTriggerSettlementTx` (`sla-vault.ts:100`): order matches. Used by `trigger-settlement-action.tsx`. | MATCH | Contract: VERIFIED. UI path: UNVERIFIED | `6522d8b7…`, called by `alice`, a non-admin non-provider non-beneficiary account; duplicate rejected `#4`. |
| `is_round_settled(sla_id, round_id) -> bool` | Read-only. `lib.rs:296`. | SDK `isRoundSettled` requires a `boolean`. Used by `use-round-status.ts`. | MATCH | VERIFIED | Check 0.4. |
| `cancel_sla(caller, sla_id)` | State-changing; caller must be provider; does not touch the balance. `lib.rs:308`. | SDK `buildCancelSlaTx` (`sla-vault.ts:119`). Used by `cancel-sla-action.tsx`. | MATCH | Contract: VERIFIED. UI path: UNVERIFIED | `25fb9d95…`. |
| `withdraw_remaining_bond(caller, sla_id)` | State-changing; caller must be provider; requires `Cancelled` (`SlaNotActive`). Current source also rejects a zero balance with `InvalidAmount`. `lib.rs:334`. | SDK `buildWithdrawBondTx` (`sla-vault.ts:131`). Used by `withdraw-bond-action.tsx`. | Interface: MATCH. **Behavior of the live contract versus current source: NO, known limitation.** The zero-balance rejection (`99be8a1`, 2026-09-28) was written after the 2026-09-27 deployment and is not on-chain. | Live behavior: VERIFIED (pre-fix). Zero-balance rejection: TESTED LOCALLY only | `f2d1be37…`; the pre-fix no-op `0dbbb2e8…` (event `amount: 0`, re-read in 0.5); `evidence/recovery-2026-09-28.md` Finding A: "not re-verified live". |
| `pause(caller)` / `unpause(caller)` | State-changing, admin. Gates `create_sla` only. `lib.rs:383,390`. | No hub caller. | MATCH | VERIFIED | `cf4b174a…`, rejected `create_sla` `#8`, `4d0f51ad…`. |

### 1.3 Cross-cutting interface rows

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Live interface versus current source | Source at `8449bd7`, soroban-sdk 28.0.0. | Live WASM built with soroban-sdk 27.0.6. | *Intentional difference* (tool version): spec identical except the live one lists the private `DataKey` union. | VERIFIED | Check 0.2. |
| Live behavior versus current source | Current source rejects a repeat zero-balance withdrawal. | Live contract does not. | *Known limitation* (undeployed fix). | VERIFIED live, TESTED LOCALLY | Row `withdraw_remaining_bond` above; section 6. |
| SDK coverage of contract methods | 11 vault methods, 10 registry methods. | SDK wraps 8 vault methods (no `initialize`, `pause`, `unpause`) and 4 registry methods (reads only). | *Intentional difference*: admin and watcher operations are CLI or daemon only. | LOGICALLY COVERED | `packages/sdk/src/index.ts`; `types.ts`. |
| SDK reads that `apps/web` never calls | n/a | `isWatcher`, `getWatcherCount`, `hasWatcherVoted` are exported and tested but unused by the frontend, which reads the watcher set from the indexer. | *Intentional difference* | VERIFIED (SDK behavior), n/a (frontend) | Check 0.4; `grep` of `apps/web` for the three names finds none. |
| Read-only versus state-changing calls | View functions are marked in section 1.1 and 1.2. | Reads use `simulateTransaction` only (`client.ts:119`). Writes are built with `prepareTransaction` (`client.ts:161`), returned unsigned, and signed by Freighter. The watcher signs only its own `submit_check`. | MATCH | LOGICALLY COVERED | `packages/sdk/src/client.ts`; `watcher/internal/contract/contract.go`. |
| Token contract calls | `sla_vault` calls the token's `transfer` in `create_sla`, `top_up_bond`, `trigger_settlement`, `withdraw_remaining_bond`. | SDK calls the token's `decimals()` and `symbol()` by simulation (`token.ts`). | MATCH | VERIFIED | Check 0.4 (`native`, `7`); `testnet-2026-09-27.md` balances. |

## 2. Status values

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `CheckStatus` | `enum { Up, Down }`; on the wire a one-element vec of the variant symbol (`["Up"]`). `watcher_registry/src/storage.rs`. | SDK `CHECK_STATUS_VARIANTS = ["Up","Down"]` (`types.ts`); Go `contract.StatusUp = "Up"`, `StatusDown = "Down"` encoded by `mustCheckStatusEnum` as `ScvVec[ScvSymbol]` (`contract.go:359`); indexer reads `data.status` as `["Up"]` and lowercases. | MATCH | VERIFIED | Daemon-submitted votes were accepted on-chain (Phase 23); re-decoded `{"round_id":"1n","status":["Up"]}` in 0.6. |
| `SLAStatus` | `enum { Active, Cancelled }`, same vec encoding. `sla_vault/src/storage.rs`. | SDK `SLA_STATUS_VARIANTS = ["Active","Cancelled"]` decoded by `decodeContractEnum`; frontend compares against `"Active"` (`status-view.tsx`, `sla-card.tsx`). | MATCH | VERIFIED | Check 0.4 (`"Active"`, `"Cancelled"`). |
| Casing across layers | PascalCase (`Up`, `Down`, `Active`, `Cancelled`). | Watcher's internal `health.Status` is lowercase `up`/`down` and is mapped to `Up`/`Down` in `cmd/watcher/main.go`. Indexer table `checks.status` has `CHECK (status IN ('up','down'))`. API and frontend types use `"up" \| "down"`. | *Intentional difference*: PascalCase on-chain and in the SDK, lowercase in the indexer database, API and frontend. Not normalized anywhere else. | LOGICALLY COVERED | `schema.sql`; `classify.ts`; `apps/web/lib/indexer.ts`. |
| Frontend-only `pending` | Not a contract value. | `WatcherCheckStatus = "up" \| "down" \| "pending"`; `pending` is derived from `not_yet_checked_in`, never sent by the API. | *Intentional difference* | LOGICALLY COVERED | `use-round-status.ts`; `watcher-status-row.tsx`. |
| Unknown status defaults to `up` | Contract has exactly two variants. | `classify.ts` stores `down` only when the lowercased symbol is `down` and `up` for anything else, so a future third variant would be recorded as `up`. | *Known limitation*: unreachable with the current contract, and it would need a code change to surface. | LOGICALLY COVERED | `indexer/src/ingest/classify.ts` (`checkSubmitted` case). Not changed by this audit. |

## 3. Error model

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `watcher_registry::Error` | `NotAuthorized=1`, `AlreadyInitialized=2`, `NotAWatcher=3`, `DuplicateCheck=4`, `ContractPaused=5` (`storage.rs`). | `apps/docs/contracts.md` table lists the same five. | MATCH | VERIFIED | Live rejections `#2`, `#4`, `#5` (`testnet-2026-09-27.md`); numbers and names match the source. |
| `sla_vault::Error` | `NotAuthorized=1`, `AlreadyInitialized=2`, `SlaNotActive=3`, `AlreadySettled=4`, `QuorumNotMet=5`, `BondExhausted=6`, `InvalidAmount=7`, `ContractPaused=8`, `SlaNotFound=9` (`storage.rs`). | `apps/docs/contracts.md` lists the same nine. | MATCH | VERIFIED for `#3`, `#4`, `#7`, `#8` (live rejections); `#9` re-observed in 0.4. `NotAuthorized`, `AlreadyInitialized`, `QuorumNotMet`, `BondExhausted` are TESTED LOCALLY only. | `testnet-2026-09-27.md`; `sla_vault/src/test.rs`. |
| Numbers collide across contracts | `#3`, `#4`, `#5` mean different things per contract. | Nothing in hub code maps numbers or names. | *Stale documentation* (the collision was undocumented), fixed | n/a | Spec section "Error codes are numbered per contract" added in vault `c7eef75`. |
| What off-chain code relies on | Error surfaces as `Error(Contract, #N)` inside a `HostError` string. | SDK: `SorobanSimulationError` carries the raw `rpcMessage`; nothing parses it. Frontend: `use-transaction.ts` shows `err.message` as-is. Watcher: logs the error and retries next round. Indexer: never sees a contract error (events and one `get_sla` read only). | MATCH (neither numeric codes nor names are relied on; the raw string is displayed or logged) | VERIFIED | Check 0.4 (`getSla(999n)` message begins `HostError: Error(Contract, #9)`); grep of `apps/web`, `packages/sdk`, `indexer/src`, `watcher` for every error name finds only docs and comments. |
| Uninitialized admin | `require_admin` returns `NotAuthorized` when no admin is stored (`watcher_registry/src/lib.rs:14`, `sla_vault/src/lib.rs:19`). | Not consumed. | MATCH | LOGICALLY COVERED | Source. |

## 4. Events

Topics are Soroban event topics (indexed); data is the event body
(non-indexed). Topic 0 is always the event's name as a snake_case symbol,
followed by the `#[topic]` fields in declaration order. Data is a map keyed
by field name; no data fields gives `{}`. Sources: `events.rs` in both
contracts; `indexer/src/rpc/decode.ts` (wire format), `classify.ts`,
`db/schema.sql`; `apps/docs/contracts.md`; `SLASettle-contract-spec.md`.

| Event | Contract topics / data | Indexer decoder and database | API output | Match? | Status | Evidence |
|---|---|---|---|---|---|---|
| `watcher_registered` | topics `[sym, watcher: Address]`; data `{}` | `topics[1]` → `watchers.address`, `registered_at` = ledger close time; re-registration clears `removed_at` | `GET /v1/watchers` | MATCH | VERIFIED | Re-decoded in 0.6 (7 events). |
| `watcher_removed` | topics `[sym, watcher]`; data `{}` | `topics[1]` → sets `watchers.removed_at` in event order | excluded from `GET /v1/watchers` | MATCH | VERIFIED | 0.6 (2 events); ordering fix in `recovery-2026-09-28.md` Finding B. |
| `check_submitted` | topics `[sym, sla_id: u64, watcher: Address]`; data `{round_id: u64, status: ["Up"\|"Down"]}` | `topics[1]`, `topics[2]`, `data.round_id`, `data.status` → `checks` row (ids as TEXT, status lowercased) | `current-round.checked_in`, vote counts in `settlements` | MATCH | VERIFIED | 0.6 (10 events, first decoded as topics `["check_submitted","999n",GA4WTX…]`, data `{"round_id":"1n","status":["Up"]}`). |
| `sla_created` | topics `[sym, sla_id: u64, provider: Address]`; data `{token, bond_amount: i128, beneficiary}` | `topics[1]`, `topics[2]`, `data.*` → `slas` row; `bond_amount_at_creation` kept as a string; `quorum_threshold` left `NULL` (not in the event) | `GET /v1/providers/:address/slas` | MATCH | VERIFIED | 0.5 (3 events → 3 rows). |
| `bond_topped_up` | topics `[sym, sla_id: u64]`; data `{amount: i128}` | Recognized, decoded, **not persisted** | none | MATCH | VERIFIED | Raw `["bond_topped_up","0n"]` / `{"amount":"5000000n"}` and `…"1000000n"` re-read in 0.5; original `50d35d47…`; second `a852c1a9…`. |
| `settlement_paid` | topics `[sym, sla_id: u64, round_id: u64]`; data `{payout: i128, beneficiary}` | `topics[1]`, `topics[2]`, `data.payout` → `settlements.penalty_amount` (string), `data.beneficiary` | `GET /v1/slas/:slaId/settlements` | MATCH | VERIFIED | 0.5 (1 event → 1 row); 0.7 response. |
| `sla_cancelled` | topics `[sym, sla_id: u64]`; data `{}` | Recognized, **not persisted** | none | MATCH | VERIFIED | Raw `["sla_cancelled","1n"]` / `{}` re-read in 0.5; original `25fb9d95…`. |
| `bond_withdrawn` | topics `[sym, sla_id: u64]`; data `{amount: i128}` | Recognized, **not persisted** | none | MATCH | VERIFIED | Raw `["bond_withdrawn","1n"]` with `{"amount":"20000000n"}` (`f2d1be37…`) and the pre-fix zero event `{"amount":"0n"}` (`0dbbb2e8…`) re-read in 0.5. |
| **The three events whose shape the vault spec called unconfirmed** | Vault `SLASettle-contract-spec.md` (before `c7eef75`) said `BondToppedUp`, `SlaCancelled`, `BondWithdrawn` had "not been independently confirmed against a real emitted event". | Hub `indexer/README.md` and `decode.ts` said the same; `TEST-MATRIX.md` rows say `UNVERIFIED`. | n/a | NO. **Stale documentation**, not a defect and not a conflict between two live claims. The 2026-09-27 evidence record captured raw topics and data for all three from real transactions, and this audit re-fetched them on 2026-09-29 and decoded them with the indexer's own code. The three shapes are exactly the ones assumed. | VERIFIED | `evidence/testnet-2026-09-27.md` ("Bond top-up", "SLA 1", "All observed events" table); check 0.5. Fixed in vault `c7eef75` (spec) and the hub commits (decoder comment, fixtures, indexer README). `TEST-MATRIX.md` keeps its rows as a labeled Phase 9 snapshot (section 12). |
| Persisted versus needed | n/a | Three events are not persisted because no endpoint needs them. | n/a | *Intentional difference* | LOGICALLY COVERED | `classify.ts` comment; `classify.test.ts` fixture for the three (corrected in this audit). |
| Event names in docs | `topics` tables list only the topics after topic 0. | Same convention in `apps/docs/contracts.md`. | n/a | *Stale documentation* (topic 0 was never stated), fixed | n/a | Note added to both `contracts.md` and the spec. |
| `caller` of `trigger_settlement` | Not stored and not in `SettlementPaid`. The source comment on `trigger_settlement` (`sla_vault/src/lib.rs:213`) still says "recorded only in the event". | Spec and `SECURITY.md` said "recorded for observability". | *Stale documentation*, fixed in the spec and `SECURITY.md`. The `lib.rs` doc comment is stale too; it was **left unchanged** because this audit must not alter contract source. | VERIFIED (the live event carries no `caller`, 0.5) | `events.rs` `SettlementPaid` fields; `sla_vault/src/lib.rs:213` versus `:282`. |

## 5. Network names and passphrases

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Testnet passphrase `Test SDF Network ; September 2015` | `evidence/testnet-2026-09-27.md`. | `indexer/src/config.ts`, `indexer/.env.example`, `watcher/internal/config/config.go`, `watcher/.env.example`, `apps/docs/environment-variables.md`, `apps/docs/testnet-deployment.md`, and test fixtures in `packages/sdk`, `apps/web`, `indexer`, `watcher`. The string is byte-identical in every occurrence. | MATCH | VERIFIED | `git grep` in both repositories; RPC `getNetwork` returned the same string (0.8). |
| RPC URL `https://soroban-testnet.stellar.org` | Evidence file. | Defaults in `indexer/src/config.ts` and `watcher/internal/config/config.go`, both `.env.example` files, docs. `apps/web` has no default and requires `NEXT_PUBLIC_SOROBAN_RPC_URL`. | MATCH | VERIFIED | 0.8. |
| Frontend network detection | n/a | `lib/network.ts` labels Public, Testnet, Futurenet, Sandbox, Standalone by passphrase; `network-indicator.tsx` compares the wallet's passphrase with `NEXT_PUBLIC_NETWORK_PASSPHRASE` and warns only. | MATCH with the documented limitation: the mismatch warning does not block a transaction. | VERIFIED (warning path exercised with a Futurenet passphrase) | Phase 23 Part B; `limitations.md`; hub issue #13. |
| Explorer URL | Evidence uses `stellar.expert/explorer/testnet`. | Frontend `explorerTxUrl` picks `public` or `testnet` from the passphrase; the indexer's `explorer_url` is hardcoded to `…/explorer/testnet/tx/…` (`routes.ts`). | *Known limitation*: the two would disagree on any network other than Testnet. Documented scope is Testnet only. | LOGICALLY COVERED | `apps/web/lib/network.ts`; `indexer/src/api/routes.ts`. Not changed. |
| Futurenet and Mainnet references | No mainnet deployment; `SECURITY.md`: "Testnet only". | `network.ts` knows the Futurenet and Public passphrases for labeling; docs say nothing is on mainnet. `apps/web/.env.example` says "e.g. a Testnet or Mainnet Soroban RPC provider", which is generic configuration wording, not a deployment claim. | *Intentional difference*. No document presents Testnet as production infrastructure. | LOGICALLY COVERED | `git grep -i "mainnet\|futurenet\|Public Global"` in both repositories. |
| Horizon | Vault evidence used `horizon-testnet.stellar.org` and stellar.expert for independent balance checks. | Not used by any hub code. | MATCH | n/a | `git grep -i horizon`. |

## 6. Deployment IDs

Current live deployment (2026-09-27) and historical deployment are kept
separate. Nothing here was redeployed.

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Current `watcher_registry` | `CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`, WASM `4c626d2c62e6f9b56b271e1a19798d2530c355b16724ff4e53c1e6ac6a3e4c6e`, ledger 4905584 (2026-09-27T23:25:07Z) | Same ID in `README.md`, `apps/docs/testnet-deployment.md`, the Phase 23 evidence, local `apps/web/.env.local` and `indexer/.env`. Same WASM hash in `testnet-deployment.md`. | MATCH | VERIFIED | Check 0.1: on-chain WASM SHA-256 equals the recorded hash. |
| Current `sla_vault` | `CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL`, WASM `6909713244bf5837954b8d584343e2136bd7570a10da8db7b30533e613b67830`, ledger 4905659 (2026-09-27T23:31:22Z) | Same ID and hash in the same places. `indexer/src/rpc/liveReads.test.ts` uses the ID as a fixture. | MATCH | VERIFIED | Check 0.1. |
| Deployment and init transactions | WASM upload `07e0a6a3…` / `1e19aa0d…`; create `da13eca3…` / `cc3494a1…`; init `7a51b818…` / `338c9ef1…` | The hub repeats none of them except `create_sla` `819dd540…` and `trigger_settlement` `6522d8b7…` in `testnet-deployment.md`. | MATCH | VERIFIED | Every 64-hex string and Stellar address in the hub's `README.md`, `apps/docs/api.md`, `economics.md`, `testnet-deployment.md` and `liveReads.test.ts` appears in the authoritative evidence records (scripted comparison, 2026-09-29). |
| Network of the deployment | Testnet. | Testnet everywhere. | MATCH | VERIFIED | Section 5. |
| SDK version used for deployment | soroban-sdk 27.0.6, Stellar CLI 27.0.0, Rust 1.97.1 (evidence file). | `testnet-deployment.md` and `limitations.md` state 27.0.6 versus 28.0.0. | MATCH. The mismatch itself is a *known limitation* (not resolved by design of this batch). | VERIFIED | `testnet-2026-09-27.md` "Network and toolchain"; vault `Cargo.toml` and README. |
| What the live build lacks versus `main` | `main` = soroban-sdk 28.0.0 plus zero-balance withdrawal rejection (`99be8a1`). | `testnet-deployment.md` said the zero-balance fix "was verified against a separate SLA (SLA 1) in the same evidence run". | NO. **Stale/incorrect documentation**: SLA 1 is where the *pre-fix* no-op was observed, and the fix post-dates the deployment. Fixed. | VERIFIED (contract state), TESTED LOCALLY (the fix) | `testnet-2026-09-27.md` "Real finding: repeat withdrawal…"; commit dates `99be8a1` (2026-09-28 20:24) versus deployment (2026-09-27 23:31Z). |
| Historical deployment | `watcher_registry` `CBEZ3XBIWK2AWYGZRNDGNZG3AZTJHFMQL5HVWTEUZZ5HLSCO4QDFJB77`, `sla_vault` `CBA4DFNUBVCPLEAUD5O2CHSUB6DRWUNM7A537EBVPAGDETFBB2CABXI2` (predates the quorum fix); tx `258c86d2…` (create) and `b1dc301a…` (settlement). | Kept and labeled historical in `testnet-deployment.md`; used as the "deployed" pair in the Phase 9 `TEST-MATRIX.md` section 5, and in comments and fixtures of `indexer/src/ingest/classify.test.ts`. | *Historical evidence*. Not conflated with the current pair. | Not re-checked (no claim depends on it) | `evidence/testnet-2026-09-27.md` "Historical deployment". |
| Local `.deployed-testnet.env` | Untracked file in the vault checkout holding the historical pair. | `testnet-deployment.md` called it "your local hub environment configuration". | *Stale documentation*: it belongs to the vault checkout, and it is untracked. Fixed. | VERIFIED | `git status` in the vault; file contents. |
| Local `.env` files | n/a | `apps/web/.env.local` and `indexer/.env` (gitignored) point at the current pair. `watcher/.env` (gitignored) holds the current registry ID, an empty `WATCHER_SECRET_KEY`. | MATCH | VERIFIED | Read locally; the secret variable was checked only for emptiness. |
| Current on-chain state versus README | README: "initialized, with 5 watchers registered". | Hub README repeats the IDs. | MATCH | VERIFIED | Checks 0.3 and 0.4. |
| CI-built hash versus README | README: current `main` builds `sla_vault.wasm` `2f958b86…`. | n/a | MATCH for CI. Not reproducible locally (`5a5ee41b…` with rustc 1.97.1; CI used rustc 1.98.1). *Known limitation.* | VERIFIED (CI log), UNVERIFIED (local reproduction) | Check 0.10 and 0.11. |

## 7. Transaction evidence

Every transaction below is public on Testnet and appears in the cited record.
The date is the date the evidence was gathered, not the date of this audit.

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Deploy and initialize (both contracts) | `07e0a6a3…`, `da13eca3…`, `7a51b818…`; `1e19aa0d…`, `cc3494a1…`, `338c9ef1…`. 2026-09-27. | n/a | MATCH | VERIFIED | `testnet-2026-09-27.md`; hashes re-verified on-chain in 0.1. |
| Watcher registration and removal | Five registrations, one removal (`f739bb0b…`), one re-registration (`38b3026c…`). 2026-09-27. Disposable watcher `GDVB6JFS…`: register `a9b53ca2…`, remove `b6e129ca…`. 2026-09-29. | `phase-23-verification-2026-09-29.md` Part C. | MATCH | VERIFIED | Event counts reconciled in 0.6. |
| Watcher voting | Six votes on 2026-09-27 (`d160961e…`, `6ef581c8…`, `9f50fed9…`, `a1982e81…`, `94eea09b…`, `c2b2e6f9…`). Daemon votes 2026-09-29: `fd8de724…`, `ccc7fabb…`, `563bd176…`, `fb8b4462…`. | Phase 23 Part C. | MATCH | VERIFIED | Ten `check_submitted` events on-chain (0.6). |
| Settlement | `6522d8b7…`, SLA 0 round 1, called by `alice`, payout `10000000`. 2026-09-27. | `testnet-deployment.md`, `economics.md`, `api.md` example, Phase 23 follow-up (settlements route returned this row). | MATCH | VERIFIED | 0.5, 0.7. |
| Cancellation and withdrawal | `25fb9d95…`, `f2d1be37…`. 2026-09-27. | Not repeated in hub docs. | MATCH | VERIFIED | 0.5. |
| Duplicate prevention | Vote `#4` (registry) and settlement `#4` (vault) as rejected simulations, not transactions. 2026-09-27. | Cited in `lifecycle.md`, `SECURITY.md`. | MATCH | VERIFIED | `testnet-2026-09-27.md`. Rejected simulations have no transaction hash. |
| Pause and unpause | Registry `b7836cf9…`/`463ecb6a…`; vault `cf4b174a…`/`4d0f51ad…`. 2026-09-27. | n/a | MATCH | VERIFIED | Same record. |
| Live-round evidence | SLA 0 round 1 (Down ×3). | Phase 23 rounds 29844195 to 29844198 (Up, one vote each) on SLA 0. | MATCH | VERIFIED | Phase 23 Part C; 0.6 shows four extra `up` votes. |
| Phase 23 round 29844195 attribution | n/a | The record notes the process was killed after the check and that the transaction landed anyway, and says "almost certainly completed". | *Known limitation of the record*: the vote is confirmed by `get_round_tally`, not by the daemon's own log line. | VERIFIED (on-chain), UNVERIFIED (daemon log line for that round) | Phase 23 Part C note; 0.6 counts four daemon votes on-chain. |

## 8. Environment variables

Build-time means baked in when the code is built or the dev server starts.
Runtime means read from the process environment at start. Public means safe
to appear in a client bundle or a committed file. `.env.example` files hold
placeholders only; no real value of a secret variable appears in any committed
file (scanned in `evidence/security-review-2026-09-28.md`; the Phase 23 record
states the disposable key was never written to a tracked file).

### 8.1 Frontend and SDK (`apps/web`, `packages/sdk`)

| Variable | Consumer | Required / default | Timing | Public / secret | Documented in | Docs match code? |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | SDK `readConfig` (`client.ts`) | required, no default; missing throws `MissingSdkConfigError` | BUILD-TIME (inlined into the client bundle; the dev server reads `.env.local` at start) | PUBLIC | `apps/web/.env.example`, `apps/web/README.md`, `apps/docs/environment-variables.md`, hub `README.md` | MATCH |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | SDK, `apps/web/lib/network.ts` | required for the SDK; the header shows "Network not configured" when absent | BUILD-TIME | PUBLIC | same | MATCH |
| `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID` | SDK | required | BUILD-TIME | PUBLIC | same | MATCH |
| `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID` | SDK | required | BUILD-TIME | PUBLIC | same | MATCH |
| `NEXT_PUBLIC_INDEXER_API_URL` | `apps/web/lib/indexer.ts` only; the SDK does not read it | required; missing throws `MissingIndexerConfigError` at call time | BUILD-TIME | PUBLIC | same | NO. *Stale documentation*: the example URL was `http://localhost:3001`, but the indexer defaults to `HTTP_PORT` `8787`. Fixed. |

`NEXT_PUBLIC_*` semantics: the SDK reads the four variables as literal
`process.env.NEXT_PUBLIC_…` property accesses (`client.ts:39-42`), which is
what lets Next.js inline them into the client bundle. Because every read of
the RPC, the vault, the registry and the indexer happens in the browser, all
five values are visible to anyone who loads the page. The Phase 23 record
changed the passphrase and had to restart the dev server for it to take
effect. Status: LOGICALLY COVERED plus that observation; inlining behavior
itself is documented Next.js behavior and was not re-tested here.

### 8.2 Indexer

All twelve are read at process start and are RUNTIME. None is a secret;
contract IDs and RPC URLs are public.

| Variable | Default / required | Read by | Documented in | Docs match code? |
|---|---|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | required | `config.ts` (zod `min(1)`) | `indexer/.env.example`, `indexer/README.md`, `environment-variables.md`, hub `README.md` | MATCH |
| `SLA_VAULT_CONTRACT_ID` | required | `config.ts` | same | MATCH |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | `config.ts` | same | MATCH |
| `NETWORK_PASSPHRASE` | Testnet passphrase | `config.ts`; used only by `fetchQuorumThreshold` | same | MATCH |
| `DB_PATH` | `./data/indexer.db` (relative to the working directory) | `config.ts` | same | MATCH |
| `HTTP_PORT` | `8787` | `config.ts` | same | MATCH |
| `POLL_INTERVAL_MS` | `5000` | `poller.ts` | same | MATCH |
| `MAX_LEDGERS_PER_REQUEST` | `1000` | `poller.ts:51,93` as the `getEvents` `limit` | same | NO. *Known limitation (naming)*: the name and the comment in `config.ts` say ledgers, but the value bounds events per page. Now stated in `environment-variables.md`. Behavior unchanged. |
| `ROUND_LENGTH_SECONDS` | `60` | `routes.ts` (`current-round`, `clock`) | same | MATCH |
| `START_LEDGER` | unset means the current tip; used only with no checkpoint | `poller.ts` | same | MATCH |
| `ALLOWED_ORIGINS` | `http://localhost:3000`, comma separated, never `*` | `config.ts`, `server.ts` | same | MATCH |
| `LOG_LEVEL` | `info` | `index.ts` reads `process.env.LOG_LEVEL` directly, not through `config.ts` | `indexer/README.md` says so | MATCH |

`npm start` runs `node --env-file=.env dist/index.js`, so it loads
`indexer/.env`. `npm run dev` (`tsx watch`) does not. The comment in
`decode.ts` referred to a `DEBUG_LOG_RAW_EVENTS` variable that exists nowhere
in the code (*stale documentation*, removed).

### 8.3 Watcher

All nine are RUNTIME, read once by `config.LoadFromEnv` (`os.LookupEnv`). The
daemon has no `.env` loader.

| Variable | Default / required | Public / secret | Documented in | Docs match code? |
|---|---|---|---|---|
| `WATCHER_REGISTRY_CONTRACT_ID` | required | PUBLIC | `watcher/.env.example`, `watcher/README.md`, `environment-variables.md` | MATCH |
| `WATCHER_SECRET_KEY` | required | **SECRET**; never logged (`main.go` logs only `sla_id`, `target`, `round_length`) | same | MATCH |
| `TARGET_URL` | required | PUBLIC (it is hashed into `endpoint_hash` on-chain) | same | MATCH |
| `SLA_ID` | required, `uint64` | PUBLIC | same | MATCH |
| `RPC_URL` | Testnet RPC | PUBLIC | same | MATCH |
| `NETWORK_PASSPHRASE` | Testnet passphrase | PUBLIC | same | MATCH |
| `ROUND_LENGTH_SECONDS` | `60`, positive integer | PUBLIC | same | MATCH |
| `HTTP_TIMEOUT_SECONDS` | `10` | PUBLIC | same | MATCH |
| `HTTP_EXPECT_MAX_STATUS` | `400`; a response below this is `Up` | PUBLIC | same | MATCH |

Documentation gap found: `watcher/README.md` and `developer-setup.md` said to
`cp .env.example .env` and then `go run …` (and `developer-setup.md` said
`go run .`, which cannot work because the `main` package is
`./cmd/watcher`), implying the file is loaded. It is not. The Phase 23 run hit
exactly this (`source .env` mis-parsed the unquoted `NETWORK_PASSPHRASE`,
which contains spaces and a `;`). *Stale documentation*, fixed.

### 8.4 Docs site and other

| Variable | Consumer | Notes |
|---|---|---|
| none | `apps/docs` (VitePress) reads no environment variables (`.vitepress/config.ts`). | MATCH |
| `REGISTRY_ID`, `VAULT_ID` | Untracked `.deployed-testnet.env` in the vault checkout. | Historical pair, not read by any code. Section 6. |

## 9. Round and clock semantics

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Contract use of `round_id` | Opaque `u64` argument of `submit_check`, `get_round_tally`, `has_watcher_voted`, `trigger_settlement`, `is_round_settled`. The contracts never call `env.ledger()` and never validate it against time. | n/a | n/a | VERIFIED (source; live votes on rounds 1 and 29844195–8 were both accepted) | `git grep "ledger()"` in `contracts/` finds nothing. |
| Consequence | Any registered watcher can vote for any `round_id`; anyone can call `trigger_settlement` for any `round_id`. | n/a | *Known limitation* (design), previously undocumented in the spec. | LOGICALLY COVERED | Now stated in the spec ("Round IDs"). |
| Watcher formula | n/a | `uint64(time.Now().Unix()) / uint64(ROUND_LENGTH_SECONDS)` from the **local system clock** (`internal/round/round.go`); default 60. | n/a | TESTED LOCALLY | `round_test.go` (floor division, boundary, no drift). Live rounds `29844195`–`29844198`. |
| Indexer formula | n/a | `Math.floor(closeTimeMs / 1000 / ROUND_LENGTH_SECONDS)` from the **latest ledger's close time** (`routes.ts`, `ledgerInfo.ts`); default 60. | Same formula, different clock. *Intentional difference*: the indexer trails the watcher's wall-clock round by up to about one ledger interval at a boundary. | VERIFIED | 0.7: `ledger_close_time` `2026-09-29T08:38:32Z` gave `current_round_id` `29844518`, and `29844518 × 60` = `2026-09-29T08:38:00Z`, which equals `round_started_at`. |
| Units | n/a | Ledger `closeTime` is a seconds string; the code multiplies by 1000 and divides by 1000 again, so no ms/s mismatch. Watcher uses `Unix()` seconds. | MATCH | VERIFIED | 0.7; `ledgerInfo.ts`. |
| Off-by-one | n/a | Both use floor division, so a round covers `[N×L, (N+1)×L)`; `round_started_at` = `N×L`. | MATCH | TESTED LOCALLY (watcher), VERIFIED (indexer, 0.7) | as above |
| Timezone | n/a | All values are UTC epoch seconds; ISO output uses `toISOString()` (UTC). | MATCH | LOGICALLY COVERED | source |
| Configured round lengths | n/a | Watcher and indexer both default to 60 and are configured independently (`ROUND_LENGTH_SECONDS` in each). Nothing enforces that they agree; a mismatch would split votes across `round_id`s. | *Known limitation* (deployment-time discipline) | LOGICALLY COVERED | `config.go`, `config.ts`. The frontend has no round length; it reads `current_round_id`. |
| Frontend consumption | n/a | `use-round-status.ts` takes `currentRoundId` from `/v1/clock` and never from the browser clock. | MATCH | LOGICALLY COVERED; Phase 23 browser check showed round `29844187`. | `apps/web/lib/use-round-status.ts`. |
| API doc said contracts "only care about the round number a transaction actually lands in… driven by ledger close time" | See above. | `apps/docs/api.md` `/v1/clock` section. | NO. **Stale/incorrect documentation** (the contracts do not read time). Fixed; `lifecycle.md` already had it right. | n/a | This section. |
| Doc example round ids | n/a | `api.md` examples used `round_id: 81762`, which is not `floor(unix/60)` for the timestamps shown (`2026-09-27T23:37:00Z` is round `29842537`). | NO. **Stale/incorrect documentation** (example values only). Fixed. | n/a | `date -u -d 2026-09-27T23:37:00Z +%s` divided by 60. |
| `round.go` comment "the way the contract spec defines them" | The contract spec did not define rounds. | `watcher/internal/round/round.go` header. | *Stale documentation* in a code comment; the spec now has a "Round IDs" section. Comment left unchanged. | n/a | Spec before `c7eef75` had no round definition. |

## 10. API routes and shapes

Live shapes below were read from a fresh indexer process on 2026-09-29 (0.7).
Route source: `indexer/src/api/routes.ts`. Consumer: `apps/web/lib/indexer.ts`.
Docs: `apps/docs/api.md`.

| Route | Vault | Hub (code, frontend, docs) | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `GET /v1/health` | n/a | Code: `{status:"ok", last_indexed_ledger: number \| null}`. Not called by the frontend. Docs: same. | MATCH | VERIFIED | 0.7 (`{"status":"ok","last_indexed_ledger":4929504}`); `routes.test.ts`. |
| `GET /v1/watchers` | n/a | Code: `{data:[{address, registered_at}], next_cursor:null}`, currently registered only, no query params. Frontend `getWatchers` maps the same fields. | MATCH. Docs' example timestamps were in a different format from the real ones (`….000Z` versus the RPC's `…Z`); fixed. | VERIFIED | 0.7: 5 rows, keys `address`, `registered_at`, `next_cursor` `null`; `routes.test.ts`. |
| `GET /v1/slas/:slaId/current-round` | n/a | Code: `{round_id: number, round_started_at, checked_in:[{watcher,status,checked_at}], not_yet_checked_in:[address]}`, no envelope. Frontend `getCurrentRound` maps the same fields and converts `round_id` to `bigint`. | MATCH | VERIFIED live, **no route-level unit test** (KNOWN LIMITATION) | 0.7 (`round_id` `29844518`, 0 checked in, 5 not yet). |
| `GET /v1/slas/:slaId/settlements` | n/a | Code: query `limit` (default 20, cap 100) and `before` (opaque cursor); `{data:[{round_id, votes_up, votes_down, quorum_threshold, penalty_amount, beneficiary, tx_hash, ledger_close_time, explorer_url}], next_cursor}`. `votes_*` are aggregated from `checks`; `quorum_threshold` is filled lazily by a live `get_sla`. Frontend `getSettlements` maps the same nine fields and `BigInt`s `penalty_amount`. The path that returned HTTP 500 (`fetchQuorumThreshold`) is fixed. | MATCH | VERIFIED live (fixed path returned 200 with the real row); the regression test is TESTED LOCALLY; **no route-level unit test** | 0.7; Phase 23 follow-up; `liveReads.test.ts`. |
| `GET /v1/providers/:address/slas` | n/a | Code: `{data:[{sla_id: number, token, bond_amount_at_creation: string, beneficiary, created_at, tx_hash}], next_cursor:null}`, ordered `created_at DESC`. Frontend `getProviderSlas` maps the same six fields. | MATCH | VERIFIED | 0.7: 3 SLAs `[2,1,0]` for the admin address; `routes.test.ts`. |
| `GET /v1/clock` | n/a | Code: `{ledger_sequence, ledger_close_time, current_round_id}`, no envelope. Frontend `getClock` maps the same three fields. | MATCH | VERIFIED live, **no route-level unit test** | 0.7 (`4929505`, `2026-09-29T08:38:32.000Z`, `29844518`). |
| Envelope | n/a | `{data, next_cursor}` for `watchers`, `settlements`, `providers`; bare object for `health`, `current-round`, `clock`. Frontend types agree. | MATCH | VERIFIED | 0.7. |
| Pagination | n/a | Only `settlements` paginates (cursor over `(ledger_close_time, event_id)`); `watchers` and `providers` always return `next_cursor: null`. | MATCH | TESTED LOCALLY (`pagination.test.ts` for the cursor codec); pagination through the route was not exercised (one settlement exists) | `pagination.ts`. |
| Error behavior | n/a | Unhandled errors give `500 {"error":"internal_error"}`; no `400`/`404` for unknown or malformed ids; an unknown path gives Express's HTML `404`; a bad `before` is ignored; a negative `limit` gives an empty page. | NO. **Stale documentation** (none of this was documented), fixed. The negative-`limit` behavior is a *real defect* (low severity: empty page instead of a default or a `400`); **not fixed**, since fixing it is a code change outside a parity audit. | VERIFIED | 0.7: `?limit=-5` returned `{"data":[],"next_cursor":null}`; `/v1/nope` returned `404 text/html`; `/v1/slas/12345/settlements` and `/v1/slas/abc/current-round` returned `200`. |
| CORS | n/a | `cors({origin: ALLOWED_ORIGINS})`; an allowed origin is echoed, others get no header. | MATCH | VERIFIED | 0.7: `Origin: http://localhost:3000` got `Access-Control-Allow-Origin: http://localhost:3000`; `Origin: http://evil.example` got none. |
| Timestamp formats | n/a | Stored event times (`registered_at`, `checked_at`, `created_at`, settlement `ledger_close_time`) are the RPC's `ledgerClosedAt` string without milliseconds; computed times (`round_started_at`, `/v1/clock`) are `toISOString()` with `.000Z`. | *Intentional difference*; now documented. | VERIFIED | 0.7. |
| Missing spec file | n/a | Code comments, `indexer/README.md`, `apps/web/README.md`, `indexer/package.json` and `TEST-MATRIX.md` cited `SLASettle-indexer-api-spec.md`, which has never existed in either repository (`git log --diff-filter=A` finds nothing). | NO. **Stale documentation**, fixed by pointing at `apps/docs/api.md`. | VERIFIED | `git log --all --diff-filter=A -- '*indexer-api-spec*'` in both repositories. |

## 11. Decoders and fixtures

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| Event encoding versus indexer decoder | `#[contractevent]` in `events.rs`. | `decodeEvent` (`scValToNative` on topics and value), `classifyEvents` per topic. | MATCH | VERIFIED | Section 4; live decode in 0.5 and 0.6. |
| `decodeEvent` unit tests | n/a | `decode.test.ts` covers only `amountToString`; `decodeEvent` itself has no unit test and is exercised through the live runs. | *Known limitation* (test coverage). | VERIFIED live, no unit test | `indexer/src/rpc/decode.test.ts`. |
| SDK decoding versus contract | `SLAConfig`, `RoundTally`, enums. | `decodeSlaConfig`, `decodeRoundTally`, `decodeContractEnum`; tests round-trip encoded args through `scValToNative`. | MATCH | VERIFIED live (0.4); TESTED LOCALLY | `packages/sdk/src/*.test.ts`. |
| Watcher encoding versus contract | `submit_check` signature. | `mustU64`, `mustBytesN32`, `mustAccountAddress`, `mustCheckStatusEnum`; mocked-RPC tests assert argument order. | MATCH | VERIFIED (daemon votes accepted), TESTED LOCALLY | `contract_internal_test.go`, `contract_rpc_test.go`; Phase 23 Part C. |
| Fixture `classify.test.ts`, three "not persisted" kinds | n/a | Used the obsolete shape (`data: { sla_id, amount }`, no topics; no `bondWithdrawn` case although the title named it). | *Stale fixture* (encoded an interface that was never real). Corrected to the live shapes and extended to all three; assertions unchanged in meaning. | TESTED LOCALLY (36/36) | Live shapes in 0.5. |
| Fixture transaction hashes | Historical deployment evidence. | `classify.test.ts` and comments cite `258c86d2…`, `b1dc301a…` (the historical deployment). `apps/web/components/landing/product-preview.tsx` uses `EXAMPLE_*` addresses and a made-up hash, labeled "Example data — not a live SLA" on the page. `watcher-grid.test.tsx` uses `GBBBB…`/`GCCCC…`. | *Historical evidence* (the first two, kept), *intentional difference* (labeled example data, test placeholders). Nothing deleted. | LOGICALLY COVERED | Source. |
| Fixture `liveReads.test.ts` | Current `sla_vault` ID. | Encodes the current live vault ID and a hand-built `get_sla` simulation result. | MATCH | TESTED LOCALLY, and reverted-and-failed once as recorded in Phase 23 | `liveReads.test.ts`; Phase 23 follow-up. |
| Untested route handlers | n/a | `routes.test.ts` covers three of six routes. | *Known limitation*; recorded in `TEST-MATRIX.md`'s banner. | see section 10 | `indexer/src/api/routes.test.ts`. |

## 12. Documentation

Files read directly for this section: vault `README.md`, `SECURITY.md`,
`CONTRIBUTING.md`, `SLASettle-contract-spec.md`, `evidence/*`; hub `README.md`,
`SECURITY.md`, `CONTRIBUTING.md`, `TEST-MATRIX.md`, `apps/docs/*.md`,
`indexer/README.md`, `watcher/README.md`, `apps/web/README.md`,
`packages/sdk/README.md`, `evidence/*`, both `ci.yml` files.

| Concept | Vault | Hub | Match? | Status | Evidence |
|---|---|---|---|---|---|
| `deployment-topology.md`: "No running watcher daemon process, anywhere, ongoing. Every real vote referenced in this project's evidence was submitted directly via the Stellar CLI…" | The 2026-09-27 votes were CLI submissions. | Phase 23 (2026-09-29) ran the real daemon for four rounds. | NO. **Stale documentation**: true before Phase 23, false as written now. The rewrite keeps both facts: the 2026-09-27 votes were CLI, the 2026-09-29 votes were the daemon, and no watcher runs continuously. | VERIFIED | `phase-23-verification-2026-09-29.md` Part C; 0.6. Fixed in the topology commit. |
| `developer-setup.md`: watcher "tested locally against a mocked RPC transport, not run live"; `go run .` | n/a | Phase 23 ran it live; the entry point is `./cmd/watcher`. | NO. **Stale documentation**, fixed. | VERIFIED | as above |
| `indexer/README.md`: "five of eight… three remain unverified"; "33/33" | n/a | All eight verified; 36/36 today. | NO. **Stale documentation**, fixed. | VERIFIED | Section 4; 0.11. |
| `testing.md`: indexer "35/35" | n/a | 36/36 after the Phase 23 regression test. | NO. **Stale documentation**, fixed. | VERIFIED | 0.11. |
| `TEST-MATRIX.md` | n/a | A Phase 9 (2026-09-28) snapshot: names the historical pair as deployed, marks the watcher daemon, three events and browser checks as UNVERIFIED/BLOCKED, counts 33 indexer tests, claims route tests for all endpoints. | *Historical evidence*, now labeled as such with a banner listing every superseded row. Rows themselves were not rewritten. | VERIFIED (banner facts) | Banner in `TEST-MATRIX.md`. |
| `testnet-deployment.md` claims about the withdraw fix and `.deployed-testnet.env` | n/a | See section 6. | NO. **Stale/incorrect**, fixed. | VERIFIED | Section 6. |
| `SLASettle-contract-spec.md` | Event shapes unconfirmed; no round definition; no note on zero-balance withdrawal or per-contract error numbers; `caller` "recorded". | n/a | NO. **Stale documentation**, fixed in vault `c7eef75`. | VERIFIED | Sections 4 and 9. |
| Vault `SECURITY.md` "Money movement" for `withdraw_remaining_bond` | Describes "transfers the full remaining tracked balance… then zeroes it"; the "Fixed in this review" section does record the zero-balance rejection. | n/a | MATCH (the two sections together describe the source). | LOGICALLY COVERED | `SECURITY.md`. |
| Vault `README.md` claims | "Currently deployed" pair, 46/46 tests, hash `2f958b86…`, "main is currently green", branch protection. | n/a | MATCH after the additions. Branch protection does not apply to administrators (`enforce_admins` off), now stated. | VERIFIED | 0.9, 0.10, 0.11; CI run `36486254192`. |
| Hub `README.md` claims | n/a | IDs and dates, three CI jobs, Dependabot, branch protection, open PR #8, live watcher and browser verification. | MATCH after the additions. PR #8 is open, its own CI run (`449e285`) failed on ESLint 10, `main`'s latest run (`85e4f10`) succeeded. | VERIFIED | `gh pr list`, `gh run list`; 0.9. |
| CI job names versus branch protection | `check, test, build` | `web and sdk (build, lint, typecheck, test)`, `indexer (build, test)`, `watcher (build, vet, test)` | MATCH: the required-check contexts equal the job names in each `ci.yml`. | VERIFIED | 0.9; both `ci.yml` files. |
| Docs site mobile layout | n/a | Phase 23 could not produce a narrow viewport. | *Blocked/unverified*, unchanged. | UNVERIFIED | `phase-23-verification-2026-09-29.md` Part A. |
| Frontend write forms through a signed transaction | n/a | Not exercised in Phase 23; `end-user-guide.md` and `limitations.md` say so. | *Blocked/unverified*, unchanged. | UNVERIFIED | Phase 23 Part B. |
| Untracked local data | n/a | `indexer/data/` (a local database, its `-wal`/`-shm` files and a `.pre-phase10-historical-backup`) is untracked in the hub. `indexer/.gitignore` covers `*.db` and `*.db-journal` only, so the WAL, SHM and backup files, and the `data/` directory itself, are not ignored. | *Known limitation* (repository hygiene): a `git add .` would stage them. Not changed by this audit. | VERIFIED | `git status`; `indexer/.gitignore`. |

## 13. Findings summary

### Real defects
- Indexer `GET /v1/slas/:slaId/settlements?limit=-5` returns an empty page
  because a negative `limit` is not validated (`routes.ts`). Low severity, not
  fixed here.

### Stale documentation (fixed in this batch)
- Vault spec: three event shapes described as unconfirmed; no round
  definition; no per-contract error numbering note; no zero-balance
  withdrawal note; `caller` "recorded".
- Vault `SECURITY.md`: `caller` "recorded for observability".
- Hub `testnet-deployment.md`: the zero-balance fix was not "verified against
  SLA 1"; `.deployed-testnet.env` is not a hub file.
- Hub `contracts.md`, `api.md`, `environment-variables.md`, `developer-setup.md`,
  `testing.md`, `indexer/README.md`, `watcher/README.md`, `watcher/.env.example`,
  `apps/web/README.md`, `indexer/package.json`.
- Hub `decode.ts` header, `classify.ts` comment, `classify.test.ts` fixture,
  `routes.ts` and `lib/indexer.ts` comments.
- Hub `deployment-topology.md` (fixed in the topology commit).

### Intentional differences (documented, not changed)
- Status casing by layer; frontend `pending`; three events decoded but not
  persisted; watcher clock versus ledger clock for `round_id`; SDK wraps a
  subset of methods; timestamp format split in the API; live WASM spec lists
  `DataKey`, the 28.0.0 build does not.

### Historical evidence (preserved)
- The `CBEZ3XBI…` / `CBA4DFNU…` deployment and its transactions; the Phase 9
  `TEST-MATRIX.md` rows; the 2026-09-27 evidence file, including its remark
  that the README needed updating (done later in `2cfd288`); the Phase 23
  record.

### Known limitations
- The live `sla_vault` lacks the zero-balance rejection; SDK 27.0.6 versus
  28.0.0; WASM hash not reproducible across Rust versions; `round_id` is
  unvalidated on-chain; watcher and indexer round lengths must be kept equal by
  hand; indexer `explorer_url` is Testnet-only; unknown status maps to `up`;
  `MAX_LEDGERS_PER_REQUEST` is an event limit; no route tests for three
  endpoints; `decodeEvent` untested directly; local database files not covered
  by `.gitignore`.

### Blocked or unverified
- Docs site on a narrow viewport; dashboard write forms through a signed
  transaction; the stored registry address in `sla_vault` by direct storage
  read; the vault's zero-balance rejection live; pagination through the
  settlements route with more than one page; the daemon's own log line for
  round 29844195.
