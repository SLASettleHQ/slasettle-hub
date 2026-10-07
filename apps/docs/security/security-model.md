# Security Model

The SLASettle security model establishes strict privilege boundaries across on-chain Soroban contracts and off-chain operational services.

## Authorization Matrix

Every state-modifying function across both smart contracts enforces explicit authorization checks using the Soroban runtime:

| Contract | Function | Required Signer | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **`watcher_registry`** | `initialize` | Contract Admin | `admin.require_auth()` |
| **`watcher_registry`** | `register_watcher` | Contract Admin | `caller.require_auth() && caller == Admin` |
| **`watcher_registry`** | `remove_watcher` | Contract Admin | `caller.require_auth() && caller == Admin` |
| **`watcher_registry`** | `pause` / `unpause` | Contract Admin | `caller.require_auth() && caller == Admin` |
| **`watcher_registry`** | `submit_check` | Registered Watcher | `watcher.require_auth() && is_watcher(watcher)` |
| **`sla_vault`** | `initialize` | Contract Admin | `admin.require_auth()` |
| **`sla_vault`** | `create_sla` | Service Provider | `provider.require_auth()` |
| **`sla_vault`** | `top_up_bond` | Agreement Provider | `caller.require_auth() && caller == SLAConfig.provider` |
| **`sla_vault`** | `cancel_sla` | Agreement Provider | `caller.require_auth() && caller == SLAConfig.provider` |
| **`sla_vault`** | `withdraw_remaining_bond` | Agreement Provider | `caller.require_auth() && caller == SLAConfig.provider` |
| **`sla_vault`** | `trigger_settlement` | **Permissionless** | Validated via on-chain quorum: `votes_down >= quorum_threshold` |
| **`sla_vault`** | `pause` / `unpause` | Contract Admin | `caller.require_auth() && caller == Admin` |

---

## Client-Side Security Boundary

### Zero Private Keys in Web Console and SDK
- Neither `apps/web` nor `@slasettle/sdk` ever stores, requests, or generates cryptographic seed phrases or secret keys.
- Write operations construct unsigned XDR envelopes and hand them directly to `@stellar/freighter-api`.
- Cryptographic signing occurs strictly inside the sandboxed Freighter browser extension.
- Regular source tree audits confirm zero private-key variables, secret persistence, or unauthorized analytics trackers.

### Network Mismatch Protection
- The web console verifies the active network of the connected Freighter wallet against `NEXT_PUBLIC_NETWORK_PASSPHRASE`.
- If a user connects a wallet set to Futurenet, Mainnet, or a standalone local network, write operations are immediately disabled to prevent accidental transaction broadcast or nonce misuse.

---

## Static Analysis & Dependency Audits

As part of engineering verification passes:
- **Rust / Cargo**: `cargo audit` performed on `slasettle-vault`.
- **Node.js / npm**: `pnpm audit --prod` and `npm audit --omit=dev` performed on `slasettle-hub` workspace and `services/indexer`, confirming 0 known vulnerabilities.
- **Go**: `govulncheck ./...` executed across `services/watcher`, reporting 0 vulnerabilities with Go 1.25.14.
- **Secret Scanning**: Repository-wide regular regex scanning confirms zero leaked keys, mnemonic phrases, or PEM certificates across git history.
