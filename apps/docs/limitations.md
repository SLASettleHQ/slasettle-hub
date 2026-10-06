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


## Verification gaps - closed, partially closed, and still open

- **A real browser/Freighter connection test, and a real watcher-daemon
  run against live Testnet RPC and the live contract, were both
  performed on 2026-09-29**, using a disposable watcher account and the
  then-live 2026-09-27 deployment (since superseded by the 2026-10-01 pair;
  neither check has been repeated on it). The frontend check covered wallet
  connect/disconnect/reconnect, correct address and network display, the
  network-mismatch indicator, and the public status page working without
  a wallet — it did **not** cover the dashboard's write forms
  (create/top-up/cancel/withdraw) through a real signed transaction. See
  `evidence/phase-23-verification-2026-09-29.md` in the hub repository
  for the full record and [End-user guide](/end-user-guide) for the
  exact boundary.
- **This verification pass surfaced one new, real, undocumented defect**
  in the indexer's `GET /v1/slas/:slaId/settlements` endpoint (an invalid
  hardcoded dummy account in `indexer/src/rpc/liveReads.ts`). It has
  since been fixed, covered by a regression test, and re-verified live
  against the real deployment the same day — see the "Follow-up" section
  of the evidence file above for the full record. It is not listed as a
  current limitation because it no longer is one.
- **Mobile/narrow-viewport visual review of this documentation site was
  not completed.** The desktop visual review (14 pages, both themes,
  search, navigation) was performed directly in a real connected
  browser on 2026-09-29, but the browser-automation tool available in
  that session could not actually resize its window to a narrow
  viewport (the resize call reported success without any measurable
  effect), and no other reliable way to force one was available. See
  the evidence file above for the exact detail.

## Frontend: network mismatch blocks writes, not yet browser-verified

`components/network/network-indicator.tsx` shows a warning when the connected
wallet's network doesn't match the app's configured network. Since
[slasettle-hub#13](https://github.com/SLASettleHQ/slasettle-hub/issues/13) the
transaction layer also refuses to build, sign or submit in that case, and when
the app has no configured network. Each write action (create SLA, top up,
cancel, withdraw, trigger settlement) is disabled and says why. This is
covered by unit tests with a mocked wallet. It has not been exercised in a real
browser with Freighter, which stays part of
[slasettle-hub#12](https://github.com/SLASettleHQ/slasettle-hub/issues/12).

## Operational

- **The watcher daemon has no continuous 24/7 deployment.** The indexer is deployed
  as a public service on Cloudflare Workers (https://slasettle-indexer.slasettle-indexer.workers.dev)
  backed by Cloudflare D1, but no standing watcher daemon runs permanently. Watcher
  submissions were verified live on Testnet during verification passes. See
  [Deployment topology](/deployment-topology).
- **No independent third-party security audit has been performed** on
  either repository. See [Security](/security).
- **MIT license files exist in both repositories.** Both repositories include an
  MIT LICENSE file.
- **Dependency and secret scanning are manual and one-time, not
  scheduled.** See [Security](/security) for exactly what has been run
  and when.

## Contract storage lifetime needs maintenance

The current contract source never extends the lifetime of its instance
storage (`Admin`, `Paused`, `NextSlaId`, `WatcherCount`, `WatcherRegistry`)
and does not refresh a watcher's registration, an SLA's config or a bond
balance when they are only read. This was found on 2026-09-29 on the
superseded 2026-09-27 pair, whose instances were due to expire about
2026-10-05.

- **Current pair:** no lifetime extension of the 2026-10-01 pair is recorded
  and no expiration ledger for it has been read or recorded. Check it with the
  Stellar CLI and extend it by hand when needed.
- **Operational mitigation on the superseded pair, done 2026-09-29:** the
  lifetime of that pair's contract instances and WASM code entries was extended
  by 3,000,000 ledgers (about 174 days) with `stellar contract extend`. Only
  lifetimes changed. These transactions do not apply to the current pair. See
  [Current Testnet deployment](/testnet-deployment).
- **Not fixed at source level:** the source still does not extend instance
  storage itself. A permanent fix needs a contract change and a redeployment,
  which is outside the current submission freeze. Source and deployment
  parity itself is resolved by the 2026-10-01 deployment (vault issue #3 is
  closed).
- **Persistent entries (superseded pair):** on 2026-09-29 the entries the
  workflow on that pair needed (the five watcher registrations, SLAs 0 to 2 with their bond
  balances, and the settled round 0/1) were also extended by 3,000,000
  ledgers (12 transactions, no state changed; see
  [Current Testnet deployment](/testnet-deployment)). History entries such as
  the vote records and tallies for the evidence rounds were not, and were due
  in about 28 days. The contract still extends a persistent entry only when it
  writes it, so a watcher registered or an SLA created later is not covered.
- **No archived-entry handling in the clients:** the SDK, the frontend and
  the watcher have no code for restoring an archived ledger entry, and the
  restore path itself has not been exercised. An archived entry makes the
  affected call fail until it is restored by hand.

## Smaller behaviors left as they are

- **A repeat `cancel_sla` emits another `SlaCancelled` event.** The SLA
  stays cancelled and no funds move, but a consumer that assumes exactly one
  cancellation event per SLA would over-count. The hub's indexer does not
  persist this event.
- **`quorum_threshold` is not bounded by the number of registered
  watchers.** A threshold above the watcher count can never be reached, so
  such an SLA can never settle.
- **A removed watcher's earlier votes still count** in the round tallies.
- **The indexer may make one RPC read per settlement row** on the first
  request over rows whose `quorum_threshold` is not cached yet, and any
  failed read returns `500`.
- **The watcher has no per-round submission deadline.** A submission that
  stalls holds the loop; the next loop iteration skips a round it has
  already voted in.
- **The indexer API has no authentication**, and binds all interfaces.
- **The watcher is not continuously hosted**; it ran for four rounds on
  2026-09-29 for verification.
- **The status page can trigger settlement for the current round only.**
  An earlier round that reached quorum can still be settled by anyone with
  another tool.
- **CI action references are pinned by tag, not commit SHA**, and the CI
  workflows do not declare a `permissions:` block (the repository default
  for the workflow token is read-only).
