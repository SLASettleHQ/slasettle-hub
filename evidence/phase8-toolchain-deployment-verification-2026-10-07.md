# Phase 8 Toolchain, Local Environment, and Deployment Verification

Date: 2026-10-07  
Author: Hollujay  
Repositories:
- `SLASettleHQ/slasettle-vault` at commit `d55d4396408c328cd625b058ce9e5a980e4e9636`
- `SLASettleHQ/slasettle-hub` at commit `ba9642ce5cec989e67d4826fa2db02ec906d6ae2`

## 1. Objective and Scope

Phase 8 verifies the reproducibility of the SLASettle toolchain, builds, dependencies, contract WASM artifacts, live Testnet identity, and hosting configurations across both repositories. This phase does not introduce new features or rewrite historical evidence.

---

## 2. Toolchain Inventory and Compatibility Matrix

All installed versions were inventoried on 2026-10-07 from the local build environment and compared against repository-pinned versions and current stable upstream releases.

| Tool | Installed Version | Pinned / Declared Version | Upstream Stable (2026-10-07) | Compatibility Status | Action Taken / Rationale |
|---|---|---|---|---|---|
| `rustc` | 1.97.1 | `>= 1.91.0` (in `soroban-sdk` 28.0.0) | 1.99.0 | Compatible | Preserved. Compiles contracts with zero linker errors and reproduces exact WASM hashes. |
| `cargo` | 1.97.1 | Matches `rustc` | 1.99.0 | Compatible | Preserved. Works with committed `Cargo.lock`. |
| `rustup` | 1.29.1 | N/A | 1.29.1 | Compatible | Targets `wasm32v1-none` and `x86_64-unknown-linux-gnu` present. |
| `stellar-cli` | 28.1.0 | 28.1.0 (`ci.yml`, README) | 28.1.0 | Compatible | Matches pinned and upstream version. |
| `Node.js` | v24.21.0 | 24.21.0 (`.nvmrc`, `package.json`) | 24.21.0 (LTS) | Compatible | Matches pinned and upstream LTS. |
| `pnpm` | 12.8.2 | 12.8.2 (`package.json`, `pnpm-lock.yaml`) | 12.9.x | Compatible | Preserved. Strict lockfile adherence (`--frozen-lockfile`). |
| `npm` | 11.19.0 | Lockfile v3 (`indexer/package-lock.json`) | 11.x | Compatible | Builds indexer dependencies and executes test suite. |
| `go` | 1.25.1 | `go 1.25` / `toolchain go1.25.14` (`watcher/go.mod`) | 1.25.x | Compatible | Compiles, vets, and tests the watcher daemon without issues. |
| `git` | 2.43.0 | N/A | 2.43.x | Compatible | Operational. |
| `soroban-sdk` | 28.0.0 | 28.0.0 (`Cargo.toml`, `Cargo.lock`) | 28.0.0 | Compatible | Authoritative Soroban Protocol 28 contract framework. |

---

## 3. Local Contract Build and Test Verification

From `slasettle-vault`, clean builds and test executions were conducted using the committed `Cargo.lock`.

### A. Contract Tests (`cargo test --workspace`)
- Total tests: 52 passed, 0 failed, 0 filtered out
  - `sla_vault`: 34 passed
  - `watcher_registry`: 18 passed
- Exit code: 0

### B. Static Analysis and Formatting
- `cargo check --workspace`: Passed (exit code 0)
- `cargo clippy --workspace --all-targets --all-features`: Passed with 2 documented non-fatal style warnings (`needless_borrows_for_generic_args` in `sla_vault/src/lib.rs`), consistent with existing audited baseline.
- `cargo fmt --check`: Informational check exhibits documented formatting drift (preserved per project policy to avoid unneeded line churn).

### C. WASM Compilation (`stellar contract build`)
Contracts were built into `target/wasm32v1-none/release/`:

| Contract | Artifact Path | Size | SHA-256 Hash |
|---|---|---|---|
| `watcher_registry` | `target/wasm32v1-none/release/watcher_registry.wasm` | 8,494 bytes | `5478788ea6c6ae46ddb85c399015139d3b883b7c253dd9abe50e096bf0bcdfb5` |
| `sla_vault` | `target/wasm32v1-none/release/sla_vault.wasm` | 13,314 bytes | `e177a76f3888575c3c9666689ab905e25a1b3001fb4d85045d05ee43fa298bcd` |

---

## 4. Deployed Contract Hash Reconciliation

The deployed WASM binaries were fetched directly from Stellar Testnet using `stellar contract fetch` and hashed via `sha256sum`:

| Contract Name | Contract ID | Local Build SHA-256 | Deployed Testnet SHA-256 | Reconciliation Status |
|---|---|---|---|---|
| `watcher_registry` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | `5478788ea6c6ae46ddb85c399015139d3b883b7c253dd9abe50e096bf0bcdfb5` | `5478788ea6c6ae46ddb85c399015139d3b883b7c253dd9abe50e096bf0bcdfb5` | **MATCH** |
| `sla_vault` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | `e177a76f3888575c3c9666689ab905e25a1b3001fb4d85045d05ee43fa298bcd` | `e177a76f3888575c3c9666689ab905e25a1b3001fb4d85045d05ee43fa298bcd` | **MATCH** |

