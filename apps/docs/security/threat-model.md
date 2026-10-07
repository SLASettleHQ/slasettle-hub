# Threat Model

This document outlines the threat modeling assessment for the SLASettle protocol, identifying potential adversaries, attack vectors, and implemented architectural mitigations.

## Protected Assets

1. **Escrow Collateral (`BondBalance`)**: Token funds deposited into `sla_vault` backing active agreements.
2. **Beneficiary Payout Rights**: Legitimate compensation owed to beneficiaries during verified outages.
3. **Attestation Integrity (`RoundTally`)**: On-chain consensus records reflecting true external endpoint availability.
4. **Watcher Registry Authority**: The integrity of the authorized watcher committee.

---

## Adversary Profiles & Attack Scenarios

### 1. Dishonest Service Provider

| Attack Scenario | Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Premature Collateral Draining** | Provider attempts to withdraw collateral while an SLA is actively breached or under monitoring. | `withdraw_remaining_bond` requires the agreement to be `Cancelled`. Providers cannot withdraw from an `Active` SLA. |
| **Unauthorized Top-Up Hijacking** | An attacker attempts to manipulate or redirect an SLA's bond. | `top_up_bond` strictly validates `caller == SLAConfig.provider`. |
| **Zero-Quorum Exploit** | Provider configures an SLA with `quorum_threshold = 0` to trigger arbitrary behavior. | `create_sla` enforces `quorum_threshold > 0` (`Error::InvalidAmount`). |
| **Excessive Penalty Creation** | Provider creates an agreement where `penalty_per_breach > bond_amount`. | `create_sla` rejects configurations where penalty exceeds bond. |

---

### 2. Malicious Beneficiary / Hostile Customer

| Attack Scenario | Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **False Outage Forgery** | Beneficiary attempts to trigger settlements when the service is healthy. | Settlement requires `votes_down >= quorum_threshold`. A beneficiary cannot trigger settlement without multi-watcher consensus. |
| **Repeat Settlement Exploitation** | Beneficiary attempts to settle the same downtime round multiple times to drain the bond. | The vault sets `DataKey::SettledRounds(sla_id, round_id) = true`. Repeat calls reject with `Error::AlreadySettled`. |
| **Target Endpoint Denial of Service (DDoS)** | Beneficiary launches volumetric DDoS attacks to induce artificial downtime. | Out-of-band operational risk. Providers must implement resilient edge DDoS protection (e.g., Cloudflare, AWS Shield) for monitored endpoints. |

---

### 3. Byzantine or Colluding Watchers

| Attack Scenario | Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Single Rogue Node Attestation** | A compromised watcher broadcasts false `DOWN` checks. | A single vote cannot trigger settlement; requires strict quorum ($M$ of $N$, e.g. 3 of 5). |
| **Duplicate Vote Flooding** | A watcher attempts to cast multiple votes to forge quorum alone. | `submit_check` tracks `DataKey::Check(sla_id, round_id, watcher)` and rejects subsequent submissions with `Error::DuplicateCheck`. |
| **Vote Copying (Front-Running)** | A watcher inspects pending mempool or confirmed ledger transactions and mirrors the majority vote. | Known v1 limitation (no commit-reveal). Mitigated by watcher node diversity and strict committee curation. |
| **Unregistered Submissions** | An unauthorized third-party submits health checks. | `submit_check` enforces `is_watcher(caller)` (`Error::NotAWatcher`). |

---

### 4. Rogue Keepers / Public Observers

| Attack Scenario | Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Settlement Front-Running / Griefing** | A bot invokes `trigger_settlement` before the beneficiary. | Settlement is **permissionless by design**. Anyone can trigger it, but the contract always directs the payout strictly to the registered `beneficiary`. |
| **Reentrancy Attacks** | Caller attempts reentrant calls during token transfer. | State updates (decrementing bond balance and marking `SettledRounds`) execute before event publishing and follow Soroban reentrancy protections. |
