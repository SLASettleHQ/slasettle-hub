# Phase 23 remediation — verification evidence, 2026-09-29

This is a focused evidence record for the Phase 23 remediation pass only:
closing the three verification gaps left open by the original Phase 23
documentation-site work (visual review of the docs site, real browser +
Freighter verification of the frontend, and a real watcher run against
live Testnet). It does not restate or revise the contract-level evidence
in `slasettle-vault/evidence/testnet-2026-09-27.md`; that remains valid
and unchanged.

- **Repository commit before this verification pass:** `7400ec4` (hub),
  unchanged in `slasettle-vault` for this pass.
- **Tool versions actually used:** Go 1.25.1, Node v24.21.0, pnpm 12.5.1,
  Stellar CLI 27.0.0, Chrome 150.0.0.0 (via the Claude in Chrome
  extension, one connected browser, `isLocal: true`).

## Part A — Documentation site visual verification

**VERIFIED (desktop, light and dark themes).** Started the site with the
repository's real command (`vitepress dev`, no extra flags — see the
finding below) and visually inspected every required page at a desktop
viewport (~1330–1480px): landing page, Introduction, How SLASettle
works, Architecture, Lifecycle, Contract reference, Current Testnet
deployment, Developer setup, SDK, Indexer API, Testing, Security,
Limitations, Deployment topology. All rendered correctly: no clipped
headings, readable body text and code blocks, sidebar and top nav both
functional, tables rendered correctly, ASCII diagrams aligned correctly
in monospace code blocks. Local search opened correctly, returned
relevant results with heading-path context for a real query ("quorum"),
and clicking a result navigated to the correct in-page anchor. Both
dark and light themes render with correct contrast; toggling between
them was exercised directly (Economics page, light theme).

**Real finding, investigated and resolved (not a site defect):** the
first dev-server start command I used
(`pnpm --filter @slasettle/docs run dev -- --port 5173`) produced a
client-side 404 on every route, with a browser console error
`TypeError: Failed to resolve module specifier '.md?import&t=...'`
thrown from VitePress's client router. Investigation traced this to the
malformed extra `--port` argument passed through pnpm's `--`
separator, which the `vitepress dev -- --port 5173` invocation
misparsed. Restarting with the plain, actually-documented command
(`vitepress dev`, confirmed against `apps/docs/package.json`'s own
`"dev": "vitepress dev"` script) on a clean cache resolved it
completely; every page then rendered correctly. This was a test-harness
mistake on my part, not a defect in the site or its source files, and no
site file was changed to "fix" it.

