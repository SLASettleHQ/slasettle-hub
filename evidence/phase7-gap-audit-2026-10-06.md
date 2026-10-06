# Phase 7 gap audit, 2026-10-06

Scope: `apps/web`, `packages/sdk`. The frontend and SDK already existed. This
audit compared them with the Phase 7 brief and fixed the gaps below, one
commit per unit. `watcher/` and `indexer/` were not modified.

## Gaps found and fixed

| Area | Gap | Fix |
| --- | --- | --- |
| SDK config | Only presence was checked | Validates RPC URL scheme, passphrase whitespace, contract ID strkeys (`InvalidSdkConfigError`) |
| SDK builders and reads | No argument validation, unchecked `as` casts when decoding | Validates addresses, i128, u32, u64, bps before any RPC call (`InvalidSdkInputError`); strict type checks on decoded fields |
| SDK | No quorum derivation | `deriveQuorum(tally, threshold)` |
| Indexer client | `as T` casts, no health call, no failure classification, no tests | Runtime validation of every response, `getHealth`, unreachable / bad status / malformed errors, input checks, 34 tests |
| Explorer links | Link came from the indexer's `explorer_url` | Built locally from a validated hash for the configured network |
| Transactions | No pending, rejected or unconfirmed states; `TRY_AGAIN_LATER` unhandled | Added the states; the hash is shown while pending; busy-network submit fails cleanly |
| Round status | One failed call blanked the panel; `setInterval` could overlap | Independent sources, sequential polling, paused on hidden tabs after the first load |
| Status page | Settlement refreshed only the SLA config; no per-source unavailable states; no pre-sign summary | Refreshes config, round and history; explicit unavailable / empty states; round, Down votes and penalty shown before signing |
| Quorum | Wording did not say Down votes | "N / M Down votes required", with a note that Up votes do not count |
| Create SLA | Errors surfaced only after building; blank uptime became 0; no address or bps checks | Inline per-field validation, token metadata read first, integer-only conversion |
| Top-up | No inline validation | Inline validation |
| Cancel and withdraw | "Click again" with no explanation; withdraw offered with zero bond | Inline confirmation explaining each action; cancel is stated not to withdraw; withdraw hidden at zero bond |
| Dashboard | One unreadable SLA blanked the list; indexer outage looked empty-capable | Per-SLA failures isolated; bounded concurrency; discovery errors distinct from empty |
| Landing | Example watchers, a fake hash, an `/tx/example` link, numeric example chips | Removed; flow steps now show real contract calls only |
| Navigation | No navigation below 640px; no `/status` route | Mobile menu, `/status` lookup route, skip link, current-page marking |
| Accessibility | Focus styling per component only | Global `:focus-visible` rule |
| Routes | No error or not-found page; route param reflected | `error.tsx` (this Next version uses `retry`), `not-found.tsx`, u64 validation of the route param |
| Misc | Hero list split into columns; connected-wallet dot pulsed with no state change; first poll skipped in hidden tabs | Fixed |

## Versions

See "Versions" in `apps/web/README.md`. Everything is on the npm latest stable
release except the documented holds (TypeScript 5.9, ESLint 9). `jsdom` and
`@vitejs/plugin-react` were bumped to their latest patch releases. The Node.js
LTS line could not be re-checked on nodejs.org during this audit (the request
timed out), so Node stays at the pinned 24.21.0 from `.nvmrc`.

## Verified (2026-10-06)

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (SDK 57 tests, web 237 tests) and
  `pnpm build` pass.
- Production build served locally and opened in Chrome: landing page and
  `/status/1` render; dark and light themes both render with legible states.
- Live Soroban reads from the web app: `get_sla`, `get_bond_balance` and token
  `decimals()` / `symbol()` for SLA #1 on Testnet (a Cancelled SLA with a zero
  bond) rendered on the status page.
- The indexer client's validators accept live responses from the hosted
  indexer for `/v1/health`, `/v1/clock`, `/v1/watchers`,
  `/v1/slas/1/current-round`, `/v1/slas/1/settlements` (empty) and a provider
  lookup (empty), run from Node.

## Not verified

- Browser access to the hosted indexer from `localhost`: the indexer sent no
  CORS header for that origin (its allowlist is intentional), so the browser
  showed the unavailable states. The deployed web origin was not tested.
- A non-empty settlement row from the live indexer; only the documented shape
  and fixtures cover it.
- Any signed transaction: no wallet-signed create, top-up, cancel, withdraw or
  settlement was submitted in this audit. Wallet signing and submission are
  covered by mocked tests only.
- Mobile and tablet widths in a real browser. The window could not be resized
  by the automation, and scripted multi-viewport checks were not permitted.
  The layout is responsive by construction and the mobile menu is unit tested.
- `prefers-reduced-motion` was not exercised in a browser. The global CSS rule
  is present.
- Keyboard navigation was covered by component tests (confirmation focus,
  Escape, menu), not by a manual pass.

## Open items for the owner

- Root `README.md` still says no hosted indexer exists; the hosted Cloudflare
  indexer is now the web app's default.
- `lib/indexer.ts` keeps a hard-coded fallback indexer URL, set deliberately in
  `cff6a05`. The Phase 7 brief says not to hard-code one. Say if it should move
  to `.env.example` only.
- `main` accepted direct pushes with a "bypassed rule violations" notice
  (pull request and required checks expected).
