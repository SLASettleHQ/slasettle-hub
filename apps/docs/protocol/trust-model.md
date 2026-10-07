# Trust Model

SLASettle replaces bilateral trust between service providers and customers with a decentralized verification and settlement model.

## Core Trust Assumptions

| Dimension | Traditional Model | SLASettle Model |
| :--- | :--- | :--- |
| **Telemetry Provider** | Service Provider's internal APM | Independent committee of registered watcher nodes |
| **Data Integrity** | Self-reported status page | Cryptographically signed on-chain transactions |
| **Collateral Custody** | Provider's bank account | Non-custodial Soroban smart contract escrow |
| **Settlement Decision** | Discretionary customer service review | Deterministic smart contract rule: `votes_down >= quorum_threshold` |
| **Execution Trigger** | Manual provider credit voucher | Permissionless transaction executable by anyone |

## Multi-Watcher Quorum Consensus

A single external monitoring node can suffer localized routing failures, DNS misconfigurations, or cloud provider network partitions. SLASettle enforces multi-watcher consensus to eliminate single points of failure.

### Quorum Calculation
For an active watcher set of size $N$, the recommended quorum threshold is a strict majority:

$$\text{Quorum} = \left\lfloor \frac{N}{2} \right\rfloor + 1$$

- **For 3 Watchers**: Quorum threshold = 2
- **For 5 Watchers**: Quorum threshold = 3 (current Testnet configuration)
- **For 7 Watchers**: Quorum threshold = 4

### Byzantine Fault Tolerance
With a 5-watcher committee:
- Up to 2 watchers can experience transient connectivity failures or behave maliciously without preventing consensus or triggering false breach settlements.
- At least 3 independent watchers must observe and attest `DOWN` within the round window before any penalty can be transferred.

## Cryptographic Attestation

Each watcher node operates as an independent actor on Stellar:
1. **Registered Identity**: Watcher addresses must be pre-authorized in `watcher_registry` by the registry admin (`register_watcher`).
2. **Transaction Signatures**: Every health check submission is signed directly by the watcher's private key (`watcher.require_auth()`).
3. **Immutability and Duplicate Prevention**: Once recorded in contract storage (`DataKey::Check(sla_id, round_id, watcher)`), a vote cannot be altered or overwritten. Attempting to resubmit returns `Error::DuplicateCheck`.

## Attack Vectors and Mitigations

### 1. Dishonest Watcher Collusion
- **Risk**: Watchers colluding with the beneficiary to trigger fraudulent penalties, or colluding with the provider to suppress outage reports.
- **Mitigation**: Requiring strict quorum from geographically and infrastructurally diverse node operators. In production, watcher identities are selected across multiple independent cloud and bare-metal providers.

### 2. Provider Front-Running / Liquidity Rug Pull
- **Risk**: A provider observing impending downtime attempting to withdraw collateral before settlement executes.
- **Mitigation**: The `withdraw_remaining_bond` function strictly requires the SLA to be in `Cancelled` status. Providers cannot withdraw from an `Active` agreement. Cancelling an SLA is a public on-chain event visible to beneficiaries and watchers.

### 3. Vote Copying (No Commit-Reveal in V1)
- **Known Limitation**: Because Soroban contract state is public, a watcher submitting late in a round could observe earlier votes before submitting its own check.
- **Evaluation**: In this version, commit-reveal was omitted to prevent doubling the transaction volume and fee overhead per round. Node operators are expected to run automated daemons that submit checks immediately following probing.

### 4. Admin Privileges
- **Scope**: The admin address initialized on `watcher_registry` can register or remove watcher addresses, and pause check submissions. The admin on `sla_vault` can pause contract operations.
- **Safety Boundaries**: The admin cannot seize bonded funds, modify existing SLA parameters, redirect beneficiary addresses, or settle rounds without meeting watcher quorum.