**UNVERIFIED — mobile/narrow-viewport layout.** The `resize_window`
browser tool reported success for every call (targets tried: 420x800,
500x850) but had no actual effect: `window.innerWidth`/`innerHeight`
measured via injected JavaScript immediately after each call remained
unchanged (1480x621, then 1332x559 depending on the tab's prior state),
and `window.resizeTo()` called directly in the page also had no effect,
which is consistent with browsers blocking programmatic resize of a
non-script-opened window. Chrome's DevTools (and its device-toolbar
emulation) could not be opened via keyboard shortcut in this automation
context, and browser zoom shortcuts are explicitly disallowed by the
computer-use tool itself. No reliable, honest way to produce an actual
narrow viewport was available in this environment. Mobile/narrow-width
visual verification of the documentation site (landing page, one
overview page, one contracts/deployment page, one developer page) is
therefore **UNVERIFIED**, not skipped silently — the desktop CSS is
responsive-authored (per the design skill's contract) but this was not
independently confirmed at a real narrow viewport in this session.

Docs dev server was stopped cleanly after this verification
(`kill -9` on the vitepress process; confirmed no longer listed in
`ps aux` afterward).

## Part B — Real frontend + Freighter verification

Re-audited `apps/web/lib/wallet.ts`,
`components/wallet/wallet-provider.tsx`,
`components/wallet/wallet-button.tsx`, and
`components/network/network-indicator.tsx` before testing. Used the
frontend dev server already running from earlier session work
(`apps/web`, Next.js 16.3.6, `http://localhost:3000`) against the real
`.env.local`, which points at the **live, verified** Testnet deployment
(`CD4FSW2E2YLGNVPQ6T6DA6FKRK735HLMN676IEF2O5LKZYVDYHHDIIFL` /
`CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`), a real
Soroban RPC URL, and a locally running indexer.

- **Application loads successfully: VERIFIED.** Landing page rendered
  correctly with real config-driven content.
- **Wallet connection control is visible: VERIFIED.** "Connect Wallet"
  button present in the header.
- **Freighter can be invoked / a real Testnet wallet can connect:
  VERIFIED.** A Freighter extension is genuinely installed and already
  authorized for `localhost:3000` in this browser. Clicking the wallet
  control (after an explicit disconnect) re-established a real
  connection to `GBWM5N2S3A3ZWEHNVTLLKSYRYCQB7ALJL4EOVO5ZFX6TSIZ3ZDED2UPB`
  — the same real admin/provider address used throughout this project's
  Testnet evidence — with the wallet panel correctly showing
  `Network: TESTNET`.
- **The connected address is displayed correctly: VERIFIED** (truncated
  form in the header button, full form with a copy control in the
  panel, matching the real address exactly).
- **Disconnect/reconnect behavior works: VERIFIED.** Clicking
  "Disconnect" immediately reverted to the "Connect Wallet" state;
  reconnecting immediately re-established the same real address with no
  errors.
- **The application identifies the expected network correctly:
  VERIFIED.** The header's network badge showed "Testnet" consistently.
- **The known network-mismatch path was exercised: VERIFIED**, by a
  safe, local, non-destructive method: temporarily changed
  `NEXT_PUBLIC_NETWORK_PASSPHRASE` in `apps/web/.env.local` to a
  different real network's passphrase (Futurenet's), restarted the dev
  server, and confirmed the header badge correctly switched to an amber
  "Wallet network mismatch" indicator while the wallet stayed connected
  — exactly matching `network-indicator.tsx`'s documented, visual-only
  behavior (no hard submit block). The original passphrase was restored
  immediately afterward (`diff` confirmed byte-identical to the
  pre-change backup) and the dev server restarted again; the badge
  returned to normal "Testnet" on the next load. `.env.local` is
  gitignored and was never staged or committed at any point.
- **Read-only/public pages remain usable without a wallet: VERIFIED.**
  After disconnecting, `/status/0` loaded and rendered real, live data
  with no wallet connected: real current round number (`29844187` at
  the time of the check, computed from live ledger close time), all
  five real registered watcher addresses shown as "Pending", real bond
  balance (`4.6 native`, reflecting live state — different from the
  `4.5 native` figure in the original 2026-09-27 evidence, confirming
  this is genuinely live data, not a cached snapshot), and the real
  quorum threshold (3).
- **No secret key exposed: VERIFIED by construction and by inspection.**
  No secret key was ever entered into the browser in this session; the
  architecture (confirmed by source read) never handles one client-side.
  Console output was checked for secret-like patterns
  (`S[A-Z0-9]{55}|secret|private`) and found none.

**Real, disclosed defect found — not fixed (out of scope for this
verification pass, and not required to complete it):** loading
`/status/0`'s settlement-history panel produced
`Could not load settlement history: Indexer request to
/v1/slas/0/settlements?limit=20 failed: 500 Internal Server Error`. The
indexer's own log traced this to a real bug in
`indexer/src/rpc/liveReads.ts`'s `fetchQuorumThreshold`: its hardcoded
dummy source-account string
(`GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF`) fails
`@stellar/stellar-sdk`'s `Account` constructor's StrKey checksum
validation (`Error: accountId is invalid`), so any settlement row whose
cached `quorum_threshold` is `null` triggers this 500 on every request.
This is a genuine, previously-undocumented indexer defect, not a
frontend defect and not something this verification pass's scope
(frontend + Freighter) required fixing to complete its checklist above.
Recorded here as a real finding; not filed as a GitHub issue in this
pass, since issue creation wasn't part of this remediation's scope.

