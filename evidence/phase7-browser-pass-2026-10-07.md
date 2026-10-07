# Phase 7 browser pass, 2026-10-07

Chrome (via the Claude in Chrome extension), the app run from this repository
on `http://localhost:3000` (`next dev`, indexer URL set to the hosted
Cloudflare indexer in `apps/web/.env.local`) and, for the error-state checks,
the production build on `http://localhost:3002`. Testnet only. No wallet
signing, no transaction, no data created.

## Passed (observed in the browser)

- Hosted indexer from `localhost:3000`: the page's own requests to
  `/v1/clock`, `/v1/slas/0/current-round` and `/v1/slas/0/settlements?limit=20`
  returned 200, and an in-page `fetch` of `/v1/health` succeeded. This is what
  the browser enforced, not a `curl` header.
- Real SLA data (`/status/0`, `/status/1`): configuration and bond read live;
  current round and five watchers rendered.
- Real settlement history: the existing SLA 0 row (round 123, 0 up / 3 down,
  quorum 3, 10 native) rendered. Its explorer link points at
  `https://stellar.expert/explorer/testnet/tx/70395baea57c3c1a3382464026c0c72a67f71f977220ba4ba46094849fc57c7b`
  (full hash, new tab, `rel=noreferrer`); the display is truncated.
- Empty state: SLA 1 shows "No settlements yet".
- Themes: Light, Dark and System switch correctly (System followed the OS dark
  preference).
- Desktop layout (1480 px real viewport).
- Skip link: first Tab stop, visible, Enter moves focus to `main`.
- Visible focus: every stop in the header and the history row had a visible
  `:focus-visible` outline.
- Forms by keyboard: the SLA lookup rejects `abc` inline and loads
  `/status/999999` on Enter; the Create SLA form flags empty fields on Enter
  with no wallet call; the Cancel SLA inline confirmation opens by keyboard,
  moves focus into the panel and closes on Escape with focus back on the
  trigger. The confirm button was never activated.
- Unavailable state: from `localhost:3002` (not in the indexer's allowlist) the
  browser blocked the indexer ("Failed to fetch"); the panels show "indexer
  could not be reached", config and bond still load, settlement is disabled.
  `127.0.0.1:3000` was also blocked by CORS in the browser.
- Not-configured state: with `NEXT_PUBLIC_INDEXER_API_URL` empty the panels
  show the "not set ... no built-in default" message and no request is made to
  any indexer.

## Defects found and fixed

- Escape closed the mobile menu but dropped focus to `<body>` when focus was on
  a menu link. Fixed with a regression test (`3cb7c65`).
- An unknown SLA ID showed the raw Soroban HostError log. Now a short
  "no SLA with this ID exists" sentence for `get_sla` error #9 (`8a353cb`).

## Partly verified or not verified

- Mobile (390 px) and tablet (820 px) widths: the window could not be resized
  by the tool (`innerWidth` stayed 1480), so these were checked in same-origin
  iframes of that width in Chrome. Media queries respond to the iframe width;
  no horizontal overflow; hamburger menu at 390, full nav at 820. This is not a
  physical device or touch check.
- `prefers-reduced-motion`: the OS or browser setting could not be changed. The
  compiled `@media (prefers-reduced-motion: reduce)` rule is present, and
  applying its body unconditionally reduced an element's animation duration
  from 0.26 s to 0.01 ms. The media query itself was not triggered.
- The deployed origin (`https://slasettle-web.vercel.app`) against the hosted
  indexer: not tested (the deployed bundle predates the merged change and its
  Vercel env setting is unchecked).
- Loading state: seen only as a skeleton in passing, not tested systematically.
- Freighter signing and Testnet submission: deliberately not attempted.
- `next dev` refuses to hydrate on `127.0.0.1` (an `allowedDevOrigins`
  development restriction, not an app defect).

## Observations, not changed

- Empty bond amount and penalty are not flagged until the token's decimals are
  read; by design (two-phase validation).
- The inline confirmation is not modal: focus is not trapped, and Escape acts
  only while focus is inside it.
