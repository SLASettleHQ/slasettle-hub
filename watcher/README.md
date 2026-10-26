# slasettle-hub/watcher

The independent watcher daemon. Anyone can run their own copy against their
own watcher address, once the contract admin has registered it via
`watcher_registry.register_watcher` — that's the whole quorum design (see
`SLASettle-contract-spec.md`). Once per round it checks a target endpoint
and submits its vote, bound to the SLA's committed endpoint hash.

This describes the **v0.2 contract interface** — not yet the currently
deployed Testnet contracts, which are still v0.1.

## Verified status

The whole module builds, vets, and tests cleanly against the real
`go-stellar-sdk` v0.7.3 types. `go.mod` declares `go 1.25` as the minimum.

`go build ./...` and `go vet ./...` succeed with no errors. `go test ./...`
passes locally — run it for the current count rather than trusting a number
in this file. Coverage includes `internal/endpoint`'s commitment hash
(cross-language-verified against the TypeScript SDK's `hash.test.ts`
vectors), `internal/retry`'s bounded exponential backoff, `decodeScVal`
against real encoded XDR values for every type it handles (including the
`ScvMap` struct decoding `get_sla` needs), and
`HasVoted`/`SubmitCheck`/`GetCurrentRound`/`GetSlaEndpointHash` against a
mocked RPC transport covering simulation failure, transport failure (both
bounded-retried-then-recovered and exhausted), poll timeout,
transient-not-found-then-success, and rejected-before-inclusion.

That paragraph describes local unit-test coverage only, against a mocked
RPC transport. Separately, on 2026-09-29, this daemon was built and run as
a real process against live Testnet RPC and the live, verified v0.1
`watcher_registry` contract, using a disposable watcher account. Across
four consecutive real rounds it correctly checked a real HTTP endpoint,
built, signed, and submitted a real `submit_check` transaction each round,
and each submission was independently confirmed on-chain. See
`../evidence/phase-23-verification-2026-09-29.md` in the hub repository
for the full record — note that run predates the v0.2 endpoint-hash and
authoritative-round changes described below, which have not yet had an
equivalent live-Testnet run.

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
# The daemon reads only its process environment (os.LookupEnv) and has no
# .env loader, so export the values before starting it. Quote
# NETWORK_PASSPHRASE (it contains spaces and a `;`) or leave it unset to use
# the Testnet default. `source .env` does not work on the unquoted line.
export WATCHER_REGISTRY_CONTRACT_ID=... SLA_VAULT_CONTRACT_ID=... WATCHER_SECRET_KEY=... TARGET_URL=... SLA_ID=...
go run ./cmd/watcher
```

`SLA_VAULT_CONTRACT_ID` is new in v0.2 — it's used to read the SLA's
committed endpoint hash for the pre-flight check below, not to submit
anything (the daemon never calls `sla_vault` as a write).

## What it actually does, each round

1. Read `watcher_registry.get_current_round()` — the contract's
   authoritative round, not a locally-computed `floor(now /
   ROUND_LENGTH_SECONDS)`. `submit_check` validates `round_id` against this
   value (current round, or the immediately preceding one), so using the
   same source here means a submission's round_id always matches what the
   contract will accept, including right at a round boundary. The local
   clock is still used, but only to pace the sleep/wake cycle between
   rounds (see `internal/round`), never to decide round_id itself.
2. Check `has_watcher_voted` first, to avoid submitting a transaction that
   would just fail with `DuplicateCheck`.
3. Pre-flight: read `sla_vault.get_sla` and compare its `endpoint_hash`
   against this daemon's locally-computed commitment for `TARGET_URL`
   (ASCII-trim + domain-separated SHA-256 — see `internal/endpoint`, kept
   byte-for-byte identical to the TypeScript SDK's `hash.ts`). On a
   mismatch, log it plainly and skip the round without checking or
   submitting — a watcher gets exactly one submission per
   `(sla_id, round_id)` regardless of endpoint hash, so submitting under
   the wrong commitment would burn that round's vote with no way to
   repair it afterward.
4. If not yet voted and the commitment matches: one HTTP GET against
   `TARGET_URL`, classified up or down (see `internal/health`).
5. Sign and submit `submit_check` with this watcher's own key. Auth here is
   simple — a watcher only ever authorizes its own vote, never anyone
   else's funds. Direct RPC/transport calls (`LoadAccount`,
   `SimulateTransaction`, `SendTransaction`, `PollTransaction`) are each
   wrapped in a bounded retry with exponential backoff (see
   `internal/retry`) — only for genuine transport failures, never for a
   deterministic contract-level rejection like `DuplicateCheck`,
   `InvalidRound`, `NotAWatcher`, or `ContractPaused`, which come back as a
   normal (non-error) RPC response and are never retried.
6. Sleep until the next round boundary, not a fixed interval — this avoids
   drift accumulating from the check's own execution time (see
   `internal/round`).

## Known limitations, stated plainly

1. **Same last-mover vote-copying limitation as the contract itself** — see
   `SLASettle-contract-spec.md`. This daemon doesn't and can't fix that; it
   would need a commit-reveal protocol change on the contract side.
2. **One process per SLA.** Watching multiple SLAs means running multiple
   copies with different `SLA_ID` values.
3. **A mismatched endpoint commitment cannot be repaired for that round.**
   If this daemon's `TARGET_URL` doesn't match the SLA's on-chain
   `endpoint_hash` — e.g. the provider changed the SLA's committed endpoint
   after this daemon was configured — the pre-flight check blocks
   submission for the current round, but if some other process already
   consumed this watcher's one vote for `(sla_id, round_id)` under the
   wrong hash, there's no way to vote again for that round.
