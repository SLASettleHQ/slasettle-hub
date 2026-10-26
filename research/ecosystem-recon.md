# Ecosystem recon — 2026-10-26

This search looked beyond exact-name matches and compared execution model,
escrow, observation/oracle input, automation, settlement, and deployment
evidence. Links were inspected on **2026-10-26**. A public repository or program
listing is not evidence of production adoption or security.

## Search result

No exact end-to-end equivalent to SLASettle v0.2 was identified in the searched
set. That is not a claim that none exists. In particular, **ApexChainx is a
materially similar Stellar/Soroban SLA project** and makes any broad “first,”
“only,” or category-unique claim unsupportable.

## Meaningful comparators

| Project | What it actually does | Overlap | Important difference / redundancy assessment |
|---|---|---|---|
| [ApexChainx Contracts](https://github.com/ApexChainx/ApexChainx-Contracts) | Soroban contracts for deterministic SLA calculation, payment escrow, and multi-party settlement using severity, MTTR, thresholds, rewards, and penalties. | Stellar, SLA evaluation, escrow, deterministic settlement, contract evidence. | The strongest direct comparator found. Its published model consumes outage/MTTR inputs and coordinates through a backend; SLASettle v0.2 binds an HTTP endpoint commitment and counts per-round registered-watcher votes, with a direct Web/SDK contract path. It does not make SLASettle redundant, but materially narrows any differentiation claim. |
| [Trustless Work smart contracts](https://github.com/Trustless-Work/trustlesswork-smart-contract-stellar) and [API documentation](https://docs.trustlesswork.com/trustless-work/api-rest/introduction) | General Stellar/Soroban escrow infrastructure for funding, milestones, approvals, releases, and disputes. | On-chain custody, conditional token release, independently inspectable contracts. | A mature adjacent escrow rail, not endpoint monitoring or watcher-quorum SLA evaluation. SLASettle could conceptually have used a generic escrow, but its v0.2 condition and tally logic are domain-specific. |
| [Reflector Oracle](https://reflector.network/docs) | Stellar oracle network publishing asset-price data through Soroban-compatible interfaces. | Off-chain observations, multiple data providers/nodes, on-chain consumable results. | Demonstrates an oracle pattern on Stellar but serves price data, not HTTP uptime, SLA configuration, or collateral settlement. It is complementary rather than redundant. |
| [Soroban Keeper Network](https://github.com/soroban-tooling/soroban-keeper-network) | A Soroban-native keeper/upkeep experiment using task rewards for contract automation. | Permissionless execution and the missing “someone calls settlement” operational concern. | Generic automation rather than SLA semantics. It highlights that SLASettle's permissionless settlement is not the same as an automatic scheduler. |
| [Skeeper](https://communityfund.stellar.org/project/skeeper-a-keeper-platform-8rf) | SCF-listed infrastructure for automated Soroban contract execution. | Potential keeper/automation layer. | Complementary infrastructure; it does not supply endpoint commitments, watcher votes, SLA escrow, or the v0.2 lifecycle. |
| [Chainlink Automation](https://docs.chain.link/chainlink-automation/introduction) and [Chainlink Runtime Environment](https://docs.chain.link/cre/overview) | General decentralized/off-chain workflow and automated transaction execution infrastructure. | Monitoring/oracle/keeper patterns and chain-triggered actions. | Broader, non-Stellar-specific infrastructure. It could support a different design but is not an implemented equivalent to SLASettle's Soroban contracts and current stack. |
| [Cadence](https://github.com/assmore22/cadence) | A service-agreement system using evidence, review, challenge, and settlement concepts on GenLayer. | Service commitments, evidence, dispute/settlement concepts. | Different chain and adjudication model; not binary HTTP observations by a registered watcher quorum. |
| [SLAStream](https://github.com/dmustapha/slastream) | Proof-gated payments for storage-provider service using Filecoin-related proofs and Starknet settlement. | Service-performance condition plus conditional payout. | A materially adjacent category, but its storage proofs, chains, and trust model differ from HTTP watcher attestations. |

## Drips Wave and public ecosystem scope

The [Drips Wave program](https://www.drips.network/wave) and its
[maintainer rules](https://docs.drips.network/wave/maintainers/participating-in-a-wave/)
describe public repository review and appeals after substantive change. The
[public organization directory](https://www.drips.network/wave/orgs) was also
searched; it is broad and includes organizations associated with escrow and SLA
work, including Trustless Work and ApexChainx. The directory does not, by
itself, prove that a particular repository is approved, technically equivalent,
maintained, or deployed. It was therefore used for discovery, not as a product
comparison verdict.

## SLASettle's evidenced differentiation

The defensible unit of comparison is the implemented v0.2 combination:

- endpoint commitment using a documented domain-separated SHA-256 algorithm;
- a registered watcher registry and one vote per watcher per SLA/round;
- tallies isolated by endpoint commitment;
- collateral escrow and permissionless per-round settlement;
- a direct-contract TypeScript SDK and Web UI;
- a Go watcher with endpoint preflight, round lookup, and retry behavior;
- a Cloudflare Worker/D1 event indexer; and
- public Testnet contracts, hosted services, lifecycle transactions, releases,
  and reproducible Wasm hashes.

Individual elements are common, and ApexChainx overlaps the core “SLA plus
escrow on Soroban” proposition. The narrower differentiation is SLASettle's
endpoint-bound, round-based watcher-attestation implementation and its
source-to-live evidence bundle—not the invention of on-chain escrow, oracles,
automation, or programmable SLA settlement.

## Limitations that affect comparison

The current watcher committee is three project-controlled Testnet identities.
There is no commit-reveal, per-SLA watcher set, cryptographic proof of truthful
HTTP observation, cumulative use of `uptime_target_bps`, automatic settlement
scheduler, Mainnet deployment, or independent third-party security audit.
These limitations mean the deployed prototype does not establish decentralized
monitoring, adversarial robustness, production readiness, or market adoption.

## Search boundary

The search included Stellar/Soroban SLA, escrow, oracle, and keeper projects;
general monitoring/automation patterns; service-credit and uptime projects;
public Drips Wave discovery surfaces; and GitHub projects with materially
similar settlement language. Repositories that matched only a keyword but did
not implement escrow, monitoring/oracle input, or conditional settlement were
not treated as meaningful comparators.