Both contracts exhibit 100% byte-for-byte reproducibility with the live Testnet deployment.

---

## 5. Deployment Dependency Order and Commands

### Dependency Order
1. **Compilation Dependency**: `sla_vault/src/lib.rs` executes `soroban_sdk::contractimport!` against `watcher_registry.wasm` to import the registry's typed client at compile time. Therefore, `watcher_registry` must be compiled before `sla_vault`.
2. **Deployment and Initialization Dependency**: `sla_vault::initialize` requires `watcher_registry: Address`. Therefore, `watcher_registry` must be deployed and initialized prior to `sla_vault` initialization.

### Documented Reproducible Deployment Commands
```bash
# 1. Configure network
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# 2. Build WASM binaries
stellar contract build

# 3. Deploy and initialize watcher_registry
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/watcher_registry.wasm \
  --source-account admin --network testnet)

stellar contract invoke --id $REGISTRY_ID --source-account admin \
  --network testnet -- initialize --admin admin

# 4. Register initial watchers
stellar contract invoke --id $REGISTRY_ID --source-account admin \
  --network testnet -- register_watcher --caller admin --watcher <WATCHER_ADDRESS>

# 5. Deploy and initialize sla_vault
VAULT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sla_vault.wasm \
  --source-account admin --network testnet)

stellar contract invoke --id $VAULT_ID --source-account admin \
  --network testnet -- initialize --admin admin --watcher_registry $REGISTRY_ID
```

---

## 6. Authoritative Deployer and Admin Evidence

From recorded Testnet transactions in `slasettle-vault/evidence/testnet-2026-10-01.md`:
- Admin & Deployer Address: `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`
- `watcher_registry` Creation Tx: `ca6c382cc1d551419ecbfcfe1ee8c90b3e34fbb1e51b7e356ddce4521d28959a`
- `watcher_registry` Init Tx: `f16ff6ef3effe24bbe73f948a6f5d874c693a1772e5170690ebf029a5860c677`
- `sla_vault` Creation Tx: `cc134bb4aa560ff13bf60c429d6e7e62f8bc53aa2882f1131ecddcbe3c3be8e2`
- `sla_vault` Init Tx: `38cf9f59e772f55d3c91984a43e0aa0a4b2c2866e0958ad1fdc8732779296c7a`

---

## 7. Live Contract Read Cross-Check

Direct read simulations against Soroban Testnet RPC (`https://soroban-testnet.stellar.org`) confirmed current contract state:
- **Watcher Registry**:
  - `get_watcher_count()`: `5`
  - `get_round_tally(0, 123)`: `{ votes_up: 0, votes_down: 3 }`
- **SLA Vault**:
  - `is_round_settled(0, 123)`: `true`
  - `SLA #0`: Status `Active`, Initial Bond `500,000,000` (50 native), Current Bond `410,000,000` (41 native), Penalty `100,000,000`, Quorum `3`.
  - `SLA #1`: Status `Cancelled`, Current Bond `0`.
  - `SLA #2`: Status `Cancelled`, Current Bond `0` (withdrawn during Phase 7 live verification).

---

## 8. Application Hub Verification

From `slasettle-hub`:
- **SDK Tests**: 57 passed across 5 test suites.
- **Web App Tests**: 245 passed across 26 test suites.
- **TypeScript Check**: `tsc --noEmit` across all workspace packages passed with exit code 0.
- **ESLint**: Passed with exit code 0.
- **Web Production Build**: Next.js Turbopack production build succeeded; static and dynamic routes generated cleanly.
- **Docs Build**: VitePress documentation build succeeded in 25.57s.
- **Indexer**: 62 tests passed; `tsc -p tsconfig.json` build succeeded.
- **Watcher**: Go daemon built, vetted, and unit-tested cleanly (`ok` across internal modules).

---

## 9. Hosted Infrastructure Verification

### A. Hosted Indexer (`https://slasettle-indexer.slasettle-indexer.workers.dev`)
- `/v1/health`: `{"status":"ok","last_indexed_ledger":5070374}` (actively trailing live Testnet ledger).
- `/v1/clock`: Returns active ledger close time and current round sequence.
- `/v1/watchers`: Returns the 5 registered Testnet watchers.
- `/v1/providers/GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB/slas`: Returns SLAs #2, #1, and #0 with accurate transaction hashes.
- `/v1/slas/0/settlements`: Returns historical settlement record for round 123 (`70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b`).

### B. Hosted Frontend (`https://slasettle-web.vercel.app`)
- Inspected production client bundles over HTTPS.
- Verified inlined public variables:
  - Soroban RPC: `https://soroban-testnet.stellar.org`
  - Network Passphrase: `Test SDF Network ; September 2015`
  - SLA Vault ID: `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` (present in client chunk `29bviru9xzpbw.js`)
  - Watcher Registry ID: `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` (present in client chunk `29bviru9xzpbw.js`)
  - Hosted Indexer API URL: `https://slasettle-indexer.slasettle-indexer.workers.dev` (present in client chunk `05b-o9__82or3.js`)

---

## 10. Redeployment Decision and Verdict

- **Redeployment Decision**: **No contract redeployment is required.** The local build produces WASM hashes that match the live deployed contracts byte-for-byte. The deployed contracts are active, correctly initialized, and functionally verified on Stellar Testnet.
- **Final Verdict**: **PHASE 8: PASS**
