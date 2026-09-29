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
matching the source exactly.

### A real, permissionless settlement, live on this deployment

- SLA 0: `bond_amount 50000000`, `penalty_per_breach 10000000`,
  `quorum_threshold 3`, beneficiary
  `GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2`.
  `create_sla` tx:
  `819dd54031a2391d9ead3dbd0a902f5fdaeb597f0914a8307cfacfecc7031083`.
- Three independent watchers voted `Down` for round 1, meeting the
  quorum of 3.
- `trigger_settlement` tx:
  `6522d8b77e135fc60154089d89b2b720d71593eed0de63916187eef16897d147`,
  called by `GAD7M6PM5XZVL2ASJBVASANMUQYLLGBCJDVQSDYIH66ORNARG2DDPNGB`
  (an account that was not the admin, provider, or beneficiary), paid
  out `10000000` stroops, `SettlementPaid` event confirmed.

The zero-balance `withdraw_remaining_bond` fix (see
[Contracts](/contracts)) was verified against a separate SLA (SLA 1) in
the same evidence run, not against SLA 0.

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

If your local hub environment configuration (`.deployed-testnet.env`)
still points at this historical pair rather than the live-verified pair
above, see [Environment variables](/environment-variables) before
running the watcher, indexer, or frontend against it.

## What is not deployed anywhere

- No public frontend deployment. `apps/web` has not been deployed to
  any hosting provider as part of this project; running it means
  running it locally.
- No public indexer deployment. The indexer's SQLite database and HTTP
  API exist only where you run them yourself.
- No mainnet deployment of either contract.

See [Deployment topology](/deployment-topology) for the full picture of
what runs where.
