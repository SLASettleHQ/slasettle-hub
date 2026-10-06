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

The Soroban RPC URL, passphrase and contract IDs have no defaults. A missing
one produces a clear "not configured" message in the UI (the network
indicator, or an SDK `MissingSdkConfigError`), and a malformed one an
`InvalidSdkConfigError`, rather than a silent failure or a blank screen.
`NEXT_PUBLIC_INDEXER_API_URL` falls back to the hosted Cloudflare indexer
named in `lib/indexer.ts` when unset.

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
- **`components/status/`** holds the pieces of the real `/status/[slaId]`
  page (`RoundPanel`, `WatcherGrid`, `QuorumMeter`, `SettlementList`,
  `TransactionEvidence`). The landing page contains no example data.
- **`components/state-notice.tsx`** provides the three states every data
  region uses and keeps apart: loading, empty (the source answered and
  there is nothing) and unavailable (the source could not be asked).

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
build→sign→submit→poll sequence and exposes building, signing, submitting,
pending (accepted by the network, not yet in a ledger), confirmed, failed,
rejected (the user declined in the wallet) and unconfirmed (polling ended
without a result) states. `components/transaction-status.tsx` renders them
consistently everywhere. Nothing is shown as confirmed before the chain
confirms it.

## SDK usage

All contract reads/writes go through `@slasettle/sdk` (`packages/sdk`) —
see that package's own README for its API and conventions (bigint-only
money, unsigned write builders, etc.). This app never builds Soroban
transactions by hand.

## Indexer integration

`lib/indexer.ts` implements all six endpoints in `apps/docs/api.md` and no
others. Every response is validated at runtime, and failures are classified
as unreachable, bad status or malformed body, so the UI can say which. Round
status loads each source independently (`use-round-status.ts`): the indexer
supplies the round and watcher check-ins, Soroban RPC supplies the tally and
settled flag, so one outage never hides the other. The indexer is a read-side history cache;
anything that must be current-as-of-right-now (bond balance, SLA status,
live vote tally) is a direct Soroban read instead. The current round_id
always comes from the indexer's `/v1/clock`, never from the browser's own
clock.

## Testing

```bash
pnpm test
```

vitest + `@testing-library/react` + jsdom. Pure logic (money
formatting and parsing, create-SLA validation, indexer parsing) is tested directly; components that talk to the wallet,
SDK, or indexer have those modules mocked at the boundary via `vi.mock`,
rather than hitting a real network or Freighter extension.

## Build

```bash
pnpm build       # from the repo root: builds the SDK, then this app
pnpm typecheck
pnpm lint
```

## Versions

Selected on 2026-10-06 from the npm registry's latest stable releases:
Next.js 16.3.8, React and React DOM 19.3.0, Tailwind CSS 4.3.3,
`@stellar/stellar-sdk` 17.2.1, `@stellar/freighter-api` 6.0.1, Vitest 5.0.3,
Testing Library (react 16.3.3, jest-dom 7.0.1, user-event 14.6.7), jsdom
30.1.2, `@vitejs/plugin-react` 6.1.2, Node 24.21 and pnpm 12.8.2.

Held back on purpose, with the reasons recorded in `CONTRIBUTING.md` and
`evidence/`: TypeScript stays on 5.9 (7.0 is released, but
`typescript-eslint` does not support it yet) and ESLint on 9 (10 is
released, but `eslint-plugin-react`, which `eslint-config-next` depends on, crashes
under it; reproduced on 2026-10-01).
Stellar Wallets Kit (2.7.0) is not used: Freighter is the supported wallet.
pnpm 12.9.1 and `eslint-config-next` 16.4.0 are newer than what is pinned;
the first is a patch-level change to the package manager and the second is
ahead of Next.js 16.3.8, so neither was adopted.
