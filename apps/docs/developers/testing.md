# Testing & Verification

SLASettle maintains automated test suites across every layer of the architecture, spanning Rust smart contracts, TypeScript SDK, Next.js web application, Cloudflare Workers indexer, and Go watcher daemon.

## Automated Test Coverage Summary

Across both repositories, **416 automated tests** pass with zero failures:

| Component | Framework / Runner | Test Count | Pass Rate |
| :--- | :--- | :--- | :--- |
| **`slasettle-vault` Contracts** | `cargo test --workspace` | **52 passed** | 100% |
| **`@slasettle/sdk` Library** | Vitest | **57 passed** | 100% |
| **`apps/web` Operations Console** | Vitest + React Testing Library | **245 passed** | 100% |
| **`services/indexer` Service** | Node Test Runner (`node --test`) | **62 passed** | 100% |
| **`services/watcher` Daemon** | Go `testing` Package | **All suites pass** | 100% |
| **Total Automated Tests** | | **416 passed** | **100%** |

---

## Running Test Suites Locally

### 1. Smart Contracts (`slasettle-vault`)
```bash
cd slasettle-vault
cargo test --workspace
```
*Covers*: Contract state machines, authorization boundaries, error propagation, duplicate vote rejections, quorum calculation, edge-case arithmetic, and SAC token escrow.

### 2. TypeScript SDK (`packages/sdk`)
```bash
pnpm --filter @slasettle/sdk test
```
*Covers*: Missing and invalid environment configuration, transaction envelope building for all 5 write operations, response shape parsing, BigInt conversions, and simulation mocks.

### 3. Web Console (`apps/web`)
```bash
pnpm --filter @slasettle/web test
```
*Covers*: Wallet connection state, network mismatch gating, SLA creation validation, top-up modal flows, confirmation dialogs, quorum progress meters, and transaction status banners across 26 test files.

### 4. Event Indexer (`services/indexer`)
```bash
cd services/indexer
npm test
```
*Covers*: Real SQLite/D1 event persistence, chronological event processing, cursor-based pagination, REST endpoint routing, and CORS header enforcement.

### 5. Watcher Daemon (`services/watcher`)
```bash
cd services/watcher
go test -v ./...
```
*Covers*: HTTP probing timeouts, status code evaluators, epoch round computation, duplicate check bypass, and contract RPC interaction wrappers.

---

## Key Historical Regression Tests

The test suite explicitly encodes regressions discovered during engineering:

1. **Zero Quorum Rejection (`create_sla`)**:
   - `create_sla` enforces `quorum_threshold > 0`. Because `votes_down < quorum_threshold` is evaluated with unsigned integers, a threshold of 0 would allow settlement with zero votes. Covered in `sla_vault` tests.
2. **Zero-Balance Withdrawal Rejection (`withdraw_remaining_bond`)**:
   - Repeated calls to withdraw on an emptied bond return `Error::InvalidAmount` rather than wasting transaction fees and emitting empty events. Covered in `sla_vault` tests.
3. **Indexer Chronological Event Processing**:
   - `services/indexer` tests verify that batch events containing `register_watcher`, `remove_watcher`, and re-registration apply strictly in chronological order rather than grouping by event type.

---

## Live Stellar Testnet Verification

In addition to local unit and integration tests:
- **Protocol 28 WASM Parity**: Contract WASM bytecode deployed to Testnet matches local release builds byte-for-byte with zero hash drift.
- **Freighter Browser Verification**: End-to-end wallet interaction (create agreement, top up collateral, cancel agreement, withdraw collateral) was executed and confirmed live on Testnet using Freighter on SLA #2.
- **Permissionless Settlement**: Real on-chain settlements have been executed where external keeper accounts triggered penalty payments directly to beneficiaries upon quorum formation.
