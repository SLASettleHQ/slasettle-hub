# Current Testnet deployment

Everything on this page is Stellar Testnet. Nothing described anywhere
in this documentation is deployed to Stellar mainnet.

## The soroban-sdk 28.0.0 vs. 27.0.6 mismatch — stated plainly

This is the most important fact on this page.

- `slasettle-vault`'s current source (`Cargo.toml`) depends on
  `soroban-sdk = "28.0.0"`, merged via a Dependabot PR.
- The contracts actually live and verified on Testnet below were built
  and deployed with `soroban-sdk 27.0.6`, **before** that Dependabot PR
  was merged.
- These are not the same build. The current source has not been
  rebuilt and redeployed against 28.0.0, and this documentation phase
  does not do that either — resolving this mismatch, redeploying, or
  changing SDK versions is explicitly out of scope here. See
  [Limitations](/limitations).
- If you build `slasettle-vault`'s current source yourself today, the
  resulting WASM will not match the hashes below, because it will be
  built with 28.0.0.

## Live, verified deployment (built with soroban-sdk 27.0.6)

Source: `slasettle-vault/evidence/testnet-2026-09-27.md`.

| Contract | Contract ID | WASM hash |
|---|---|---|
| `watcher_registry` | `CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6` | `4c626d2c62e6f9b56b271e1a19798d2530c355b16724ff4e53c1e6ac6a3e4c6e` |
| `sla_vault` | `CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL` | `6909713244bf5837954b8d584343e2136bd7570a10da8db7b30533e613b67830` |

- Network: Testnet, passphrase `Test SDF Network ; September 2015`
- RPC: `https://soroban-testnet.stellar.org`
- Token used: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
  (the native XLM Stellar Asset Contract on Testnet)
- Admin: `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`

This deployment includes the `quorum_threshold == 0` fix (see
[Contracts](/contracts)) and the interface was independently confirmed
via `stellar contract info interface` against the live network,
matching the source as of 2026-09-27.

### Re-checked on 2026-09-29 (read-only)

- The on-chain WASM of both contracts was re-downloaded
  (`stellar contract fetch`) and its SHA-256 equals the WASM hash in the
  table above, for both contracts.
- A build of `slasettle-vault`'s current `main` (soroban-sdk 28.0.0)
  exposes the same functions, structs, enums, errors and events as the
  live contracts. The only difference in the contract spec is that the
  live contracts' spec also lists their private `DataKey` storage-key
  type, which the 28.0.0 build omits.
- Live reads still match the evidence: `watcher_registry.get_watcher_count`
  is `5`, `sla_vault.get_sla(0)` returns the fields listed below,
  `is_round_settled(0, 1)` is `true`, and `get_bond_balance(0)` is
  `46000000` (`50000000` − `10000000` settled + `5000000` and `1000000`
  topped up).

Interface parity (the point above) is not byte-for-byte artifact parity:
the same source compiled under different Rust versions produces
different WASM hashes (`5a5ee41b…` locally with rustc 1.97.1 versus
`2f958b86…` in CI with rustc 1.98.1, both at vault `8449bd7`), so a rebuild from source cannot be
expected to reproduce a deployed hash unless the toolchain is also
pinned. The hash also changes with any source edit, including doc
comments, because doc strings are embedded in the contract spec (CI's hash
at vault `8d9c517`, a comment-only change, is `951f28b5…`). That is a
documented limitation, not an interface mismatch.

The full record is `evidence/parity-matrix-2026-09-29.md` in the hub
repository, section 6.

### Lifetime extension, 2026-09-29 (operational, not a redeployment)

The current source never extends the lifetime of instance storage, and the
live instances and code entries were due to expire about 2026-10-05
(ledgers 5026542 to 5026618, read at ledger 4932484). On 2026-09-29 they were
extended with `stellar contract extend --ledgers-to-extend 3000000`
(Stellar CLI 27.0.0, Testnet, source account: the admin identity; no key was
exposed). Only lifetimes changed.

| Entry | Transaction | Ledger | Live until before | Live until after |
|---|---|---|---|---|
| `watcher_registry` instance | `b8601edc018bc487355fb086ea719369e4f543f951fc26da3e8777021bb8fec0` | 4932489 | 5026543 | 7932489 |
| `sla_vault` instance | `1e2b750d8b84ff3f672f9ecca240eb78432f87abaa3f9b0dc1b56a381a5e07c8` | 4932493 | 5026618 | 7932493 |
| `sla_vault` WASM code | `9efdb520759d278a990ba481b59e10bbee6a67c2017e9961f9af0bc848631281` | 4932495 | 5026617 | 7932495 |
| `watcher_registry` WASM code | `a130b4f30b641a4cdae1e671c7f5d89b1ca7f04359b6f8a7561e1288d599fdff` | 4932497 | 5026542 | 7932497 |

Afterwards the WASM SHA-256 of both contracts was unchanged (`4c626d2c…`,
`69097132…`), `get_watcher_count` still read `5`, `get_sla(0)` and
`get_bond_balance(0)` (`46000000`) still returned the same values. This
does not change the source: the current source still has no instance
lifetime extension, so the live lifetimes need maintenance (about
174 days from 2026-09-29), and a permanent fix requires a contract build and
redeployment. Persistent entries were not part of that first extension; see the
next subsection. See [Limitations](/limitations).

#### Persistent entries, same day

The live workflow's persistent entries were then extended the same way
(`stellar contract extend --id <contract> --key-xdr <ScVal key>
--ledgers-to-extend 3000000`, admin identity, no state changed). All twelve
transactions succeeded:

