# Limitations

Every item here is real and currently true. None are hypothetical
future risks; each is either a disclosed design gap in the contracts or
a verification step that genuinely has not happened yet.

## Contract-level, by design (not bugs)

- **No commit-reveal for watcher votes.** `watcher_registry` state is
  public, so a watcher who submits late in a round can see how earlier
  watchers voted before submitting, and could copy the emerging
  majority instead of reporting what it actually observed. Fixing this
  would roughly double the transaction count per watcher per round; it
  was deliberately left out of this version.
- **One shared, global watcher set.** A provider cannot curate their own
  trusted set of watchers per SLA; every SLA on a given
  `watcher_registry` deployment shares the same eligible watchers.
- **`uptime_target_bps` is not enforced.** It is stored and can be
  displayed, but nothing computes an actual uptime percentage over a
  billing period or compares it against this value. Settlement is
  purely per-round; see [Lifecycle](/lifecycle).
- **No protocol fee, and no pro-rated payout.** A settled round pays
  exactly `min(penalty_per_breach, remaining balance)`, never a partial
  amount based on severity.
- **TTL constants are not tuned against real usage.** The persistent
  storage TTL-extension window (`518_400` ledgers, ~30 days) is a v1
  default; no real storage-rent cost data has been measured against it.

## The soroban-sdk 27.0.6 vs. 28.0.0 mismatch

The currently deployed, live-verified Testnet contracts (see
[Current Testnet deployment](/testnet-deployment)) were built with
`soroban-sdk 27.0.6`. `slasettle-vault`'s current source has since moved
to `28.0.0` via a merged Dependabot PR. These are not the same build,
and this has not been resolved: the current source has not been rebuilt
and redeployed against 28.0.0. This documentation states this
everywhere it's relevant rather than hiding it in one place.

## Verification gaps — closed, partially closed, and still open

- **A real browser/Freighter connection test, and a real watcher-daemon
  run against live Testnet RPC and the live contract, were both
  performed on 2026-09-29**, using a disposable watcher account and the
  live, verified deployment. The frontend check covered wallet
  connect/disconnect/reconnect, correct address and network display, the
  network-mismatch indicator, and the public status page working without
  a wallet — it did **not** cover the dashboard's write forms
  (create/top-up/cancel/withdraw) through a real signed transaction. See
  `evidence/phase-23-verification-2026-09-29.md` in the hub repository
  for the full record and [End-user guide](/end-user-guide) for the
  exact boundary.
- **This verification pass surfaced one new, real, undocumented
  defect**: the indexer's `GET /v1/slas/:slaId/settlements` endpoint
  returns a 500 error whenever a settlement row's cached
  `quorum_threshold` is `null`, because of an invalid hardcoded dummy
  account string in `indexer/src/rpc/liveReads.ts`. Not fixed as part of
  this verification pass; see the evidence file above.
- **Mobile/narrow-viewport visual review of this documentation site was
  not completed.** The desktop visual review (14 pages, both themes,
  search, navigation) was performed directly in a real connected
  browser on 2026-09-29, but the browser-automation tool available in
  that session could not actually resize its window to a narrow
  viewport (the resize call reported success without any measurable
  effect), and no other reliable way to force one was available. See
  the evidence file above for the exact detail.

## Frontend: a real, disclosed UX gap

`components/network/network-indicator.tsx` detects when the connected
wallet's network doesn't match the app's configured network and shows a
visual warning, but does not currently hard-block a transaction
submission on mismatch. This is not a fund-safety issue — Stellar's own
transaction-signing model bakes the network passphrase into the signed
payload, so a genuinely mismatched sign/submit combination fails at the
protocol level regardless — but it is a real UX gap, tracked as
[slasettle-hub#13](https://github.com/SLASettleHQ/slasettle-hub/issues/13).

## Operational

- **No public deployment of the frontend or the indexer exists.**
  Running either means running it yourself; see
  [Deployment topology](/deployment-topology).
- **No independent third-party security audit has been performed** on
  either repository. See [Security](/security).
- **No license file exists in either repository.** This documentation
  does not choose or invent one on that repository's behalf.
- **Dependency and secret scanning are manual and one-time, not
  scheduled.** See [Security](/security) for exactly what has been run
  and when.
