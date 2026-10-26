# Problem validation — 2026-10-26

This is a research record, not a demand, adoption, or market-size claim. It
separates public sources from evidence produced by SLASettle and from design
inferences. Sources were accessed on **2026-10-26**.

## Public research

| Source | Publisher | What it establishes |
|---|---|---|
| [How to Read a Service-Level Agreement (SLA)](https://learn.microsoft.com/en-us/azure/reliability/concept-service-level-agreements) | Microsoft Learn | A cloud SLA is a conditional commitment with definitions, exclusions, service-credit tiers, and claim deadlines. Providers generally do not apply credits proactively: the customer detects the breach, documents it, and files a claim. |
| [AWS Compute Service Level Agreement](https://aws.amazon.com/compute/sla/) | Amazon Web Services | Credits depend on monthly uptime tiers. A claimant must open a support case and supply dates, affected resources, logs, and corroborating material within the stated period; exclusions apply and credits are the stated remedy. |
| [Google Cloud Observability SLA](https://cloud.google.com/operations/sla) | Google Cloud | Credits depend on monthly uptime and require a timely customer request. Google evaluates disputes using its logs and records, illustrating that the provider remains an important measurement and adjudication party. |
| [Request credit for service outages](https://learn.microsoft.com/en-us/partner-center/billing/request-credit) | Microsoft Learn | A credit request is an operational workflow involving evidence, outage identifiers, customer information, and deadlines rather than an automatic transfer at the moment of failure. |
| [Contract interactions](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-interactions/overview) | Stellar Development Foundation | Soroban contracts are independently callable; contract Wasm is obtained from ledger state and executed by the host. |
| [Contract lifecycle](https://developers.stellar.org/docs/learn/fundamentals/contract-development/contract-lifecycle) and [contract events](https://developers.stellar.org/docs/build/guides/events/publish) | Stellar Development Foundation | Contract calls succeed or fail atomically, while ledger entries and emitted events make contract state transitions observable. |
| [Classic asset transition](https://developers.stellar.org/docs/build/guides/basics/classic-transition) and [Soroban Asset Contract design](https://stellar.org/blog/developers/sorobans-technical-design-decisions-learnings-from-ethereum) | Stellar Development Foundation | Stellar assets can be exposed through a standard contract interface, allowing contract-controlled token balances and transfers. |

These sources support a narrow operational problem: conventional service
credits often require retrospective measurement, evidence collection, a claim,
and provider-side review. They do **not** establish that every SLA works this
way, that customers reject those processes, or that there is measured demand
for SLASettle.

## What problem does SLASettle address?

SLASettle addresses a particular slice of SLA enforcement: a provider can lock
token collateral against an endpoint commitment; registered watchers can record
binary observations for ledger-derived rounds; and, when enough `Down` votes
exist for the committed endpoint, anyone can invoke deterministic settlement.
The transfer and its inputs are then visible in contract state and events.

The relevant contrast is not “paper contract versus blockchain.” A conventional
service can monitor an endpoint, calculate availability, maintain an escrow
balance in a database, and issue credits. The conventional operator, however,
normally controls the monitor, database, payout process, and account from which
the credit is issued. SLASettle moves collateral custody and the settlement rule
into independently callable contracts. A provider or hosted Web/indexer outage
does not, by itself, give that operator authority to rewrite the contract tally
or prevent another account from calling settlement.

That change is load-bearing for these implemented properties:

- collateral is held by the `sla_vault` contract rather than merely promised;
- a successful settlement transfer follows deterministic contract conditions;
- Stellar assets are transferred through the token contract interface;
- settlement is permissionless once the on-chain quorum condition is met;
- agreement, vote, tally, settlement, cancellation, and withdrawal state is
  observable from the ledger and events;
- contracts can be called without the SLASettle Web or indexer; and
- deployed Wasm can be fetched and compared with a reproducible build hash.

Stellar Testnet also makes experimentation inexpensive, but low-cost Testnet
experimentation is not itself a production-security or adoption claim.

## Plausible users — design inference, not adoption evidence

The mechanics could be useful to an API or infrastructure provider willing to
post collateral, a customer or beneficiary that wants a pre-funded remedy, a
marketplace that needs a machine-readable service bond, an operator of a
watcher service, or an integrator that wants to embed settlement through the
SDK. These are plausible actor roles derived from the design. No interviews,
customers, users, partnerships, revenue, or demand metrics have been verified.

## SLASettle project evidence

The project evidence demonstrates an implemented Testnet prototype rather than
market validation:

- two deployed Soroban contracts with reproducible v0.2 Wasm hashes;
- endpoint-bound agreements, one vote per watcher per SLA/round,
  endpoint-isolated tallies, collateral, and per-round settlement;
- a TypeScript SDK, Next.js Web application, Go watcher, and Cloudflare
  Worker/D1 event indexer;
- a public GREEN Testnet stack and a browser/Freighter lifecycle covering
  create, top-up, watcher quorum, settlement, cancel, and withdraw; and
- 595 automated tests across the Vault and Hub components.

The authoritative links are the [v0.2 production-cutover record](../evidence/v0.2-production-cutover-2026-10-26.md),
the [current Testnet lifecycle](../apps/docs/testnet-deployment.md), and the
[Vault v0.2 deployment record](https://github.com/SLASettleHQ/slasettle-vault/blob/main/evidence/testnet-v0.2-2026-10-26.md).

## What v0.2 solves, and what it does not

v0.2 solves the narrow execution problem it implements: pre-funded collateral,
endpoint-bound watcher votes, deterministic quorum checking, permissionless
per-round settlement, and a traceable Testnet lifecycle. It reduces dependence
on the provider to voluntarily calculate and issue the specific on-chain
penalty after the recorded quorum condition exists.

It does not solve whether an observation is truthful. Endpoint commitment binds
a vote to an endpoint commitment; it is not cryptographic proof that a watcher
made an honest HTTP request. The current three watcher identities are
project-controlled. The registry is shared globally, voting has no
commit-reveal scheme, and `uptime_target_bps` is descriptive rather than a
cumulative accounting rule. Settlement is per round and permissionless, not
automatically scheduled. The system is Testnet-only, has no independent
third-party security audit, and has no independently verified adoption or
economic demand.

Consequently, the research supports “implemented experiment addressing a real
class of manual SLA-credit workflow,” not “validated business,” “trustless
monitoring,” or “complete replacement for conventional SLAs.”
