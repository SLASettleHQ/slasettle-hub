# Demo verification, 2026-09-29

Phase 33 (gate resolved at the end of this record). One end-to-end run of the critical workflow on the frozen
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

## Gate resolution (2026-09-30)

Three conditions were open after the first run. What was done about each, and
what remains.

### 1. Public indexer: not possible, nothing deployed

The indexer is a long-running Node process with a local SQLite file; it needs
a host that keeps a process and a persistent disk. Checked on 2026-09-30: the
only hosting credential available is the Vercel Hobby account (serverless
functions, which do not fit a polling process with a local database, and
adapting it would mean rewriting the indexer, which the freeze forbids); no
other hosting CLI, cloud credential or account was found. **No indexer was
deployed and no URL was invented.** The hosted frontend therefore still cannot
show round status or settlement history, cannot offer its settlement button, and
its indexer-dependent flows remain unverified on the hosted site. This stays a
KNOWN LIMITATION and the indexer stays unavailable.

### 2. Freighter signing prompt: not observed, stays UNVERIFIED

No signing prompt was observed and none is inferred. The write was signed and
confirmed from the Freighter-controlled account (step 6), which is established by
the on-chain transaction. The observation that a prompt was shown (and by whom
it was approved) is **UNVERIFIED**.

### 3. Watcher: one additional real daemon run, without any change

The Go watcher was built unchanged from the frozen tree (hub `2a5fc30`, `go build
./cmd/watcher`) and three daemon processes were run as real processes against
the live registry for SLA 3, one per registered watcher (watcher1 to watcher3),
all with `TARGET_URL=http://127.0.0.1:9/` (a local target that refuses
connections, so Down) and the secret key passed only through the process
environment. Their logs show, for round `29845440` (2026-09-30T00:00Z):
`check result status=Down http_code=0`, then `submitted check successfully`, then
a clean `shutting down` on `SIGTERM`. None of the three logs contains the secret
key. This run is a **daemon** run, unlike the CLI votes of step 8, which stay
recorded as CLI votes.

| # | Action | Observed | Status |
|---|---|---|---|
| 17 | Three daemon processes vote Down for SLA 3, round 29845440 | Horizon: [`3ed38bef…`](https://stellar.expert/explorer/testnet/tx/3ed38befa09c499bfe97a8654de1bf97fb612df893268a06dba1b48fda38102e) (watcher1), [`92008a86…`](https://stellar.expert/explorer/testnet/tx/92008a8658d66a0d42bfe1c2232cb08baf6689e0d7cb74b644a661da239c75d4) (watcher2), [`f1fe5682…`](https://stellar.expert/explorer/testnet/tx/f1fe56823b9a19c2744dfae5e47709706015cf0999e29609509624b9ba9c509e) (watcher3), all `successful: true`, ledger 4940564, 2026-09-30T00:00:07Z; `get_round_tally(3, 29845440)` = `{"votes_down":3,"votes_up":0}`; `has_watcher_voted` true for all three | VERIFIED |
| 18 | Read-back through a **locally run** indexer (fresh scratch database, live Testnet, not a public deployment) | `GET /v1/slas/3/current-round` returned round `29845440` with `checked_in` = the three watchers, each `down`, and no one left in `not_yet_checked_in` | VERIFIED locally (daemon-to-indexer read-back); not a public indexer |
| 19 | `trigger_settlement` by the unrelated caller `alice` for round 29845440 | tx [`e1f7e4af…`](https://stellar.expert/explorer/testnet/tx/e1f7e4aff427ba361653293adaa897bd01e2c3408a39f47f83f57a0fcb1841e4), Horizon `successful: true`, ledger 4940576, 2026-09-30T00:01:07Z, source `GAD7M6PM…`; `is_round_settled` true; bond `10000000` to `0`; beneficiary `100030000000` to `100040000000` (+10000000); vault token balance `57000000` to `47000000`; a duplicate settlement simulates as `Error(Contract, #4)` | VERIFIED |
| 20 | The local indexer's settlements for SLA 3 after the settlement | rows for round `29844968` (tx `6d3069d0…`) and round `29845440` (tx `e1f7e4af…`), each `votes_down` 3, `quorum_threshold` 3, penalty `10000000` | VERIFIED locally |
| 21 | Hosted frontend `/status/3` after the second settlement | bond balance `0 native` (= the chain's `0`); the round-status and settlement-history panels still cannot load there | VERIFIED (bond value); panels: KNOWN LIMITATION |

The payout in step 19 equalled the full penalty (bond `10000000` equalled the
penalty `10000000`), so the payout cap did not run here either: **live
payout-cap execution stays UNVERIFIED.** The local indexer process was stopped
afterward. SLA 3 now has no bond left and stays `Active`; nothing was cancelled
or withdrawn and no contract changed.

### Decision

**Phase 33 gate: PASS.**

Reasoning. The critical workflow was demonstrated with real Testnet evidence and
independently checked on the chain: the hosted frontend connected to Freighter
(checked against Freighter's own answers), a signed dashboard write created an
SLA, registered watchers voted Down (by CLI, and again by three real daemon
processes), an unrelated caller triggered settlement twice, the beneficiary was
paid, the bond and the vault balance fell by the penalty each time, a duplicate
was rejected, and the hosted frontend's bond figure equalled the chain's after
each settlement. The condition that could not be met is hosting: there is no
public indexer and no host on which to run it, so the hosted frontend's round
status, settlement history and settlement button were not exercised. Per the
brief that step applies only "if a public indexer exists", and it is documented
as a known limitation, not hidden. It does not make the on-chain workflow
unverified; it makes the hosted UI's indexer-dependent flows unverified.

### Carried forward, unchanged

- **UNVERIFIED:** the Freighter signing prompt observation; top-up, cancel and
  withdraw from the dashboard; the hosted frontend's settlement button and its
  round-status and settlement-history panels (need an indexer); narrow-viewport
  and mobile checks; a dedicated secret scan; a live wrongly-signed rejection; a
  live below-quorum rejection; a live unregistered-watcher rejection; live
  payout-cap execution; a second pagination page over more than one settled
  round per page limit; the restore path. (Daemon-to-indexer read-back, listed as
  unverified before, is now verified against a local indexer only.)
- **BLOCKED:** live zero-balance withdrawal rejection; the soroban-sdk 28.0.0
  redeploy; a permanent source-level instance-lifetime fix.
- **KNOWN LIMITATION:** no public indexer.

