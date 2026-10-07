## Summary
A concise description of what this pull request changes.

## Why this change is needed
The motivation, context, or issue reference addressed by this change.

## Affected area
- [ ] `apps/web` (Frontend)
- [ ] `packages/sdk` (TypeScript SDK)
- [ ] `indexer` (Event Indexer)
- [ ] `watcher` (Go Watcher Daemon)
- [ ] `apps/docs` (Documentation)
- [ ] Toolchain / CI / Evidence

## Validation performed
Details of local test runs, linting, builds, or browser verification steps executed.

## Deployment impact
Any impact on environment variables, Cloudflare Worker bindings, or Vercel production hosting.

## Checklist
- [ ] `pnpm run build`, `lint`, `typecheck`, and `test` pass
- [ ] Indexer build and tests pass (`cd indexer && npm test`)
- [ ] Watcher build, vet, and tests pass (`cd watcher && go test ./...`)
- [ ] No private keys or secrets committed
- [ ] Documentation updated where relevant
