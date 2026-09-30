# Security

**No independent third-party security audit has been performed on any
part of this project.** Everything below reflects internal engineering
review only, by the people building these two repositories. Testnet
only; nothing here is deployed to mainnet.

Full detail lives in each repository's own `SECURITY.md`, which this
page summarizes rather than duplicates:

- [`slasettle-vault/SECURITY.md`](https://github.com/SLASettleHQ/slasettle-vault/blob/main/SECURITY.md) — the two contracts.
- [`slasettle-hub/SECURITY.md`](https://github.com/SLASettleHQ/slasettle-hub/blob/main/SECURITY.md) — watcher, indexer, SDK, frontend.

## Reporting a vulnerability

Neither repository has GitHub's private vulnerability reporting enabled,
and there is no dedicated security contact address. This is a real gap
for a project at this stage, not a deliberate choice. If you find a
vulnerability, open a GitHub issue with the minimum detail needed to
establish that a real issue exists — do not post a full exploit in a
public issue — and ask for a private channel to share the rest.

## What has actually been checked

- **`cargo audit`** (vault, 2026-09-28): one non-CVE advisory
  (`paste` v1.0.15, RUSTSEC-2024-0436, unmaintained), pulled in
  transitively through `soroban-sdk` itself, not a dependency this
  project chose or can remove directly.
- **`pnpm audit --prod`** (hub's pnpm workspace) and **`npm audit
  --omit=dev`** (`indexer`, separate lockfile), both 2026-09-28: 0 known
  vulnerabilities.
- **`govulncheck`** (`watcher`): findings only in the Go standard
  library, already fixed in later Go 1.25.x patch releases; none in
  `go-stellar-sdk` or any other third-party dependency actually called
  by this code. Re-run 2026-09-30: with Go 1.25.14 none affect this code
  (one advisory in an indirect module that is not called); with the local
  Go 1.25.1 the same 25 standard library findings remain.
- **Manual secret scanning**: a `git grep` across the complete reachable
  git history of both repositories, for Stellar secret-key patterns, PEM
  private-key blocks, and generic API-key assignment patterns, found
  nothing in either repository as of 2026-09-28.

None of the above runs on a schedule. Each was a real, manually-run,
one-time check, not continuous coverage — the same limitation this
documentation applies to itself throughout.

## Contracts: authorization, in one table

| Function | Auth required |
|---|---|
| `watcher_registry.register_watcher` / `remove_watcher` / `pause` / `unpause` | admin |
| `watcher_registry.submit_check` | the watcher casting the vote, and it must already be registered |
| `sla_vault.create_sla` | the provider |
| `sla_vault.top_up_bond` / `cancel_sla` / `withdraw_remaining_bond` | the SLA's own provider |
| `sla_vault.trigger_settlement` | **none** — deliberate, see [Contracts](/contracts) |
| `sla_vault.pause` / `unpause` | admin |
| Every view function on either contract | none — nothing sensitive is returned |

## Off-chain: the two boundaries that matter most

- **Watcher key custody.** `WATCHER_SECRET_KEY` is read once at startup,
  passed directly to the client, and never logged. The watcher only ever
  signs its own vote; it never holds or moves anyone else's funds.
- **Wallet signing boundary.** Neither `packages/sdk` nor `apps/web`
  ever imports a signing library or holds a private key. Every write
  goes through Freighter. A grep across both for private-key or
  secret-signing code found none.

## Known gaps, disclosed rather than hidden

See [Limitations](/limitations) for the complete list with more detail.
The short version: no commit-reveal for watcher votes, one shared
watcher set, `uptime_target_bps` not enforced, frontend network-mismatch
detection is visual-only with no hard submit block, and — the one that
spans both repositories — the currently deployed contracts were built
with `soroban-sdk 27.0.6` while the vault's current source has moved to
`28.0.0` (see [Current Testnet deployment](/testnet-deployment)).
