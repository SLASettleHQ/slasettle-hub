# Demo verification, 2026-09-29

Phase 33. One end-to-end run of the critical workflow on the frozen
implementation (hub `bd6b9b2`, vault `caae637`) against live Stellar Testnet.
Every on-chain fact below was read from Testnet directly (Horizon, Soroban RPC
simulation, the token contract and `getEvents`), not from the browser UI.

Hosting truth for this run: frontend https://slasettle-web.vercel.app and
documentation https://slasettle-docs.vercel.app are personal-account
`*.vercel.app` deployments made by hand; the public indexer is **unavailable**,
so nothing below claims an indexer result. Explorer form:
`https://stellar.expert/explorer/testnet/tx/<hash>`.

Accounts: admin and provider `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`
(the Freighter account); beneficiary `GBAKUA3AN6MNXF6RREUBQRN3Z6JKT3IH5O6T3WUK3JRYVIWFN45XNVJ2`;
watchers 1 to 3 (`GA4WTXER…`, `GA5Q22PH…`, `GAHCWLHJ…`, registered in the
2026-09-27 evidence); settlement caller `alice`
`GAD7M6PM5XZVL2ASJBVASANMUQYLLGBCJDVQSDYIH66ORNARG2DDPNGB`, which is not the
admin, provider, beneficiary or any watcher. Contracts: `watcher_registry`
`CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`, `sla_vault`
`CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL`, token the native
XLM contract `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

## Steps

| # | Action | Expected | Observed | Status |
|---|---|---|---|---|
| 1 | Open the hosted frontend: `/`, `/dashboard`, `/status/0` (browser, over HTTPS) | pages load, network badge reads Testnet | all three loaded; badge reads "Testnet"; the header's wallet control read "Connect Wallet" | VERIFIED |
| 2 | Click "Connect Wallet" on the hosted origin `https://slasettle-web.vercel.app/dashboard` | Freighter connects | the control passed through "Connecting…" and then showed `GBWM…2UPB` | VERIFIED |
| 3 | Ask Freighter itself (window message to the extension's content script) for connection status, public key and network | the answers match what the app shows, so the app is not inferring the wallet | `isConnected: true`; `publicKey` `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`; network `TESTNET`, passphrase `Test SDF Network ; September 2015` | VERIFIED (hosted-origin Freighter connection, previously UNVERIFIED) |
| 4 | Read state before any write (Soroban simulation, `--send=no`) | no SLA 3 | `get_sla(3)` returned `Error(Contract, #9)` (`SlaNotFound`) | VERIFIED |
| 5 | Dashboard write: fill the Create SLA form (token native XLM, beneficiary `GBAKUA3A…`, bond 2, penalty 1, quorum 3, uptime 99.90) and submit | the app builds the transaction, the wallet signs it, it is submitted and confirmed | the page showed "Confirmed — 672ed6…394786"; the link on the page is [`672ed642f7f5b98e473b71f17792af8348226163ded8a233b3f7d74074394786`](https://stellar.expert/explorer/testnet/tx/672ed642f7f5b98e473b71f17792af8348226163ded8a233b3f7d74074394786). A first click, made while the browser tool had lost its connection, produced no transaction: only one transaction from the admin account exists after the lifetime extensions | see step 6 |
| 6 | Verify step 5 on Testnet, independently of the page | a successful `create_sla` from the Freighter account | Horizon: `successful: true`, ledger 4934875, created 2026-09-29T16:06:02Z, source `GBWM5N2S…2UPB`, one `invoke_host_function`; `get_sla(3)` = provider `GBWM5N2S…`, beneficiary `GBAKUA3A…`, token native, bond `20000000`, penalty `10000000`, quorum `3`, `uptime_target_bps` `9990`, status `Active`; `get_bond_balance(3)` `20000000`; the vault's token balance went to `67000000` (46000000 + 1000000 + 20000000); `getEvents` shows `sla_created` `["3", GBWM5N2S…]` in that transaction; `get_sla(4)` is `#9`, so exactly one SLA was created | VERIFIED (signed dashboard write on the hosted frontend: `create_sla`) |
| 7 | Watcher check: a real HTTP check of a target that is down (`http://127.0.0.1:9/`), the same up-or-down rule the watcher uses | Down | `curl` returned code `000` (connection refused), so Down; the endpoint hash used is SHA-256 of that URL, `0aaac99222ebe069f2a940756a599dbc7652852f30a62e8ab0818d71efee0000` | VERIFIED for this check; the target is a local demonstration target, not a service |
| 8 | Three registered watchers submit `Down` for SLA 3, round `29844968` (the wall-clock round at 2026-09-29T16:08:11Z, `floor(unix/60)`), by Stellar CLI (not the Go daemon in this run) | tally `{0 up, 3 down}` | txs [`c6414440…`](https://stellar.expert/explorer/testnet/tx/c6414440f0cecd10f5c4e81d5b87c417ad15131255a1afe8118ffd79ff66012c) (watcher1), [`b5d08f9e…`](https://stellar.expert/explorer/testnet/tx/b5d08f9ee801e58d0f4dddbe5d9aa145d6fad0fcf331775490e660c42752a7e7) (watcher2), [`b9d7976d…`](https://stellar.expert/explorer/testnet/tx/b9d7976df79d12cdce230934ee635e9a6ee2621150a8b05c77e5302449e0f618) (watcher3); `get_round_tally(3, 29844968)` = `{"votes_down":3,"votes_up":0}` | VERIFIED |
| 9 | State before settlement | round not settled | `is_round_settled(3, 29844968)` `false`; bond `20000000`; beneficiary token balance `100020000000` | VERIFIED |
| 10 | `trigger_settlement` by an unrelated caller (`alice`), CLI | quorum of 3 met, payout of the 1 XLM penalty | tx [`6d3069d04218b32ab1ffb75ec43c57f9bdd9e822bbb9253f489d09476d90b018`](https://stellar.expert/explorer/testnet/tx/6d3069d04218b32ab1ffb75ec43c57f9bdd9e822bbb9253f489d09476d90b018), Horizon `successful: true`, ledger 4934915, 2026-09-29T16:09:22Z, source `GAD7M6PM…` (alice) | VERIFIED |
| 11 | Verify the settlement on Testnet | round settled; bond down by the penalty; beneficiary up by the penalty | `is_round_settled` `true`; `get_bond_balance(3)` `10000000` (−10000000); beneficiary balance `100030000000` (+10000000); the vault's token balance `57000000` (−10000000); `getEvents` shows `settlement_paid` `["3", "29844968"]` with `payout` `10000000` and beneficiary `GBAKUA3A…` in that transaction | VERIFIED |
| 12 | Duplicate settlement (simulation, `--send=no`) | rejected | `Error(Contract, #4)` (`AlreadySettled`) | VERIFIED |
| 13 | Frontend after settlement: `/status/3` in the browser | shows the configuration and the reduced bond, matching Testnet | shows SLA #3 Active, provider `GBWM…2UPB`, beneficiary `GBAK…NVJ2`, token native, **bond balance `1 native`** (= 10000000 stroops, equal to step 11), penalty `1 native`, quorum `3 Down votes` | VERIFIED |
| 14 | Frontend round status and settlement history | need the indexer | both panels show "NEXT_PUBLIC_INDEXER_API_URL is not set": no public indexer exists, so the settlement row and the round tally were **not** shown by the frontend and were checked on Testnet only | KNOWN LIMITATION (indexer unavailable) |
| 15 | Trigger settlement from the frontend's button | needs the round status, which needs the indexer | not possible on the hosted site; settlement was done with the CLI (step 10) | KNOWN LIMITATION |
| 16 | Indexer behavior for this settlement | needs a public indexer | not exercised; a local indexer would not be a public deployment and was not used | UNVERIFIED |

## What the demo does and does not establish

- **Now VERIFIED by this demo:** Freighter connection on the hosted origin
  (checked against Freighter's own answers), and one signed dashboard write on
  the hosted frontend (`create_sla`), confirmed and read back on Testnet. Then a
  full path on live state: create, three watcher votes, settlement by an
  unrelated caller, payout to the beneficiary, bond reduction, duplicate
  rejection, and the frontend's bond value equal to the chain's.
- **Not observed:** I did not see a Freighter signing prompt. The write was
  signed and confirmed without any interaction from me in the page or the
  extension window; whether the extension asked the user or the origin was
  already authorized to sign is not established here. The signature is
  established by the successful on-chain transaction with the Freighter account
  as its source.
- **Still UNVERIFIED (not covered by this run):** top-up, cancel and
  withdraw from the dashboard; the frontend's own settlement button; narrow-viewport
  and mobile checks; a dedicated secret scan; a live wrongly-signed rejection; a
  live below-quorum rejection; a live unregistered-watcher rejection; live
  payout-cap execution (this settlement paid the full penalty from a larger
  bond, so the cap did not run); a second pagination page; daemon-to-indexer
  read-back; the restore path.
- **BLOCKED:** live zero-balance withdrawal rejection; the soroban-sdk 28.0.0
  redeploy; a permanent source-level instance-lifetime fix.
- **State left on Testnet:** SLA 3 stays active with `10000000` (1 XLM) of bond
  left; its round `29844968` is settled. Nothing was cancelled or withdrawn.
  The live contracts were not changed and nothing was redeployed. The votes in
  round `29844968` add three `check_submitted` events to the registry.
- **Method notes:** on-chain values came from Horizon, `stellar contract invoke
  --send=no` simulations, the token contract's `balance`, and `getEvents`
  decoded with the indexer's own decoder. The frontend's numbers were compared
  with those, not used as proof.
