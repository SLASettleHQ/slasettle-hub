# Vulnerability Reporting

The SLASettle maintainers take the security of smart contracts, off-chain infrastructure, and client applications seriously. We welcome responsible disclosure of potential security vulnerabilities.

## Scope

The following repositories and components fall within our security disclosure scope:

1. **`SLASettleHQ/slasettle-vault`**:
   - `watcher_registry` contract logic and authorization boundaries.
   - `sla_vault` escrow management, token accounting, and settlement logic.
2. **`SLASettleHQ/slasettle-hub`**:
   - `@slasettle/sdk` transaction construction and simulation logic.
   - `apps/web` wallet integration and network safety controls.
   - `services/indexer` REST API, CORS boundaries, and database query handling.
   - `services/watcher` cryptographic signing and transaction submission loop.

---

## Reporting Procedure

To report a vulnerability responsibly:

1. **Private GitHub Security Advisory**:
   - Navigate to the **Security** tab of the relevant repository (`slasettle-vault` or `slasettle-hub`).
   - Click **Report a vulnerability** to open a confidential security advisory draft.
2. **Alternative Contact**:
   - If GitHub Security Advisories are inaccessible, open a minimal issue on GitHub requesting a private communication channel. **Do not post exploit code, proof-of-concept scripts, or reproduction payloads in public issues.**

### Report Contents
Please include the following information in your advisory:
- Detailed description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal test case.
- Affected contract addresses, function names, or file paths.
- Proposed remediation or patch, if available.

---

## Response Timeline & Expectations

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days, confirming vulnerability validity and severity.
- **Remediation & Disclosure**: Coordinated patch deployment to Testnet contracts and public release notes following resolution.

---

## Current Security Status & Caveats

- **Testnet Status**: The SLASettle protocol is currently deployed exclusively to Stellar Testnet.
- **Audit Status**: The codebase has undergone comprehensive automated testing (416 tests) and internal static analysis, but has **not yet completed a formal external third-party security audit**.
- **No Active Bug Bounty**: As an open-source testnet research project, monetary bug bounties are not currently offered. We gratefully credit security researchers in our release notes and changelogs.