**One-time observation, not a confirmed reproducible defect:** on the
very first click of "Connect Wallet" (before any explicit disconnect,
i.e. while the wallet provider's own startup `isFreighterAvailable()`
check may not yet have resolved), the button stuck on "Connecting…"
indefinitely with no error surfaced. This did not reproduce on any
subsequent connect attempt in this session (all of which completed
within about a second). Recorded honestly as observed, not treated as
a confirmed bug and not fixed, since it did not reproduce.

## Part C — Live watcher Testnet verification

Re-read `watcher/README.md`, `watcher/.env.example`,
`watcher/cmd/watcher/main.go`, `watcher/internal/contract/contract.go`,
`watcher/internal/config/config.go`, and the existing test files before
running anything live.

**VERIFIED — the watcher daemon actually talks to live Testnet RPC and
the deployed `watcher_registry` contract**, closing the gap the
README's "Verified status" section describes (tested only against a
mocked RPC transport, never run live).

Setup:
- **Disposable Testnet watcher account**, generated fresh for this
  verification and funded via Friendbot:
  **`GDVB6JFSEDALSDSWA5C7Q6BXDATDJP4AICTPHQQ5PXTO5SNJUKTYSFGL`** (public
  address only; its secret key was never committed, logged, or placed
  in any file other than the gitignored `watcher/.env`, which has since
  been scrubbed back to an empty `WATCHER_SECRET_KEY=`).
- **Registered live** via the real admin path:
  `watcher_registry.register_watcher`, tx
  `a9b53ca277558dc525e696f3597f15efae1908c69445ceef5dfad4cb32e1dc84`,
  against the live, verified registry
  (`CBKAQETJU3PLB54LJRSA7ZH2ZG4TBQHHDSWZ23R4VVTV7WBIX3QZBUZ6`).
  `is_watcher` read `true` immediately after.
- **Real local HTTP target**: `python3 -m http.server` on
  `localhost:8099`, confirmed returning `200` before use.
- **Real config** (`watcher/.env`, gitignored): pointed at the live
  registry, `SLA_ID=0` (an existing SLA on the live deployment — used
  as-is; a fresh SLA was not needed since each watcher's vote is
  independently tracked per `(sla_id, round_id, watcher)`), the real
  Testnet RPC URL and passphrase, and the default 60-second round
  length.
- Built with `go build -o /tmp/watcher-bin ./cmd/watcher` (no source
  changes) and run with `exec ./cmd/watcher`'s real entrypoint.

Observed, real sequence, exactly as the daemon's own code describes it:

| Round | Check (real HTTP GET to localhost:8099) | Submission | On-chain confirmation |
|---|---|---|---|
| 29844195 | `status=Up http_code=200` | submitted (process was killed by me mid-run before this line logged locally — see note below) | `get_round_tally(0, 29844195)` → `{"votes_up":1,"votes_down":0}`; real tx `fd8de72475cfcaaab089db130a7d5d87689c8b57400a84b287d8c74d7e6071b6`, ledger 4925629 |
| 29844196 | `status=Up http_code=200` | `submitted check successfully` | `has_watcher_voted` → `true`; `get_round_tally` → `{"votes_up":1,"votes_down":0}`; real tx `ccc7fabb84bb423fa61c3e3ea0da48ba179a2b4adbc77c668a3ba57404cfe840`, ledger 4925645 |
| 29844197 | `status=Up http_code=200` | `submitted check successfully` | `has_watcher_voted` → `true`; `get_round_tally` → `{"votes_up":1,"votes_down":0}`; real tx `563bd1766c0353ec7855375a5e3cc74dcf4bf0c85e5d06719d6e6c3ae04c9bea`, ledger 4925648 |
| 29844198 | `status=Up http_code=200` | `submitted check successfully` | `get_round_tally(0, 29844198)` → `{"votes_up":1,"votes_down":0}`; real tx `fb8b4462ec31a9fea1a488971af3c90e8d17ec7e6d0e50bbc9cece3adbf7e722`, ledger 4925660 |

