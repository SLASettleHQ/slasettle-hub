# Deployment topology

What is actually deployed anywhere, as of this writing — not an
aspirational architecture.

## Deployed

- **Two Soroban contracts, on Stellar Testnet only.** See
  [Current Testnet deployment](/testnet-deployment) for contract IDs.
  Nothing is deployed to Stellar mainnet.

## Not deployed anywhere

- **No public frontend deployment.** `apps/web` has not been deployed to
  Vercel, Netlify, or any other hosting provider as part of this
  project. Using it means running `pnpm --filter @slasettle/web dev` (or
  `build`/`start`) yourself.
- **No public indexer deployment.** The indexer's SQLite database and
  HTTP API exist only wherever you run `npm start` yourself; there is no
  hosted instance with a stable URL.
- **No running watcher daemon process, anywhere, ongoing.** Every real
  vote referenced in this project's evidence was submitted directly via
  the Stellar CLI in a verification session, not by a `watcher` process
  left running. See [Limitations](/limitations).
- **No CI/CD pipeline that deploys anything.** Both repositories' CI
  (`.github/workflows/ci.yml`) builds, lints, and tests; neither
  publishes a container image, a hosted site, or a release artifact
  automatically.

## What "running SLASettle" actually means today

Everything runs on one machine, pointed at Testnet:

```text
your machine
  ├─ indexer (npm start)  ──── polls ───► Testnet RPC
  │        │
  │        └── serves ───► HTTP API (localhost)
  │
  ├─ apps/web (pnpm dev)  ──── reads ───► indexer HTTP API
  │        │                   reads ───► Testnet RPC (via SDK)
  │        └── your browser + Freighter, for signing
  │
  └─ watcher (go run, optional) ──── submits votes ───► Testnet RPC
```

There is no load balancer, no reverse proxy, no managed database, and no
secrets manager anywhere in this picture — `DB_PATH` is a local SQLite
file, and `WATCHER_SECRET_KEY` is a plain environment variable read once
at process startup.

## If this were to go beyond a single machine

That would require real decisions this project has not made and this
documentation does not invent on its behalf: where the indexer's SQLite
database would live (it is not designed for concurrent multi-process
writers), how `WATCHER_SECRET_KEY` would be stored other than a local
`.env` file, and where the frontend and indexer would actually be
hosted. None of that exists today; see [Limitations](/limitations).
