import { nativeToScVal, type Transaction } from "@stellar/stellar-sdk";
import { buildInvokeTx, getSdkConfig, simulateReadCall } from "./client.js";
import { computeEndpointHash } from "./hash.js";
import {
  MAX_BPS,
  InvalidSdkInputError,
  assertAddress,
  assertContractId,
  assertPositiveAmount,
  assertU32,
  assertU64,
} from "./validate.js";
import { SLA_STATUS_VARIANTS, type SLAConfig, type SLAStatus } from "./types.js";

function expectEndpointHash(raw: unknown, field: string): Uint8Array {
  if (!(raw instanceof Uint8Array) || raw.length !== 32) {
    throw new TypeError(
      `${field} is ${typeof raw}, expected 32 bytes (BytesN<32>). The deployed ` +
        "sla_vault contract may not match the SDK's expected SLAConfig shape.",
    );
  }
  return raw;
}

/** Validates and returns the 32-byte endpoint commitment from either option. */
function resolveEndpointHash(params: { endpointUrl?: string; endpointHash?: Uint8Array }): Uint8Array {
  const hasUrl = params.endpointUrl !== undefined;
  const hasHash = params.endpointHash !== undefined;
  if (hasUrl === hasHash) {
    throw new InvalidSdkInputError(
      "endpointUrl/endpointHash",
      "exactly one of endpointUrl or endpointHash must be provided.",
    );
  }
  if (hasUrl) {
    return computeEndpointHash(params.endpointUrl as string, "endpointUrl");
  }
  const hash = params.endpointHash as Uint8Array;
  if (hash.length !== 32) {
    throw new InvalidSdkInputError("endpointHash", "must be exactly 32 bytes.");
  }
  return hash;
}

function requireField(
  raw: Record<string, unknown>,
  key: string,
): unknown {
  if (!(key in raw)) {
    throw new TypeError(
      `get_sla result is missing expected field "${key}". The deployed ` +
        "sla_vault contract may not match the SDK's expected SLAConfig shape.",
    );
  }
  return raw[key];
}

/**
 * soroban-sdk encodes a fieldless `#[contracttype] enum` variant as a
 * one-element ScVec containing the variant's Symbol — scValToNative
 * therefore decodes it as a single-element JS array, e.g. `["Cancelled"]`,
 * not as a bare string.
 */
function decodeContractEnum<T extends string>(
  value: unknown,
  variants: readonly T[],
  context: string,
): T {
  const tag = Array.isArray(value) ? value[0] : undefined;
  if (typeof tag !== "string" || !(variants as readonly string[]).includes(tag)) {
    throw new TypeError(
      `${context}: expected one of ${variants.join(", ")}, got ${JSON.stringify(value)}.`,
    );
  }
  return tag as T;
}

function expectType<T>(
  value: unknown,
  type: "string" | "bigint" | "number",
  field: string,
): T {
  if (typeof value !== type) {
    throw new TypeError(
      `get_sla field "${field}" is ${typeof value}, expected ${type}. The deployed ` +
        "sla_vault contract may not match the SDK's expected SLAConfig shape.",
    );
  }
  return value as T;
}

function decodeSlaConfig(raw: unknown): SLAConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("get_sla did not return a struct-shaped value.");
  }
  const record = raw as Record<string, unknown>;
  return {
    provider: expectType<string>(requireField(record, "provider"), "string", "provider"),
    token: expectType<string>(requireField(record, "token"), "string", "token"),
    endpointHash: expectEndpointHash(requireField(record, "endpoint_hash"), "endpoint_hash"),
    bondAmount: expectType<bigint>(requireField(record, "bond_amount"), "bigint", "bond_amount"),
    uptimeTargetBps: expectType<number>(requireField(record, "uptime_target_bps"), "number", "uptime_target_bps"),
    quorumThreshold: expectType<number>(requireField(record, "quorum_threshold"), "number", "quorum_threshold"),
    penaltyPerBreach: expectType<bigint>(requireField(record, "penalty_per_breach"), "bigint", "penalty_per_breach"),
    beneficiary: expectType<string>(requireField(record, "beneficiary"), "string", "beneficiary"),
    status: decodeContractEnum<SLAStatus>(
      requireField(record, "status"),
      SLA_STATUS_VARIANTS,
      "SLAConfig.status",
    ),
  };
}

/**
 * Builds an unsigned transaction that calls `sla_vault.create_sla`.
 *
 * Pass exactly one of `endpointUrl` (hashed locally via `computeEndpointHash`
 * before building the transaction) or `endpointHash` (the already-computed
 * 32-byte commitment, e.g. previewed to the user earlier in a form flow).
 */
