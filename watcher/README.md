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

This is tested locally against the real SDK's types and a mocked RPC
transport, not verified against a live Testnet RPC endpoint or a real
deployed contract. No transaction built by this package has actually been
submitted and confirmed on-chain as of this writing. That is a distinct,
separate verification step from what this section describes.

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

1. **The contract-calling half has not been verified against a live
   Testnet RPC endpoint or a real deployed contract**, as above. Tested
   locally against the real SDK types and a mocked RPC transport is not
   the same claim.
2. **Same last-mover vote-copying limitation as the contract itself** — see
   `SLASettle-contract-spec.md`. This daemon doesn't and can't fix that; it
   would need a commit-reveal protocol change on the contract side.
3. **One process per SLA.** Watching multiple SLAs means running multiple
   copies with different `SLA_ID` values.
4. **No retry/backoff on submission failure** — a failed round is logged
   and skipped, retried next round. Fine for a demo; a production watcher
   would want a bounded retry with backoff within the round window.
