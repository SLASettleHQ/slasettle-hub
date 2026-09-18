# @slasettle/sdk

TypeScript bindings for the SLASettle Soroban contracts (`sla_vault` and
`watcher_registry`) and for SEP-41 token metadata. Used by `apps/web`; not
published anywhere.

## What this is, and isn't

This package talks directly to Soroban RPC. It has two kinds of exports:

- **Read functions** (`getSla`, `getBondBalance`, `isRoundSettled`,
  `getRoundTally`, `hasWatcherVoted`, `isWatcher`, `getWatcherCount`,
  `getTokenDecimals`, `getTokenSymbol`) simulate a contract call and return
  the decoded result. They never submit anything to the network.
- **Write builders** (`buildCreateSlaTx`, `buildTopUpBondTx`,
  `buildTriggerSettlementTx`, `buildCancelSlaTx`, `buildWithdrawBondTx`)
  build and simulate a transaction and return it **unsigned**. The SDK never
  signs or submits a transaction — that's the wallet layer's job
  (`apps/web/lib/wallet.ts`), which is the only place a private key or
  extension signing prompt ever enters the picture.

Every binding maps 1:1 to a function documented in
`SLASettle-contract-spec.md`. There is no wrapper for a function that isn't
in that spec, and no field on a returned struct that isn't in it either.

## Setup

```bash
pnpm install
```

## Configuration

The SDK reads its configuration from environment variables at call time —
it has no config file. All four are required before any SDK function will
work:

```text
NEXT_PUBLIC_SOROBAN_RPC_URL
NEXT_PUBLIC_NETWORK_PASSPHRASE
NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID
NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID
```

Calling any SDK function before these are set throws `MissingSdkConfigError`
naming exactly which variables are missing. See `apps/web/.env.example` for
where these are actually supplied in the app.

## Usage

```ts
import { getSla, buildTopUpBondTx } from "@slasettle/sdk";

// Reads are plain async calls — no wallet needed.
const config = await getSla(7n);
console.log(config.status); // "Active" | "Cancelled"

// Writes return an unsigned Transaction for the wallet layer to sign.
const unsignedTx = await buildTopUpBondTx({
  caller: walletAddress,
  slaId: 7n,
  amount: 50_000_0000000n, // token's smallest unit, not a decimal string
});
```

### Money and other large integers

Every `i128`/`u64` value (bond amounts, penalties, SLA/round IDs) is a
`bigint`, both in and out. The SDK never converts these to `number` and
never does arithmetic on them with floating point — precision loss on a
real balance is not an acceptable trade for convenience. Converting a
`bigint` amount to/from a human-typed decimal string is the caller's job
(see `apps/web/lib/format.ts`'s `formatTokenAmount`/`parseTokenAmount`),
done with string/bigint arithmetic only.

### How a read actually works

A read builds a throwaway, unfunded source account (`Keypair.random()`,
sequence `"0"`) to satisfy the shape Soroban RPC's `simulateTransaction`
requires, then decodes the simulation's return value with
`scValToNative`. That throwaway account never needs to exist or hold
funds — simulation doesn't validate it against the ledger.

### How a write actually works

A write builder loads the real caller's account (`server.getAccount`),
builds the invoke-contract operation, and calls `server.prepareTransaction`
to fill in the Soroban resource footprint and fee from simulation. The
returned `Transaction` is unsigned; the wallet layer signs it with
Freighter and submits it.

### Contract enum encoding

`SLAConfig.status` (`SLAStatus`) is a fieldless `#[contracttype] enum` in
Rust. soroban-sdk encodes that on the wire as a one-element `ScVec`
containing the variant's `Symbol` (e.g. `Cancelled` → `["Cancelled"]`), not
as a bare string — `scValToNative` reflects that. `decodeSlaConfig` accounts
for this; see `src/sla-vault.ts`.

## Testing

```bash
pnpm test
```

Tests mock the RPC boundary (`simulateReadCall`/`buildInvokeTx` from
`client.ts`) rather than hitting a real network, and use real strkey
addresses (`Keypair.random()`, `Address.contract(...)`) rather than fake
strings, since `nativeToScVal({ type: "address" })` actually validates
them. Write-builder tests round-trip the encoded arguments back through
`scValToNative` to confirm the encoding is correct, not just that a
function was called.

## Build

```bash
pnpm run build    # emits dist/ (used by apps/web via the workspace protocol)
pnpm run typecheck
```

## Versions

Node 24 LTS, TypeScript 5.9 (the native TS7 compiler isn't yet what
Next.js's own scaffold targets, so this project stays on the 5.x line until
that changes), `@stellar/stellar-sdk` 17.x.
