# End-user guide

This describes what the frontend's source (`apps/web`) implements. A
real browser/Freighter verification was performed on 2026-09-29 (see
`evidence/phase-23-verification-2026-09-29.md` in the hub repository):
it confirmed the wallet connect/disconnect/reconnect flow, correct
address and network display, the network-mismatch indicator, and the
public status page loading real live data without a wallet — all with a
genuine Freighter extension against the live Testnet deployment. It did
**not** exercise the dashboard's write forms (create/top-up/cancel/
withdraw an SLA) through the UI with a signed transaction; those remain
an accurate description of the code below, not a verified click-through.
See [Limitations](/limitations) for the exact boundary.

There are two real pages: a provider dashboard (`/dashboard`) and a
public per-SLA status page (`/status/[slaId]`). Since 2026-09-29 the
frontend is also hosted on Vercel at https://slasettle-web.vercel.app,
configured for the Testnet contracts but **without an indexer**: the pages
read contract state directly, while the round status and settlement history
panels show an "indexer not configured" message. For the full experience run
`apps/web` yourself against a configured RPC, indexer, and contract set (see
[Deployment topology](/deployment-topology)). Signed writes from the hosted
site have not been tested.

## Prerequisite: a connected wallet

Every write action below requires the [Freighter](https://www.freighter.app/)
browser extension, connected via the wallet button
(`components/wallet/wallet-button.tsx`), which calls
`connectWallet()` (`apps/web/lib/wallet.ts`) — this prompts Freighter's
own access-request dialog. The frontend never asks for or sees a
secret key; every signature happens inside the Freighter extension.

## As a provider: creating an SLA (`/dashboard`)

The dashboard's create-SLA form
(`components/dashboard/create-sla-form.tsx`) collects the same fields
`create_sla` takes on-chain — token, bond amount, uptime target,
quorum threshold, penalty per breach, beneficiary — and builds the
transaction via the SDK's `buildCreateSlaTx`, then hands it to Freighter
to sign. See [Economics](/economics) for what each field actually
controls once the SLA exists; the target uptime percentage is display
only and does not change how settlement works.

From the same dashboard, `components/dashboard/sla-list.tsx` and
`sla-card.tsx` list SLAs the connected wallet provides, and expose:

- **Top up bond** (`top-up-bond-form.tsx`) — adds funds via
  `buildTopUpBondTx`. Works whether the SLA is `Active` or `Cancelled`.
- **Cancel** (`cancel-sla-action.tsx`) — moves the SLA to `Cancelled`
  via `buildCancelSlaTx`. One-way; there is no un-cancel action anywhere
  in the frontend or the contract.
- **Withdraw remaining bond** (`withdraw-bond-action.tsx`) — only
  meaningful after cancelling; calls `buildWithdrawBondTx`.

`components/confirm-button.tsx` is used to gate the irreversible actions
(cancel, withdraw) behind an explicit confirmation step in the UI,
separate from Freighter's own signing prompt.

## As anyone: viewing an SLA's public status (`/status/[slaId]`)

No wallet connection is required to view this page — it reads from the
indexer's public API (see [Indexer API](/api)) and from Soroban RPC
directly via the SDK's read functions. It shows:

- **`watcher-grid.tsx`** / **`watcher-status-row.tsx`** — which watchers
  have checked in for the current round and their vote, from
  `GET /v1/slas/:slaId/current-round`.
- **`quorum-meter.tsx`** — the current round's vote count against
  `quorum_threshold`.
- **`round-indicator.tsx`** — the current round, from the indexer's
  authoritative `GET /v1/clock`, not the browser's own clock.
- **`settlement-list.tsx`** / **`settlement-row.tsx`** — settlement
  history from `GET /v1/slas/:slaId/settlements`, each row linking to a
  real Stellar Testnet explorer transaction
  (`transaction-evidence.tsx`).
- **`trigger-settlement-action.tsx`** — lets any connected wallet call
  `trigger_settlement` once it believes quorum has been reached; this
  mirrors the contract's own permissionless design (see
  [How SLASettle works](/how-it-works)), not a privileged action.

## Network mismatch

`components/network/network-indicator.tsx` detects when the connected
Freighter wallet is on a different network than the frontend is
configured for, and shows a visual warning. This is a real,
disclosed gap: it does not currently hard-block a transaction
submission on mismatch — see [Limitations](/limitations) and hub issue
[#13](https://github.com/SLASettleHQ/slasettle-hub/issues/13).
