# Phase 7 live-write verification, 2026-10-07

Stellar Testnet only, using the deployed frontend at
`https://slasettle-web.vercel.app` and a real Freighter wallet. Every
signature was approved by the wallet owner in Freighter's own popup; the
automation prepared forms and read results but never clicked the wallet's
approval. No watcher votes, SLA records or balances were fabricated.

## Configuration under test

| Item | Value |
|---|---|
| Network passphrase | `Test SDF Network ; September 2015` |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| `sla_vault` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` |
| `watcher_registry` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` |
| Hosted indexer | `https://slasettle-indexer.slasettle-indexer.workers.dev` |
| Token | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` (native SAC, symbol `native`, 7 decimals) |
| Wallet and provider | `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB` |
| Beneficiary | `GBWRREKJBIH3654KYC3SAASOZZ7RP4X65VFDX65JMPWSHLOO3XH2BIYE` |

Amounts are entered as decimal strings and converted to base units with
`BigInt` string parsing; no floating-point protocol arithmetic is involved.

## The four writes

Each was checked against Horizon Testnet (transaction successful, source
account the wallet above), a direct contract read through the SDK
(`get_sla`, `get_bond_balance`), the explorer link the app produced, and the
state the deployed frontend displayed.

### 1. Create SLA #2

- Transaction: `93eb61deb9395f241a4cb85f2d4e245efddb4d168d162bfdbef800d875ebe000`
- Ledger 5069370, 2026-10-07T10:53:57Z, fee 1393938 stroops
- Explorer: https://stellar.expert/explorer/testnet/tx/93eb61deb9395f241a4cb85f2d4e245efddb4d168d162bfdbef800d875ebe000
- Inputs: bond 5 native (50000000), penalty 1 native (10000000), quorum 3,
  uptime target 99.90% (9990 bps), beneficiary as above
- Resulting `get_sla(2)`: provider the wallet, token the native SAC, bond
  50000000, uptime 9990, quorum 3, penalty 10000000, status Active
- `get_bond_balance(2)`: 50000000
- The indexer's provider listing includes SLA 2 with this hash.

### 2. Top up SLA #2

- Transaction: `74cff0ed5b66b4bfd936b5e724ffb79e3056e3891fbbf8a8dd26dda6e7d78616`
- Ledger 5069541, 2026-10-07T11:08:12Z, fee 17866 stroops
- Explorer: https://stellar.expert/explorer/testnet/tx/74cff0ed5b66b4bfd936b5e724ffb79e3056e3891fbbf8a8dd26dda6e7d78616
- Bond before 50000000, top-up 1 native (10000000), bond after 60000000
  (`get_bond_balance`), an exact difference. The dashboard card and, after a
  fresh load, the status page both showed 6 native.

### 3. Cancel SLA #2

- Transaction: `17c5c3b91146707e9bea57275dc32f99c0949a1423579369058360e9c13e1ddb`
- Ledger 5069570, 2026-10-07T11:10:37Z, fee 16235 stroops
- Explorer: https://stellar.expert/explorer/testnet/tx/17c5c3b91146707e9bea57275dc32f99c0949a1423579369058360e9c13e1ddb
- Status before Active, after Cancelled (`get_sla(2)`); every other field
  unchanged. The bond stayed intact at 60000000, and the card then offered
  "Withdraw remaining bond" and no longer offered top-up or cancel.
- The transaction was identified as the only new transaction from the wallet
  at that time plus the resulting state change; its operation was not decoded.

### 4. Withdraw the remaining bond

- Transaction: `0687d22d77f5c30a4c611aec2308fdc957b901682273ac220acefda55ed55bfa`
- Ledger 5069595, 2026-10-07T11:12:42Z, fee 17062 stroops
- Explorer: https://stellar.expert/explorer/testnet/tx/0687d22d77f5c30a4c611aec2308fdc957b901682273ac220acefda55ed55bfa
- Bond before 60000000, after 0 (`get_bond_balance`)
- Wallet balance evidence (Horizon): 9786.5437520 XLM before the create,
  9786.3992419 XLM after the withdrawal. The difference, 0.1445101 XLM, equals
  the four fees (1393938 + 17866 + 16235 + 17062 stroops), consistent with the
  5 + 1 native moved into the bond and the 6 native returned.
- UI states captured by an observer during this flow: Preparing transaction,
  Waiting for signature in your wallet, Submitting to the network, Pending
  confirmation (with the hash), Confirmed (with the hash).

SLA #0 stayed Active with bond 410000000 throughout.

## Defects found in the live writes, and their fixes

| Finding | Fix |
|---|---|
| After a confirmed create, the dashboard re-read the indexer once and did not list SLA #2 until a manual reload | PR #24: after a create, retry every 5 s, at most 18 times, until the list grows |
| After a confirmed cancel, the card re-rendered as Cancelled and the "Confirmed" message, hash and explorer link disappeared | PR #25: the card keeps the cancel confirmation |
| After a confirmed withdrawal emptied the bond, the card still offered "Withdraw remaining bond" | PR #25: with a zero bond the card shows "nothing to withdraw" next to the confirmation and never the button |

## Redeploy and what was checked on the fixed build

- Deployment `dpl_3GiQGWRH4t59vp55cSkZD5obLQUF`, production, Ready, created
  2026-10-07 11:33:30Z, aliased to `https://slasettle-web.vercel.app`.
  Built with the cache bypassed from `main` at
  `0c1e10726e8450d2bc485d2c9528bf1bb880adb6` (includes PRs #24 and #25),
  uploaded with the Vercel CLI; the project is not Git-connected. The
  Production environment variables are unchanged and match the table above.
- The deployed JavaScript contains the new logic: the bounded retry (stop at 18
  retries, 5000 ms timer) and the zero-bond branch that renders the "nothing to
  withdraw" statement together with the transaction status.
- Deployed browser, steady state after reload: SLAs #2 and #1 are Cancelled
  with bond 0 and "nothing to withdraw" and no withdraw button; SLA #0 is
  Active with top-up and cancel.
- **Not re-exercised live:** the moment-after-transaction behaviours (the new SLA
  appearing by itself after indexing, and the cancel and withdraw confirmations
  persisting through the card's re-render) were not repeated on the fixed
  build, because that would need a new SLA and three more signed transactions.
  They are covered by regression tests that fail without the fixes, and by the
  deployed-bundle check above.

## trigger_settlement: not live-submitted

No frontend-driven settlement was submitted, because no genuine unsettled
round at quorum existed, and no watcher votes or quorum condition were
created to force one.

- Live tallies on 2026-10-07 for the checked SLAs: SLA 0, 1 and 2 had
  0 up / 0 down in the current round (29856196).
- The known round 123 of SLA 0 (0 up / 3 down, quorum 3) is already settled
  (`is_round_settled` true; settlement `70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b`,
  ledger 4964512, 2026-10-01).
- Settlement stays covered by automated tests and the historical Testnet
  evidence. This is a limitation of the network's state at the time, not a
  known defect.

## Final classification

**Fully live-verified:** deployed-origin frontend; hosted-indexer
integration; create SLA; top up bond; cancel SLA; withdraw remaining bond;
provider dashboard refresh (after reload); live SLA reads; live bond reads;
transaction confirmation; explorer evidence.

**Covered by tests, not exercised live:** wallet rejection state; failed
transaction state; unconfirmed transaction state; frontend-driven
`trigger_settlement`; and the post-transaction behaviours fixed in PRs #24
and #25 (see above).

**Partially verified:** physical-device mobile and tablet behaviour (390 px
and 820 px were checked in same-origin iframes only); the actual
`prefers-reduced-motion` media query (the rule is in the deployed CSS but the
setting could not be changed).

## Observation: one "Freighter isn't installed" flash

On one load, immediately after opening a new tab in a fresh automation window,
the dashboard briefly reported "Freighter isn't installed" while the extension
was present; the next load connected normally. Several further fresh loads
of the dashboard, three of them timed with a mutation observer, never showed
it (the header went from "Connect Wallet" to the address within about 100 ms).
It is recorded as a one-off observation. No code was changed for it.

## Related records

Supersedes the "wallet writes remain unverified" statements in
`evidence/deployed-verification-2026-10-07.md` and
`evidence/phase7-browser-pass-2026-10-07.md`, which are dated records of
earlier passes.