export async function buildCreateSlaTx(params: {
  provider: string;
  token: string;
  endpointUrl?: string;
  endpointHash?: Uint8Array;
  bondAmount: bigint;
  uptimeTargetBps: number;
  quorumThreshold: number;
  penaltyPerBreach: bigint;
  beneficiary: string;
}): Promise<Transaction> {
  assertAddress(params.provider, "provider");
  assertContractId(params.token, "token");
  assertAddress(params.beneficiary, "beneficiary");
  assertPositiveAmount(params.bondAmount, "bondAmount");
  assertPositiveAmount(params.penaltyPerBreach, "penaltyPerBreach");
  assertU32(params.uptimeTargetBps, "uptimeTargetBps", 1, MAX_BPS);
  assertU32(params.quorumThreshold, "quorumThreshold", 1);
  const endpointHash = resolveEndpointHash(params);
  const config = getSdkConfig();
  return buildInvokeTx(params.provider, config.slaVaultContractId, "create_sla", [
    nativeToScVal(params.provider, { type: "address" }),
    nativeToScVal(params.token, { type: "address" }),
    nativeToScVal(endpointHash, { type: "bytes" }),
    nativeToScVal(params.bondAmount, { type: "i128" }),
    nativeToScVal(params.uptimeTargetBps, { type: "u32" }),
    nativeToScVal(params.quorumThreshold, { type: "u32" }),
    nativeToScVal(params.penaltyPerBreach, { type: "i128" }),
    nativeToScVal(params.beneficiary, { type: "address" }),
  ]);
}

/** Builds an unsigned transaction that calls `sla_vault.top_up_bond`. */
export async function buildTopUpBondTx(params: {
  caller: string;
  slaId: bigint;
  amount: bigint;
}): Promise<Transaction> {
  assertAddress(params.caller, "caller");
  assertU64(params.slaId, "slaId");
  assertPositiveAmount(params.amount, "amount");
  const config = getSdkConfig();
  return buildInvokeTx(params.caller, config.slaVaultContractId, "top_up_bond", [
    nativeToScVal(params.caller, { type: "address" }),
    nativeToScVal(params.slaId, { type: "u64" }),
    nativeToScVal(params.amount, { type: "i128" }),
  ]);
}

/**
 * Builds an unsigned transaction that calls `sla_vault.trigger_settlement`.
 * No provider authorization is required by the contract — any account may
 * call this, and the transaction is built with whichever caller invokes it.
 */
export async function buildTriggerSettlementTx(params: {
  caller: string;
  slaId: bigint;
  roundId: bigint;
}): Promise<Transaction> {
  assertAddress(params.caller, "caller");
  assertU64(params.slaId, "slaId");
  assertU64(params.roundId, "roundId");
  const config = getSdkConfig();
  return buildInvokeTx(
    params.caller,
    config.slaVaultContractId,
    "trigger_settlement",
    [
      nativeToScVal(params.caller, { type: "address" }),
      nativeToScVal(params.slaId, { type: "u64" }),
      nativeToScVal(params.roundId, { type: "u64" }),
    ],
  );
}

/** Builds an unsigned transaction that calls `sla_vault.cancel_sla`. */
export async function buildCancelSlaTx(params: {
  caller: string;
  slaId: bigint;
}): Promise<Transaction> {
  assertAddress(params.caller, "caller");
  assertU64(params.slaId, "slaId");
  const config = getSdkConfig();
  return buildInvokeTx(params.caller, config.slaVaultContractId, "cancel_sla", [
    nativeToScVal(params.caller, { type: "address" }),
    nativeToScVal(params.slaId, { type: "u64" }),
  ]);
}

/**
 * Builds an unsigned transaction that calls `sla_vault.extend_contract_ttl`.
 * Public maintenance entrypoint: no auth required by the contract, but
 * still needs a funded `caller` account to pay the transaction fee.
 */
export async function buildExtendSlaVaultTtlTx(caller: string): Promise<Transaction> {
  assertAddress(caller, "caller");
  const config = getSdkConfig();
  return buildInvokeTx(caller, config.slaVaultContractId, "extend_contract_ttl", []);
}

/** Builds an unsigned transaction that calls `sla_vault.withdraw_remaining_bond`. */
export async function buildWithdrawBondTx(params: {
  caller: string;
  slaId: bigint;
}): Promise<Transaction> {
  assertAddress(params.caller, "caller");
  assertU64(params.slaId, "slaId");
  const config = getSdkConfig();
  return buildInvokeTx(
    params.caller,
    config.slaVaultContractId,
    "withdraw_remaining_bond",
    [
      nativeToScVal(params.caller, { type: "address" }),
      nativeToScVal(params.slaId, { type: "u64" }),
    ],
  );
}

/** Reads an SLA's configuration from `sla_vault.get_sla`. */
export async function getSla(slaId: bigint): Promise<SLAConfig> {
  assertU64(slaId, "slaId");
  const config = getSdkConfig();
  const result = await simulateReadCall(config.slaVaultContractId, "get_sla", [
    nativeToScVal(slaId, { type: "u64" }),
  ]);
  return decodeSlaConfig(result);
}

/** Reads an SLA's current bond balance from `sla_vault.get_bond_balance`. */
export async function getBondBalance(slaId: bigint): Promise<bigint> {
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.slaVaultContractId,
    "get_bond_balance",
    [nativeToScVal(slaId, { type: "u64" })],
  );
  if (typeof result !== "bigint") {
    throw new TypeError(
      `get_bond_balance returned ${typeof result}, expected a bigint (i128).`,
    );
  }
  return result;
}

/** Reads whether a round has been settled from `sla_vault.is_round_settled`. */
export async function isRoundSettled(
  slaId: bigint,
  roundId: bigint,
): Promise<boolean> {
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.slaVaultContractId,
    "is_round_settled",
    [nativeToScVal(slaId, { type: "u64" }), nativeToScVal(roundId, { type: "u64" })],
  );
  if (typeof result !== "boolean") {
    throw new TypeError(
      `is_round_settled returned ${typeof result}, expected a boolean.`,
    );
  }
  return result;
}
