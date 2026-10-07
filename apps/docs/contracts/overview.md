# Contract Overview

The SLASettle smart contract layer is implemented in Rust using the Soroban SDK (`soroban-sdk 28.0.0`) targeting Stellar Protocol 28. It is organized into two distinct, loosely coupled contracts hosted in the `SLASettleHQ/slasettle-vault` repository.

## Contract Architecture & Coupling

```text
+-------------------------------------------------------+
|                   watcher_registry                    |
|  - Manages watcher set & counts per-round votes       |
|  - Emits: CheckSubmitted, WatcherRegistered/Removed   |
+-------------------------------------------------------+
                           ^
                           | Cross-contract read:
                           | get_round_tally(sla_id, round_id)
                           |
+-------------------------------------------------------+
|                       sla_vault                       |
|  - Holds provider collateral in escrow                |
|  - Interprets quorum: votes_down >= quorum_threshold  |
|  - Executes penalty transfers to beneficiaries        |
|  - Emits: SlaCreated, BondToppedUp, SettlementPaid,   |
|           SlaCancelled, BondWithdrawn                 |
+-------------------------------------------------------+
```

### Clean Separation of Concerns
1. **`watcher_registry`**:
   - Acts strictly as an attestation registry and round tally aggregator.
   - Has **zero dependencies** on `sla_vault` or any financial/token contracts.
   - Does not enforce quorum thresholds or make settlement decisions.
2. **`sla_vault`**:
   - Manages agreement lifecycle, collateral balances, and payouts.
   - References `watcher_registry` via a stored contract address initialized at deployment.
   - Performs cross-contract calls using the compiled client (`watcher_registry_contract::Client`) to inspect round vote tallies.
   - Contains all economic and quorum enforcement logic.

## Deployed Contract Addresses (Stellar Testnet)

| Contract Name | Address | Functionality |
| :--- | :--- | :--- |
| **`sla_vault`** | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` | Collateral escrow, agreement configuration, and penalty settlement. |
| **`watcher_registry`** | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` | Node registration, check attestation, and vote tallying. |

- **Network**: Stellar Testnet
- **Network Passphrase**: `Test SDF Network ; September 2015`
- **RPC URL**: `https://soroban-testnet.stellar.org`

## Building from Source

To compile the smart contracts from the `slasettle-vault` repository:

```bash
git clone https://github.com/SLASettleHQ/slasettle-vault.git
cd slasettle-vault

# Build both release WASM targets
stellar contract build

# WASM artifacts output:
# target/wasm32-unknown-unknown/release/watcher_registry.wasm
# target/wasm32-unknown-unknown/release/sla_vault.wasm
```

Deterministic compilation with `stellar contract build` produces bytecode that matches the deployed Testnet contracts byte-for-byte.
