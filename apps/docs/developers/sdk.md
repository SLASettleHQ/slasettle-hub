# TypeScript SDK Reference

The `@slasettle/sdk` package provides high-level TypeScript interfaces for interacting with SLASettle Soroban contracts. It abstracts XDR simulation, footprint preparation, transaction assembly, and contract state decoding.

- **Package Location**: `packages/sdk`
- **Security Boundary**: Zero private keys. The SDK produces **unsigned** transactions intended to be signed by browser wallets (e.g. Freighter) or custodial signing services.

## Monorepo setup and consumption

`packages/sdk` is marked private and is not published to npm. It is available to workspace packages in this repository; external applications cannot install it with `pnpm add @slasettle/sdk`.

From the repository root, install the workspace dependencies and build and typecheck the SDK:

```bash
pnpm install --frozen-lockfile
pnpm --filter @slasettle/sdk build
pnpm --filter @slasettle/sdk typecheck
```

The build emits `dist/index.js` and `dist/index.d.ts`, which are the package's configured JavaScript and TypeScript entrypoints. Workspace consumers such as `apps/web` declare the local package with the `workspace:` protocol:

```json
{
  "dependencies": {
    "@slasettle/sdk": "workspace:*"
  }
}
```

After building the SDK, import its public API from `@slasettle/sdk` inside a workspace package. The examples below use exports from `packages/sdk/src/index.ts`.

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
import { buildCreateSlaTx, computeEndpointHash } from "@slasettle/sdk";

const endpointUrl = "https://api.example.com/health";
const endpointHash = computeEndpointHash(endpointUrl);

// Supply real public addresses from the connected Testnet wallet and intended beneficiary.
async function buildExampleCreateTransaction(provider: string, beneficiary: string) {
  return buildCreateSlaTx({
    provider,
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    endpointHash,                   // Alternatively provide endpointUrl, but not both.
    bondAmount: 100_000_000n,       // 10 XLM in stroops (bigint)
    uptimeTargetBps: 9990,          // Descriptive target; not aggregate settlement logic.
    quorumThreshold: 2,             // Must be <= the registered watcher count.
    penaltyPerBreach: 10_000_000n,  // 1 XLM per breached round
    beneficiary,
  });
}

// The SDK hashes the same normalized URL commitment used by the watcher tooling.
console.log(endpointHash.length); // 32 bytes
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
import {
  getCurrentRound,
  getRoundTally,
  getSla,
  hasWatcherVoted,
  isWatcher,
  getWatcherCount,
} from "@slasettle/sdk";

// Read the SLA's committed endpoint, then query that endpoint's current-round tally.
const slaId = 0n;
const sla = await getSla(slaId);
const roundId = await getCurrentRound();
const tally = await getRoundTally(slaId, roundId, sla.endpointHash);
console.log(`Votes Up: ${tally.votesUp}, Votes Down: ${tally.votesDown}`);

// Supply a real watcher public address from your configuration.
async function inspectWatcher(watcherAddress: string) {
  const voted = await hasWatcherVoted(slaId, roundId, watcherAddress);
  const authorized = await isWatcher(watcherAddress);
  return { voted, authorized };
}

const count = await getWatcherCount();
```

---

## Type Safety & BigInt Conventions

All token quantities, balances, and ledger indices use native JavaScript `bigint` types rather than floating-point `number` primitives to prevent integer truncation and precision loss when dealing with 128-bit values.
