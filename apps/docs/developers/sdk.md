# TypeScript SDK Reference

The `@slasettle/sdk` package provides high-level TypeScript interfaces for interacting with SLASettle Soroban contracts. It abstracts XDR simulation, footprint preparation, transaction assembly, and contract state decoding.

- **Package Location**: `packages/sdk`
- **Security Boundary**: Zero private keys. The SDK produces **unsigned** transactions intended to be signed by browser wallets (e.g. Freighter) or custodial signing services.

## Installation

Within the monorepo or an external application:

```bash
pnpm add @slasettle/sdk @stellar/stellar-sdk
```

---

## Configuration

The SDK initializes its RPC server and contract targets from environment variables:

```ts
import { getSdkConfig, MissingSdkConfigError } from "@slasettle/sdk";

try {
  const config = getSdkConfig();
  console.log("Connected to Soroban RPC:", config.sorobanRpcUrl);
} catch (error) {
  if (error instanceof MissingSdkConfigError) {
    console.error("Missing required variables:", error.missingKeys);
  }
}
```

---

## Transaction Assembly (Write Operations)

Write methods return fully simulated and prepared, unsigned `Transaction` objects from `@stellar/stellar-sdk`:

### 1. `buildCreateSlaTx`
```ts
import { buildCreateSlaTx } from "@slasettle/sdk";

const tx = await buildCreateSlaTx({
  provider: "G...",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  bondAmount: 100_000_000n,       // 10 XLM in stroops (bigint)
  uptimeTargetBps: 9990,          // 99.9%
  quorumThreshold: 3,             // 3 of 5 watchers
  penaltyPerBreach: 10_000_000n,  // 1 XLM per breach
  beneficiary: "G...",
});
```

### 2. `buildTopUpBondTx`
```ts
import { buildTopUpBondTx } from "@slasettle/sdk";

const tx = await buildTopUpBondTx({
  caller: "G...",                 // Must match provider
  slaId: 2n,
  amount: 50_000_000n,            // Additional collateral
});
```

### 3. `buildTriggerSettlementTx`
```ts
import { buildTriggerSettlementTx } from "@slasettle/sdk";

// Permissionless: any caller address can execute
const tx = await buildTriggerSettlementTx({
  caller: "G...",
  slaId: 2n,
  roundId: 1042n,
});
```

### 4. `buildCancelSlaTx`
```ts
import { buildCancelSlaTx } from "@slasettle/sdk";

const tx = await buildCancelSlaTx({
  caller: "G...",                 // Must match provider
  slaId: 2n,
});
```

### 5. `buildWithdrawBondTx`
```ts
import { buildWithdrawBondTx } from "@slasettle/sdk";

const tx = await buildWithdrawBondTx({
  caller: "G...",                 // Must match provider
  slaId: 2n,
});
```

---

## On-Chain Contract Reads

Read methods execute simulated calls against Soroban RPC using an ephemeral source account, returning decoded native TypeScript types:

### `sla_vault` State Reads
```ts
import { getSla, getBondBalance, isRoundSettled } from "@slasettle/sdk";

// Retrieve agreement configuration
const sla = await getSla(2n);
console.log(sla.provider, sla.status, sla.bondAmount);

// Retrieve remaining escrow balance
const balance = await getBondBalance(2n);

// Check if a specific round has been settled
const settled = await isRoundSettled(2n, 1042n);
```

### `watcher_registry` State Reads
```ts
import { getRoundTally, hasWatcherVoted, isWatcher, getWatcherCount } from "@slasettle/sdk";

// Retrieve vote tallies for an active round
const tally = await getRoundTally(2n, 1042n);
console.log(`Votes Up: ${tally.votesUp}, Votes Down: ${tally.votesDown}`);

// Check if a watcher node has attested
const voted = await hasWatcherVoted(2n, 1042n, "G...");

// Check watcher authorization status
const authorized = await isWatcher("G...");
const count = await getWatcherCount();
```

---

## Type Safety & BigInt Conventions

All token quantities, balances, and ledger indices use native JavaScript `bigint` types rather than floating-point `number` primitives to prevent integer truncation and precision loss when dealing with 128-bit values.
