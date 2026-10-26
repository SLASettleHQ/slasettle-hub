# Trust Model

SLASettle replaces bilateral trust between service providers and customers with a registered-watcher verification and on-chain settlement model. The current GREEN Testnet deployment's watcher committee is project-controlled, not independently decentralized — see below.

## Core Trust Assumptions

| Dimension | Traditional Model | SLASettle Model |
| :--- | :--- | :--- |
| **Telemetry Provider** | Service Provider's internal APM | Registered watcher committee (design); currently three project-controlled Testnet identities, not independently operated |
| **Data Integrity** | Self-reported status page | Cryptographically signed on-chain transactions |
| **Collateral Custody** | Provider's bank account | Non-custodial Soroban smart contract escrow |
| **Settlement Decision** | Discretionary customer service review | Deterministic smart contract rule: `votes_down >= quorum_threshold` |
| **Execution Trigger** | Manual provider credit voucher | Permissionless transaction executable by anyone |

## Multi-Watcher Quorum Consensus

A single external monitoring node can suffer localized routing failures, DNS misconfigurations, or cloud provider network partitions. SLASettle enforces multi-watcher consensus to eliminate single points of failure.

### Quorum Calculation (design, illustrative examples)
For an active watcher set of size $N$, a recommended quorum threshold is a strict majority:

$$\text{Quorum} = \left\lfloor \frac{N}{2} \right\rfloor + 1$$

These are worked **examples** of the formula, not deployed configurations:

- Example: 3 watchers → quorum threshold 2
- Example: 5 watchers → quorum threshold 3
- Example: 7 watchers → quorum threshold 4

**Current GREEN Testnet deployment:** 3 registered watcher identities, quorum threshold 2 — matching the first example above, but deployed, not hypothetical. All three identities are project-controlled Testnet identities created for this deployment; they are not independent or community-operated. See `watcher-model.md` for the exact addresses and `../../evidence/v0.2-production-cutover-2026-10-26.md` for live transaction evidence.

### Byzantine Fault Tolerance — what quorum 2-of-3 actually tolerates

SLASettle does not claim general Byzantine-consensus fault tolerance. With the current deployed committee (3 watchers, quorum 2):

- **One unavailable or honest-dissenting watcher does not block settlement.** If the other two watchers independently observe and attest `Down`, quorum is reached without the third watcher's vote.
- **Two colluding or compromised registered watchers can create a false `Down` quorum.** Because quorum is 2-of-3, any two of the three registered identities agreeing (honestly or not) satisfies `votes_down >= quorum_threshold` and permits settlement — the contract cannot distinguish a false quorum from a true one.
- **Watcher signatures prove which authorized identity submitted a vote. They do not prove the HTTP observation itself was performed, or performed honestly.** The endpoint commitment binds a vote to a specific endpoint; it says nothing about whether the watcher actually probed it.
- This is a materially weaker guarantee than Byzantine fault tolerance in distributed-consensus systems, where safety typically requires more than a bare majority of the full node set to be dishonest and nodes are assumed independently operated. Here, with a small, project-controlled committee, a 2-of-3 collusion is a real near-term capability, not a theoretical edge case.

## Cryptographic Attestation

Each watcher node operates as an independent actor on Stellar:
1. **Registered Identity**: Watcher addresses must be pre-authorized in `watcher_registry` by the registry admin (`register_watcher`).
2. **Transaction Signatures**: Every health check submission is signed directly by the watcher's private key (`watcher.require_auth()`).
3. **Immutability and Duplicate Prevention**: Once recorded in contract storage (`DataKey::Check(sla_id, round_id, watcher)`), a vote cannot be altered or overwritten. Attempting to resubmit returns `Error::DuplicateCheck`.

## Attack Vectors and Mitigations

### 1. Dishonest Watcher Collusion
- **Risk**: Watchers colluding with the beneficiary to trigger fraudulent penalties, or colluding with the provider to suppress outage reports. With the current deployed 2-of-3 quorum, any two of the three registered watchers collude to create a false quorum in either direction.
- **Design mitigation (not currently demonstrated)**: Requiring quorum from geographically and infrastructurally diverse, independently operated node operators would raise the cost and likelihood of collusion. This is a desired future operating model. **The current GREEN Testnet deployment uses three project-controlled watcher identities, not independent operators**, so this mitigation is not in effect today.

### 2. Provider Front-Running / Liquidity Rug Pull
- **Risk**: A provider observing impending downtime attempting to withdraw collateral before settlement executes.
- **Mitigation**: The `withdraw_remaining_bond` function strictly requires the SLA to be in `Cancelled` status. Providers cannot withdraw from an `Active` agreement. Cancelling an SLA is a public on-chain event visible to beneficiaries and watchers.

### 3. Vote Copying (No Commit-Reveal in V1)
- **Known Limitation**: Because Soroban contract state is public, a watcher submitting late in a round could observe earlier votes before submitting its own check.
- **Evaluation**: In this version, commit-reveal was omitted to prevent doubling the transaction volume and fee overhead per round. Node operators are expected to run automated daemons that submit checks immediately following probing.

### 4. Admin Privileges
- **Scope**: The admin address initialized on `watcher_registry` can register or remove watcher addresses, and pause check submissions. The admin on `sla_vault` can pause contract operations.
- **Safety Boundaries**: The admin cannot seize bonded funds, modify existing SLA parameters, redirect beneficiary addresses, or settle rounds without meeting watcher quorum.
