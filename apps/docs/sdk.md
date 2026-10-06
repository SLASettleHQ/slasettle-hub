# SDK

`packages/sdk` (`@slasettle/sdk`, in the pnpm workspace). Pure
TypeScript, no signing capability anywhere in it. Every write function
returns an **unsigned** `Transaction` (from `@stellar/stellar-sdk`) for
the caller's own wallet to sign.

## Configuration

The SDK has no config file. `getSdkConfig()` reads four environment
variables directly (see [Environment variables](/environment-variables)
for the full names) and caches the result. If any is missing, it throws
`MissingSdkConfigError` naming exactly which ones — it never falls back
to a guessed value. A value that is present but malformed (an RPC URL that
is not http(s), a passphrase with stray whitespace, a contract ID that is
not a valid `C...` strkey) throws `InvalidSdkConfigError` listing each
problem.

```ts
import { getSdkConfig, MissingSdkConfigError } from "@slasettle/sdk";
```

`getRpcServer()` returns a shared, lazily-constructed
`@stellar/stellar-sdk` `rpc.Server` built from `sorobanRpcUrl`.

## Building write transactions (`sla-vault.ts`)

Each of these builds a fully-prepared, unsigned `Transaction` — resource
fees and footprint are already filled in via simulation
(`server.prepareTransaction`) — ready to hand to a wallet:

```ts
buildCreateSlaTx(params: {
  provider: string; token: string; bondAmount: bigint;
  uptimeTargetBps: number; quorumThreshold: number;
  penaltyPerBreach: bigint; beneficiary: string;
}): Promise<Transaction>

buildTopUpBondTx(params: { caller: string; slaId: bigint; amount: bigint }): Promise<Transaction>

buildTriggerSettlementTx(params: { caller: string; slaId: bigint; roundId: bigint }): Promise<Transaction>
// No provider authorization is required by the contract — any account
// may build and submit this.

buildCancelSlaTx(params: { caller: string; slaId: bigint }): Promise<Transaction>

buildWithdrawBondTx(params: { caller: string; slaId: bigint }): Promise<Transaction>
```

All `bigint` arguments map to Soroban `i128`/`u64`, never `number` — see
[Testing](/testing) for why this matters (a `number` above
`2^53 - 1` silently loses precision; a `bigint` never does).

## Reading contract state (`sla-vault.ts`, `watcher-registry.ts`, `token.ts`)

These call `simulateReadCall` under the hood — a real Soroban RPC
simulation against a throwaway, unfunded source account (valid, because
`simulateTransaction` never submits or checks that account against the
ledger), never a cached or guessed value:

```ts
getSla(slaId: bigint): Promise<SLAConfig>
getBondBalance(slaId: bigint): Promise<bigint>
isRoundSettled(slaId: bigint, roundId: bigint): Promise<boolean>

getRoundTally(slaId: bigint, roundId: bigint): Promise<RoundTally>
hasWatcherVoted(slaId: bigint, roundId: bigint, watcher: string): Promise<boolean>
isWatcher(watcher: string): Promise<boolean>
getWatcherCount(): Promise<number>

getTokenDecimals(tokenContractId: string): Promise<number>
getTokenSymbol(tokenContractId: string): Promise<string>
```

`SLAConfig` and `RoundTally`:

```ts
interface SLAConfig {
  provider: string;
  token: string;
  bondAmount: bigint;
  uptimeTargetBps: number;   // display only, see Lifecycle
  quorumThreshold: number;
  penaltyPerBreach: bigint;
  beneficiary: string;
  status: "Active" | "Cancelled";
}

interface RoundTally {
  votesUp: number;
  votesDown: number;
}
```

Every decode function validates the raw simulation result's shape before
returning — a missing field or an unexpected type throws a descriptive
`TypeError` naming the field, rather than returning `undefined` or a
default. This is deliberate: it surfaces a deployed-contract/SDK
mismatch immediately instead of producing a subtly wrong UI value.

## Errors

```ts
class MissingSdkConfigError extends Error { missingKeys: string[] }
class InvalidSdkConfigError extends Error { problems: string[] }
class InvalidSdkInputError extends Error { field: string }
class SorobanSimulationError extends Error {
  contractId: string; method: string; rpcMessage: string;
}
```

`SorobanSimulationError` is thrown whenever a simulated read call fails
— for example, a `get_sla` call for an `sla_id` that doesn't exist will
surface here with the contract's own error message.

`InvalidSdkInputError` is thrown before any RPC call when an argument is
one the contract would reject: a malformed address, a non-positive or
over-`i128` amount, basis points above 10000, a zero quorum, an SLA or round
ID outside `u64`, or token decimals outside 0 to 38.

## Quorum

There is no contract call for quorum. `sla_vault` owns `quorum_threshold`
and `watcher_registry` only counts votes, so
`deriveQuorum(tally, quorumThreshold)` computes it from the two reads:
`reached` is `votesDown >= quorumThreshold`, and Up votes never count.

## What this SDK deliberately does not do

- It never imports or references a private key, seed phrase, or
  Freighter API call. Signing is the caller's job — in this project,
  `apps/web`'s `lib/wallet.ts` — never the SDK's.
- It never submits a transaction to the network itself; `buildInvokeTx`
  and the `build*Tx` functions stop at "unsigned, prepared transaction."
- It has no retry, polling, or caching logic of its own beyond the
  single `getSdkConfig()`/`getRpcServer()` memoization described above.
