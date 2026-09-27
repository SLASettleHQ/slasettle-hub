# slasettle-hub/watcher

The independent watcher daemon. Anyone can run their own copy against their
own watcher address, once the contract admin has registered it via
`watcher_registry.register_watcher` — that's the whole quorum design (see
`SLASettle-contract-spec.md`). Once per round it checks a target endpoint
and submits its vote.

## Verified status — split honestly, this package is not one thing

Unlike the indexer (fully compiled and tested) or the contracts (entirely
hand-written and unverified), this daemon is genuinely split down the
middle, and it matters which half you're looking at:

**`internal/config`, `internal/round`, `internal/health` — real, verified,
19/19 tests passing.** These have zero dependency on `go-stellar-sdk`, so
they could be compiled and tested for real in this sandbox using a
temporarily lowered `go.mod` directive purely to work around the
toolchain's version (restored to the real `go 1.25` before committing —
see git log for the exact commands). `internal/health`'s tests hit real
`httptest` servers, including a genuine timeout and a genuine refused
connection, not mocked results.

**`internal/contract` — hand-written, unverified, explicitly flagged in
its own file header.** `go-stellar-sdk` v0.7.2 requires Go ≥1.25; this
sandbox only had 1.22 via apt, and Go's own toolchain auto-download is
blocked under this environment's network policy (`golang.org` isn't
reachable — confirmed directly, not assumed; see the error this produced,
copied into git log). Two import paths were confirmed against real current
sources before writing this file (`clients/rpcclient`, `protocols/rpc` —
the SDK's own recent migration PR calls out exactly these two as having
moved). Everything else — `txnbuild`'s exact API, the ScVal encoding
helpers, the simulate/prepare/sign/submit/poll flow — is written from the
well-established general Soroban Go pattern, not confirmed against this
SDK version's actual compiled types.

**One function is deliberately incomplete, not guessed at:**
`decodeScVal` in `internal/contract/contract.go` returns an explicit error
rather than a fabricated implementation, because the real decode API
wasn't something I could verify. Fix that function first — `HasVoted` can't
actually work until it's real.

## Building and fixing this for real

```bash
go build ./...
go test ./...
```

In a real Go 1.25+ environment, this will very likely surface real compile
errors in `internal/contract` — expected, not a sign anything else is
wrong. Fix them the same way the contracts agent fixed `slasettle-vault`:
correct the specific mismatch against the real SDK types, don't rewrite the
file from scratch. The three things most likely to need adjustment, in
likely order of how much they'll need to change:

1. `decodeScVal` — needs the SDK's real ScVal-to-Go-value decode function.
2. The exact `txnbuild.InvokeHostFunction` / `xdr.HostFunction` construction
   — field names and nesting may differ from what's written here.
3. `PollTransaction` and `PrepareTransaction`'s exact signatures on
   `rpcclient.Client` — sketched, not confirmed.

## Setup

```bash
cp .env.example .env   # fill in after watcher_registry is deployed and this
                        # watcher's address is registered by the admin
go run ./cmd/watcher
```

## What it actually does, each round

1. Compute `round_id = floor(now / ROUND_LENGTH_SECONDS)` — independently,
   from this process's own clock. Every watcher does the same division, so
   they converge on the same round_id without coordinating.
2. Check `has_watcher_voted` first, to avoid submitting a transaction that
   would just fail with `DuplicateCheck`.
3. If not yet voted: one HTTP GET against `TARGET_URL`, classified up or
   down (see `internal/health`).
4. Sign and submit `submit_check` with this watcher's own key. Auth here is
   simple — a watcher only ever authorizes its own vote, never anyone
   else's funds.
5. Sleep until the next round boundary, not a fixed interval — this avoids
   drift accumulating from the check's own execution time (see
   `internal/round`).

## Known limitations, stated plainly

1. **The contract-calling half is unverified**, as above — the most
   important thing to know about this repo.
2. **Same last-mover vote-copying limitation as the contract itself** — see
   `SLASettle-contract-spec.md`. This daemon doesn't and can't fix that; it
   would need a commit-reveal protocol change on the contract side.
3. **One process per SLA.** Watching multiple SLAs means running multiple
   copies with different `SLA_ID` values.
4. **No retry/backoff on submission failure** — a failed round is logged
   and skipped, retried next round. Fine for a demo; a production watcher
   would want a bounded retry with backoff within the round window.
