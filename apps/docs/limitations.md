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

## Verification gaps — not run, not "failed"

- **No browser/Freighter walkthrough of the frontend has been
  performed** in any environment this project has been built in so far.
  [End-user guide](/end-user-guide) describes the code accurately; it is
  not a verified click-through.
- **The watcher daemon has never been run as a live process against
  Testnet RPC.** It has unit tests against a mocked RPC transport. Every
  real vote referenced in this project's evidence was submitted directly
  via the Stellar CLI, not by running `go run ./cmd/watcher`.
- **No visual/rendered review of this documentation site itself** has
  been performed — no browser automation tooling was available while
  writing it. Its build/typecheck status is reported in
  [Testing](/testing) instead; that is a build check, not a visual one.

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