| Entry | Transaction | Ledger | Live until |
|---|---|---|---|
| registry `Watcher` GA4WTX… | `78f0ec307be7aed964475cc45927a9bab747b744cf5bcf45ea0119aac7c97cc4` | 4932956 | 7932956 |
| registry `Watcher` GA5Q22… | `8e0bb30408bface606ba7f420a15372194de9ed9119d28cf1a904d7ccf025379` | 4932958 | 7932958 |
| registry `Watcher` GAHCWL… | `4864446b362ce2ae1e54d0a77b2145fc6eabfb091c8ca7c5ec977bafb7e3a171` | 4932960 | 7932960 |
| registry `Watcher` GAEYRU… | `2648644c5c3a70adc44b588503ebf4d4022a9fccc71591df376c17cefd356b85` | 4932962 | 7932962 |
| registry `Watcher` GBQXFO… | `6f00e768c6e1935296cd534970526bf15ff33b89fe85586850064ed0f9661441` | 4932965 | 7932965 |
| vault `Sla(0)` | `f4bbc75a9d02008e319d56843aef849137bffa9b7ccf0cf79683fe815c0c9e0e` | 4932968 | 7932968 |
| vault `BondBalance(0)` | `0a6203f7a805daecc42e9f244c4f3a7bb3be97f467675888c93e38b579c84693` | 4932970 | 7932970 |
| vault `Sla(1)` | `ead7bdd9cc7f5cf65ce6e71e7facb072d426c0be4fc2d8dafdccde07d1303329` | 4932972 | 7932972 |
| vault `BondBalance(1)` | `80096747ccafbec06c16ad761cc25527b6c8c60503627f5b0818fe5d3d06bef7` | 4932975 | 7932975 |
| vault `Sla(2)` | `32270cb587bc18b37ca7f14a9bcad627bd7860ad5dc44df4aa7a44a8ff1894df` | 4932977 | 7932977 |
| vault `BondBalance(2)` | `05d13fa81ab0fe352cc5b7deb4b5bd3693a47bc0634cfc5808c4a12568d0b5c4` | 4932979 | 7932979 |
| vault `SettledRounds(0,1)` | `e6e0661a2dd8f1bea014ad3236c9040c659b8c3f4f64e1f2dd100b778fae8ad5` | 4932981 | 7932981 |

Vote-history entries (tallies and per-watcher check records for the evidence
rounds) were not extended.

### What the live build is missing compared to current source

The current `slasettle-vault` source differs from what is deployed in
two ways that are not visible in the interface: it is built with
soroban-sdk 28.0.0 (the live build used 27.0.6), and it rejects a
repeat `withdraw_remaining_bond` on an empty bond (see below). Neither
has been deployed or re-verified live.

### A real, permissionless settlement, live on this deployment

- SLA 0: `bond_amount 50000000`, `penalty_per_breach 10000000`,
  `quorum_threshold 3`, beneficiary
  `GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2`.
  `create_sla` tx:
  `819dd54031a2391d9ead3dbd0a902f5fdaeb597f0914a8307cfacfecc7031083`.
- Three registered watchers voted `Down` for round 1, meeting the
  quorum of 3.
- `trigger_settlement` tx:
  `6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147`,
  called by `GAD7M6PM5XZVL2ASJBVASANMUQYLLGBCJDVQSDYIH66ORNARG2DDPNGB`
  (an account that was not the admin, provider, or beneficiary), paid
  out `10000000` stroops, `SettlementPaid` event confirmed.

The zero-balance `withdraw_remaining_bond` rejection (see
[Contracts](/contracts)) is **not** part of this deployment. It was
written the day after this deployment (`slasettle-vault` commit
`99be8a1`, 2026-09-28) and is TESTED LOCALLY only. What the evidence run
recorded on a separate SLA (SLA 1) is the *pre-fix* behavior: a repeat
withdrawal on an already-empty bond succeeded as a no-op and emitted a
`bond_withdrawn` event with `amount: 0` (tx
`0dbbb2e82da901912ec1cc55e2d05e33cee3ff73e9b74301ec9a7632ba328deb`).

## Historical deployment (predates the quorum-zero fix)

These contract IDs were deployed in an earlier session, before the
`quorum_threshold == 0` fix existed in source. They remain live on
Testnet, were not modified or redeployed, and their own prior evidence
(a settlement against the un-fixed source) is still valid as evidence
of that earlier state — but they must not be treated as verification of
the current, fixed contract logic.

| Contract | Contract ID |
|---|---|
| `watcher_registry` | `CBEZ3XBIWK2AWYGZRNDGNZG3AZTJHFMQL5HVWTEUZZ5HLSCO4QDFJB77` |
| `sla_vault` | `CBA4DFNUBVCPLEAUD5O2CHSUB6DRWUNM7A537EBVPAGDETFBB2CABXI2` |

`slasettle-vault`'s untracked, local `.deployed-testnet.env` still holds
this historical pair. If any hub `.env` or `.env.local` you use was
copied from it, see [Environment variables](/environment-variables)
before running the watcher, indexer, or frontend against it.

## What is not deployed anywhere

- The frontend and this documentation are hosted on Vercel since 2026-09-29
  (see [Deployment topology](/deployment-topology)); the frontend has no
  indexer.
- No public indexer deployment. The indexer's SQLite database and HTTP
  API exist only where you run them yourself.
- No mainnet deployment of either contract.

See [Deployment topology](/deployment-topology) for the full picture of
what runs where.