Note on round 29844195: my very first run attempt used a shell
`source .env` that mis-parsed the `NETWORK_PASSPHRASE` line (its spaces
and `;` are not valid POSIX shell syntax; this is a real, low-severity
gap — `.env` files in this project are meant for a proper dotenv loader,
e.g. Node's `--env-file`, not `source`, and the watcher's Go code reads
`os.Getenv` directly with no dotenv loader of its own). I killed that
run after seeing the check log but before seeing a submission-confirmed
log line. Horizon's transaction history for the disposable address
shows a real, successful transaction landed 5 seconds after that
round's check — consistent with the same submission timing seen in the
three clean rounds below it — meaning the submission almost certainly
completed server-side before my kill signal took effect. Because
`NETWORK_PASSPHRASE` was one of the mis-parsed values, and the resulting
transaction succeeded, the mis-parse must have left it unset rather than
set to something wrong (`config.Load`'s `getOrDefault` falls back to the
correct real Testnet passphrase constant when the variable is absent).
I restarted cleanly for rounds 196–198 using a small local launcher
script that reads the `.env` file line-by-line instead of shell
`source`, avoiding the parsing issue entirely for every subsequent
round.

**Four consecutive real rounds observed and confirmed on-chain** — more
than the minimum required round-boundary and second-round checks in the
remediation instructions.

- **Graceful shutdown: VERIFIED.** Sent `SIGTERM` to the running
  process; the daemon logged `shutting down` and exited cleanly (its own
  `signal.NotifyContext(... os.Interrupt, syscall.SIGTERM)` /
  `ctx.Done()` path in `main.go`), confirmed via `ps aux` showing no
  remaining process.
- **No secret material logged: VERIFIED.** The daemon's own log lines
  (`starting watcher for sla_id=...`, `round N: check result...`,
  `round N: submitted check successfully`, `shutting down`) never
  include the secret key, matching `main.go`'s startup log line, which
  names only `sla_id`, `target`, and `round_length`.

Cleanup performed after verification: the disposable watcher was
**removed** from the live registry
(`remove_watcher`, tx
`b6e129cac5de0d7f5509250bf0a474d406038fc7fd82cd52a6452b2eec049142`,
`WatcherRemoved` event confirmed), the local HTTP target server was
stopped, the local Stellar CLI identity file for the disposable key was
deleted, and `watcher/.env`'s `WATCHER_SECRET_KEY` was cleared back to
empty. The disposable account's secret key was never written to any
file the git repository tracks, never logged, and is not reproduced
anywhere in this evidence file — only its public address and real,
public transaction hashes appear above.

## Status vocabulary summary

| Item | Status |
|---|---|
| Docs site desktop visual review (14 required pages, both themes, search, nav) | VERIFIED |
| Docs site mobile/narrow-viewport review | UNVERIFIED — `resize_window` tool has no effect in this environment (see Part A) |
| Frontend loads, wallet control visible | VERIFIED |
| Real Freighter connect/disconnect/reconnect with real Testnet address | VERIFIED |
| Network correctly identified, mismatch path exercised | VERIFIED |
| Public status page usable without a wallet, shows real live data | VERIFIED |
| No secret key exposed anywhere in this session | VERIFIED |
| Indexer settlement-history 500 error (real defect, `liveReads.ts`) | KNOWN LIMITATION (newly discovered; not fixed in this pass) |
| One-time "Connecting…" hang on first click | Observed once, did not reproduce; not treated as a confirmed defect |
| Watcher daemon builds and runs against real Testnet RPC and the live `watcher_registry` contract, across four consecutive real rounds, with graceful shutdown | VERIFIED |
| Watcher secret-key handling (never logged, never committed) | VERIFIED |
