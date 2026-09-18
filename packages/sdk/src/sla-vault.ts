import { nativeToScVal, type Transaction } from "@stellar/stellar-sdk";
import { buildInvokeTx, getSdkConfig, simulateReadCall } from "./client.js";
import { SLA_STATUS_VARIANTS, type SLAConfig, type SLAStatus } from "./types.js";

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

function decodeSlaConfig(raw: unknown): SLAConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("get_sla did not return a struct-shaped value.");
  }
  const record = raw as Record<string, unknown>;
  return {
    provider: requireField(record, "provider") as string,
    token: requireField(record, "token") as string,
    bondAmount: requireField(record, "bond_amount") as bigint,
    uptimeTargetBps: requireField(record, "uptime_target_bps") as number,
    quorumThreshold: requireField(record, "quorum_threshold") as number,
    penaltyPerBreach: requireField(record, "penalty_per_breach") as bigint,
    beneficiary: requireField(record, "beneficiary") as string,
    status: decodeContractEnum<SLAStatus>(
      requireField(record, "status"),
      SLA_STATUS_VARIANTS,
      "SLAConfig.status",
    ),
  };
}

/** Builds an unsigned transaction that calls `sla_vault.create_sla`. */
export async function buildCreateSlaTx(params: {
  provider: string;
  token: string;
  bondAmount: bigint;
  uptimeTargetBps: number;
  quorumThreshold: number;
  penaltyPerBreach: bigint;
  beneficiary: string;
}): Promise<Transaction> {
  const config = getSdkConfig();
  return buildInvokeTx(params.provider, config.slaVaultContractId, "create_sla", [
    nativeToScVal(params.provider, { type: "address" }),
    nativeToScVal(params.token, { type: "address" }),
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
  const config = getSdkConfig();
  return buildInvokeTx(params.caller, config.slaVaultContractId, "cancel_sla", [
    nativeToScVal(params.caller, { type: "address" }),
    nativeToScVal(params.slaId, { type: "u64" }),
  ]);
}

/** Builds an unsigned transaction that calls `sla_vault.withdraw_remaining_bond`. */
export async function buildWithdrawBondTx(params: {
  caller: string;
  slaId: bigint;
}): Promise<Transaction> {
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
