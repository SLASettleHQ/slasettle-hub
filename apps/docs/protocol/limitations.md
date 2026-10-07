# Protocol Limitations & Boundary Scope

This page provides an honest, comprehensive account of design trade-offs, operational boundaries, and verification scope in the current SLASettle protocol implementation.

## Architectural Trade-Offs (By Design)

### 1. No Commit-Reveal for Watcher Checks
- **Context**: Soroban ledger state is public and transparent.
- **Trade-Off**: A watcher node that submits late in a round window can inspect transactions submitted by earlier peers before broadcasting its own check. A dishonest node could theoretically mirror the emerging consensus rather than conducting an independent probe.
- **Design Rationale**: A commit-reveal scheme requires two transactions per watcher per round (one to commit a hash, one to reveal the salt and vote). This doubles network fee expenditure and transaction volume. For Testnet and v1 operations, the single-transaction model was chosen.

### 2. Global Shared Watcher Committee
- **Context**: Watcher authorization resides globally in `watcher_registry`.
- **Trade-Off**: Individual service providers cannot designate customized sub-committees of watchers for their specific SLAs. All SLAs on a given contract deployment share the same authorized watcher registry.
- **Design Rationale**: Simplifies quorum tracking, reduces contract storage footprint, and ensures consistent validator identity across all agreements.

### 3. Display-Only Uptime Target (`uptime_target_bps`)
- **Context**: The `create_sla` function accepts an `uptime_target_bps` parameter (e.g. `9990` for 99.9%).
- **Trade-Off**: The smart contracts do not calculate cumulative percentage uptime across a 30-day billing cycle. Settlement enforcement operates strictly on a per-round basis. If a single round meets quorum for downtime, a penalty is payable regardless of uptime in preceding rounds.
- **Design Rationale**: Storing and aggregating rolling sliding-window telemetry on-chain would incur prohibitive Soroban storage and compute costs.

### 4. Binary Penalty Payouts (No Pro-Rata or Severity Scaling)
- **Trade-Off**: When a breach settles, the contract transfers `min(penalty_per_breach, remaining_bond)`. It does not calculate pro-rated deductions based on latency degradation or partial outage severity.

## Storage Lifetime & State Archival

Soroban uses state archival to manage ledger storage growth:
- **Persistent Storage TTLs**: In the contracts, entries for `SLAConfig`, `BondBalance`, `Check`, and `RoundTally` extend persistent storage TTLs upon write operations.
- **Instance Storage**: Instance storage entries (`Admin`, `Paused`, `NextSlaId`, `WatcherCount`) require periodic maintenance or manual extension via `stellar contract extend` if long periods elapse without administrative interaction.
- **Client Handling**: The SDK and web frontend assume active ledger state. If an SLA record were to expire into archived storage due to prolonged inactivity, it must be restored on-chain before interacting with it.

## Verification & Deployment Status

### Verified Capabilities
- **WASM Bytecode Parity**: Local release builds from `slasettle-vault` match deployed Testnet WASMs byte-for-byte with zero hash drift.
- **Live Browser & Freighter Operations**: On 2026-10-07 (Phase 7), live browser verification using the Freighter wallet extension was executed against the current Protocol 28 Testnet deployment (`sla_vault`: `CDBFPYHJ...`), confirming end-to-end creation, bond top-up, cancellation, and collateral withdrawal on SLA #2.
- **Permissionless Settlement**: Real on-chain settlements have been executed and verified where an external keeper account triggered payout to a beneficiary upon quorum formation.
- **Automated Test Coverage**: 416 automated tests pass across the workspace (57 SDK, 245 web console, 62 indexer, 52 contract unit and integration tests).

### Operational Caveats
- **Testnet Only**: SLASettle is deployed on Stellar Testnet and has not been deployed to Stellar Mainnet.
- **Unaudited**: While extensive automated testing and static analysis have been conducted, the codebase has not undergone a formal third-party security audit.
- **Watcher Daemon Hosting**: While the indexer and web dashboard are continuously hosted on production cloud infrastructure, watcher daemons are intended to be run by independent operators and are not hosted as a continuous monolithic service by the repository maintainers.
