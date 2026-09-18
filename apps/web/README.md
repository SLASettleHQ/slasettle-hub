# SLASettle web app

The Next.js frontend for SLASettle: a public landing page, a wallet-gated
provider dashboard, and a public per-SLA status page. See the repository
root for what SLASettle is; this document is about running and working on
this specific app.

## What this app is not

It does not run the watcher daemon (`watcher/`) or the event indexer
(`indexer/`) — those are separate services owned by other teams, and this
app only ever talks to them over their public interfaces (direct Soroban
reads via `@slasettle/sdk`, and the indexer's HTTP API via `lib/indexer.ts`).
It never holds a secret key; all signing happens in the user's Freighter
extension.

## Setup

From the repository root (this is a pnpm workspace):

```bash
pnpm install
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values for the network
you're pointing at:

```text
NEXT_PUBLIC_SOROBAN_RPC_URL          # Soroban RPC endpoint
NEXT_PUBLIC_NETWORK_PASSPHRASE       # network passphrase, e.g. Testnet
NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID    # deployed sla_vault contract ID
NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID  # deployed watcher_registry contract ID
NEXT_PUBLIC_INDEXER_API_URL          # indexer base URL
```

None of these have defaults or fallbacks — a missing one produces a clear
"not configured" message in the UI (the network indicator, or an SDK
`MissingSdkConfigError`/indexer `MissingIndexerConfigError`) rather than a
silent failure or a blank screen.

## Running locally

The SDK package has to be built first, since this app consumes its
compiled output via the workspace protocol:

```bash
pnpm --filter @slasettle/sdk build
pnpm dev
```

(`pnpm dev` from the repository root does this automatically.) Then open
http://localhost:3000.

## Architecture

- **App Router, Server Components by default.** `"use client"` is only on
  components that actually need browser state, wallet interaction, polling,
  or interactive forms — see any file under `components/` for an example of
  each.
- **`lib/`** holds framework-agnostic logic: `wallet.ts` (Freighter),
  `indexer.ts` (typed indexer client), `format.ts` (integer-safe money
  formatting/parsing), `theme.ts`/`theme-store.ts` (dark/light/system),
  `network.ts` (network labeling + explorer links), `use-transaction.ts`
  (the shared build→sign→submit→poll flow), and the page-level data hooks
  (`use-provider-slas.ts`, `use-sla-config.ts`, `use-round-status.ts`,
  `use-settlement-history.ts`).
- **`components/status/`** holds the presentational pieces (`WatcherGrid`,
  `QuorumMeter`, `SettlementList`, `TransactionEvidence`) that back both the
  real `/status/[slaId]` page and the landing page's labeled example
  preview — the same components, not a duplicate mockup.

## Wallet flow

`lib/wallet.ts` wraps `@stellar/freighter-api`: detecting the extension,
connecting (with silent reconnect on load), signing an unsigned
`Transaction` from the SDK, and submitting + polling for a final status via
the configured Soroban RPC server. `components/wallet/wallet-provider.tsx`
exposes this as React context (`useWallet()`) app-wide. The frontend never
sees a secret key; "disconnect" only clears this app's local session; a
user revokes actual site access from the Freighter extension itself.

Every write action (create/top-up/cancel/withdraw an SLA, trigger
settlement) goes through `lib/use-transaction.ts`, which drives that same
build→sign→submit→poll sequence and exposes building/signing/submitting/
confirmed/failed states — `components/transaction-status.tsx` renders them
consistently everywhere. Nothing is shown as successful before the chain
confirms it.

## SDK usage

All contract reads/writes go through `@slasettle/sdk` (`packages/sdk`) —
see that package's own README for its API and conventions (bigint-only
money, unsigned write builders, etc.). This app never builds Soroban
transactions by hand.

## Indexer integration

`lib/indexer.ts` implements the five endpoints in
`SLASettle-indexer-api-spec.md` exactly as documented — no invented fields,
no assumed shapes. The indexer is a read-side history cache; anything that
must be current-as-of-right-now (bond balance, SLA status, live vote tally,
the current round) is always a direct Soroban read instead, per that spec's
own "what the indexer does not do" section. The current round_id always
comes from the indexer's `/v1/clock`, never from the browser's own clock.

## Testing

```bash
pnpm test
```

vitest + `@testing-library/react` + jsdom. Pure logic (money
formatting/parsing) is tested directly; components that talk to the wallet,
SDK, or indexer have those modules mocked at the boundary via `vi.mock`,
rather than hitting a real network or Freighter extension.

## Build

```bash
pnpm build       # from the repo root: builds the SDK, then this app
pnpm typecheck
pnpm lint
```
