# Deployed-origin verification, 2026-10-07

Testnet only. No wallet signing, no transaction, no data created. Browser:
Chrome, driven through a browser-automation extension.

## Intended configuration

Established from `apps/docs/testnet-deployment.md` (current deployment, fresh on
2026-10-01), the indexer's `wrangler` vars and the local `apps/web/.env.local`,
which all agree:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID` | `CDBFPYHJNYSIFXSMXF3BBDWPKHRS7SJFFEKMQ5WJXYTBMD4LFAG2CHLN` |
| `NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID` | `CDRNXUPCZTVZXKPWNBQZAYI6HYFNBDHRO2KNNJSMDVTEHFOM7LCMOYMF` |
| `NEXT_PUBLIC_INDEXER_API_URL` | `https://slasettle-indexer.slasettle-indexer.workers.dev` |

## Vercel environment

Project `hollujays-projects/slasettle-web`, read with the Vercel CLI. All five
variables exist, Production environment only. The values pulled from Vercel
were identical to the table above. `NEXT_PUBLIC_INDEXER_API_URL` was created
about 19 hours before the check, so it is set explicitly and the app no longer
depends on the removed code fallback.

Before the redeploy, the served bundle already contained the current pair
(not the superseded `CBKAQETJ…` / `CD4FSW2E…` pair that an earlier note
described) and the indexer URL, but not the "no built-in default" code, so it
had been built before PR #21.

## Redeploy

- Source: hub `main` at `5632e595dc33adf0d356cc950ccd1a75a29e8d0d`, clean tree
  equal to `origin/main`, uploaded with the Vercel CLI (the project is not
  Git-connected) with `--prod --force` so the build cache was bypassed.
- A first upload failed with `fetch failed` and was retried as a single archive.
- Deployment `dpl_BD4NUBfQf6yQtKUebe6c4MDL4QwB`,
  `https://slasettle-a7pho522h-hollujays-projects.vercel.app`, target
  production, status Ready, created 2026-10-07 11:30:34 +01:00 (10:30:34Z),
  build 37 s. Aliases: `https://slasettle-web.vercel.app`,
  `https://slasettle-web-hollujays-projects.vercel.app`.
- The served bundle then contained the "no built-in default" message, both
  current contract IDs and the indexer URL.

## Passed on `https://slasettle-web.vercel.app`, in the browser

- Network log (extension): on loading `/status/0` the app called
  `soroban-testnet.stellar.org` (POST, 200) and exactly three indexer URLs,
  `/v1/clock`, `/v1/slas/0/current-round`, `/v1/slas/0/settlements?limit=20`,
  all 200. Resource hosts contacted: the Vercel origin, the Soroban RPC and the
  hosted indexer, nothing else. No console messages. This is CORS as the browser
  applied it, not a `curl` header; an in-page `fetch` of `/v1/health` also
  succeeded.
- SLA 0: Active, bond 41 native, penalty 10, quorum 3; round loads; five
  registered watchers listed, all pending; tally 0 / 3 Down; "Quorum not
  reached" and settlement disabled for the round.
- SLA 1: Cancelled, bond 0; current round loads; settlement history shows the
  empty state "No settlements yet".
- SLA 0 settlement row: round 123, 0 up / 3 down, quorum 3, 10 native, hash
  shown truncated (`70395b…c57c7b`). The full hash is in the page, and the
  explorer link is
  `https://stellar.expert/explorer/testnet/tx/70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b`
  (Testnet, new tab, `rel=noreferrer`). Horizon Testnet reports that
  transaction successful in ledger 4964512, created 2026-10-01T09:15:47Z, the
  same time the indexer reports.
- Unknown SLA (`/status/999999`): "No SLA with this ID exists on this network".
- Loading state: the skeleton was seen on first paint after navigation.
- Themes: Dark, Light and System switch. System followed the OS dark
  preference. The choice persists across a reload (`localStorage` key
  `slasettle-theme`; Light stayed Light with a light background).
- Keyboard: skip link is the first Tab stop; Tab order is skip link, logo,
  Dashboard, SLA status, the three theme buttons, wallet button, Copy, View on
  explorer. Every stop reported `:focus-visible` with a 2 px outline.
- Focus ring contrast, settled colour measured on each stop: dark theme
  `rgb(91,157,255)` on `rgb(8,9,12)` = 7.31:1; light theme `rgb(29,111,224)` on
  `rgb(245,246,248)` = 4.41:1 (computed). Both above 3:1.
- Responsive, in same-origin iframes of 390 px and 820 px: no horizontal
  overflow; at 390 px the Menu button shows and the inline nav is hidden; at
  820 px the inline nav shows; the settlement row renders at both widths. By
  keyboard at 390 px, Enter opens the menu, Tab reaches the first link and
  Escape closes it with focus back on the Menu button (the fix from PR #22).

## Not verified, or only partly

- Real mobile and tablet: the window cannot be resized by the tool
  (`innerWidth` stayed 1480), so only the iframe check above was done. No
  physical device, no touch.
- `prefers-reduced-motion`: the setting could not be changed. The rule is in the
  deployed CSS (`transition-duration` and `animation-duration` of 0.01 ms) but
  the media query itself was not triggered.
- The unavailable (CORS-blocked) state was verified on the production build at
  `http://localhost:3002` on 2026-10-07, not on the deployed origin, which would
  need the indexer to fail, and that was not fabricated.
- The tab reported `visibilityState: hidden` for part of the session, which
  stalls CSS transitions and timed out one screenshot; focus colours were
  therefore measured after settling, and the light-theme ratio was computed.
- The theme-persistence check covered Light only.
- Freighter connection is shown in the header, but no signing, create, top-up,
  cancel, withdraw or settlement was attempted. Wallet writes remain unverified.
