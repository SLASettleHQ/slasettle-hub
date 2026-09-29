# slasettle-hub/watcher

The independent watcher daemon. Anyone can run their own copy against their
own watcher address, once the contract admin has registered it via
`watcher_registry.register_watcher` — that's the whole quorum design (see
`SLASettle-contract-spec.md`). Once per round it checks a target endpoint
and submits its vote.

## Verified status

An earlier version of this section reported `internal/contract` as
hand-written and unverified, because the sandbox it was written in only
had Go 1.22 available and go-stellar-sdk v0.7.2 requires Go 1.25. That
constraint no longer holds: Go 1.25.1 is available directly in the current
environment (confirmed with `go version`, no toolchain auto-download
needed), and the whole module now builds, vets, and tests cleanly against
the real `go-stellar-sdk` v0.7.2 types.

`go build ./...` and `go vet ./...` succeed with no errors. `go test ./...`
passes 48/48: 19 in `internal/config`, `internal/round`, and
`internal/health` combined (no dependency on `go-stellar-sdk`;
`internal/health`'s tests hit real `httptest` servers, including a genuine
timeout and a genuine refused connection, not mocked results), and 29 in
`internal/contract`, covering `decodeScVal` against real encoded XDR
values for each primitive type it handles, and `HasVoted`/`SubmitCheck`
against a mocked RPC transport covering simulation failure, transport
failure, poll timeout, transient-not-found-then-success, and
rejected-before-inclusion.

That paragraph describes local unit-test coverage only, against a mocked
RPC transport. Separately, on 2026-09-29, this daemon was built and run
as a real process against live Testnet RPC and the live, verified
`watcher_registry` contract, using a disposable watcher account. Across
four consecutive real rounds it correctly checked a real HTTP endpoint,
built, signed, and submitted a real `submit_check` transaction each
round, and each submission was independently confirmed on-chain via
`get_round_tally` and `has_watcher_voted`. See
`../evidence/phase-23-verification-2026-09-29.md` in the hub repository
for the full record, including real transaction hashes and ledger
numbers.

## Building

```bash
go build ./...
go vet ./...
go test ./...
```

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

1. **Same last-mover vote-copying limitation as the contract itself** — see
   `SLASettle-contract-spec.md`. This daemon doesn't and can't fix that; it
   would need a commit-reveal protocol change on the contract side.
2. **One process per SLA.** Watching multiple SLAs means running multiple
   copies with different `SLA_ID` values.
3. **No retry/backoff on submission failure** — a failed round is logged
   and skipped, retried next round. Fine for a demo; a production watcher
   would want a bounded retry with backoff within the round window.
