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
- **Instance Storage**: Both contracts extend instance TTL on selected successful state-changing calls and expose a public `extend_contract_ttl` maintenance entrypoint. Long periods without those calls can still require active TTL monitoring and an explicit maintenance invocation; this is not a fully autonomous archival or recovery service.
- **Client Handling**: The SDK and web frontend assume active ledger state. If an SLA record were to expire into archived storage due to prolonged inactivity, it must be restored on-chain before interacting with it.

## Verification & Deployment Status

### Verified Capabilities
- **WASM Bytecode Parity**: Local release builds from `slasettle-vault` match deployed Testnet WASMs byte-for-byte with zero hash drift.
- **Live Browser & Freighter Operations**: On 2026-10-26, the v0.2 GREEN lifecycle was verified through the Web and Freighter on SLA #0: create, top up, watcher quorum, settlement, cancel, and withdrawal. A signing delay was observed during the run but was not established as a repository defect.
- **Permissionless Settlement**: Real on-chain settlements have been executed and verified where an external keeper account triggered payout to a beneficiary upon quorum formation.
- **Automated Test Coverage**: 595 automated tests pass: 72 Vault, 89 SDK, 277 Web, 69 indexer, and 88 watcher.

### Operational Caveats
- **Testnet Only**: SLASettle is deployed on Stellar Testnet and has not been deployed to Stellar Mainnet.
- **Unaudited**: While extensive automated testing and static analysis have been conducted, the codebase has not undergone a formal third-party security audit.
- **Watcher Committee**: Watcher daemons can be run independently, but the current GREEN Testnet committee consists of three project-controlled identities. Endpoint commitment does not prove truthful HTTP observation.
- **Settlement Trigger**: Settlement is permissionless but not automatically scheduled. The contract supports historical-round settlement; the current Web UI targets the current round.
