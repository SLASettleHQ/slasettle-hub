import { StrKey } from "@stellar/stellar-sdk";
import {
  computeEndpointHash,
  InvalidSdkInputError,
  trimEndpointInput,
} from "@slasettle/sdk";
import { InvalidTokenAmountError, formatTokenAmount, parseTokenAmount } from "./format";

export interface CreateSlaFormValues {
  endpoint: string;
  token: string;
  bondAmount: string;
  uptimeTargetPercent: string;
  quorumThreshold: string;
  penaltyPerBreach: string;
  beneficiary: string;
}

export type CreateSlaFieldErrors = Partial<Record<keyof CreateSlaFormValues, string>>;

const MAX_I128 = (1n << 127n) - 1n;
const MAX_U32 = 0xffff_ffff;
const MAX_BPS = 10_000;

export interface StaticFieldsResult {
  errors: CreateSlaFieldErrors;
  endpoint?: string;
  endpointHash?: Uint8Array;
  quorumThreshold?: number;
  uptimeTargetBps?: number;
}

/**
 * Validates every field that does not depend on the token's decimals. Runs
 * synchronously so errors can be shown at once, before any network request.
 */
export function validateStaticFields(values: CreateSlaFormValues): StaticFieldsResult {
  const errors: CreateSlaFieldErrors = {};
  const token = values.token.trim();
  const beneficiary = values.beneficiary.trim();

  let endpoint: string | undefined;
  let endpointHash: Uint8Array | undefined;
  try {
    endpoint = trimEndpointInput(values.endpoint);
    endpointHash = computeEndpointHash(values.endpoint, "endpoint");
  } catch (error) {
    if (error instanceof InvalidSdkInputError) {
      if (trimEndpointInput(values.endpoint).length === 0) {
        errors.endpoint = "Enter the service endpoint.";
      } else if (/http:\/\/ or https:\/\//.test(error.message)) {
        errors.endpoint = "Use an absolute HTTP or HTTPS URL.";
      } else {
        errors.endpoint = "Enter a valid absolute URL, including http:// or https://.";
      }
    } else {
      throw error;
    }
  }

  if (!token) errors.token = "Enter the token contract ID.";
  else if (!StrKey.isValidContract(token)) errors.token = "Not a valid token contract ID. It should start with C and be 56 characters.";

  if (!beneficiary) errors.beneficiary = "Enter the beneficiary address.";
  else if (!StrKey.isValidEd25519PublicKey(beneficiary) && !StrKey.isValidContract(beneficiary)) {
    errors.beneficiary = "Not a valid Stellar address. It should start with G (or C for a contract).";
  }

  let quorumThreshold: number | undefined;
  const quorum = values.quorumThreshold.trim();
  if (!quorum) errors.quorumThreshold = "Enter the number of Down votes required.";
  else if (!/^\d+$/.test(quorum)) errors.quorumThreshold = "Use a whole number, for example 3.";
  else {
    const parsed = Number(quorum);
    if (parsed < 1) errors.quorumThreshold = "At least 1 Down vote is required.";
    else if (parsed > MAX_U32) errors.quorumThreshold = "That number is too large.";
    else quorumThreshold = parsed;
  }

  let uptimeTargetBps: number | undefined;
  const uptime = values.uptimeTargetPercent.trim();
  if (!uptime) errors.uptimeTargetPercent = "Enter an uptime target, for example 99.90.";
  else {
    try {
      const bps = parseTokenAmount(uptime, 2);
      if (bps < 1n) errors.uptimeTargetPercent = "The uptime target must be greater than 0%.";
      else if (bps > BigInt(MAX_BPS)) errors.uptimeTargetPercent = "The target cannot be more than 100%.";
      else uptimeTargetBps = Number(bps);
    } catch (err) {
      errors.uptimeTargetPercent =
        err instanceof InvalidTokenAmountError && /decimal places/.test(err.message)
          ? "Use at most 2 decimal places."
          : "Use a number such as 99.90.";
    }
  }

  return { errors, endpoint, endpointHash, quorumThreshold, uptimeTargetBps };
}

export interface AmountFieldsResult {
  errors: CreateSlaFieldErrors;
  bondAmount?: bigint;
  penaltyPerBreach?: bigint;
}

export function parsePositiveAmount(
  input: string,
  decimals: number,
  label: string,
): { value: bigint } | { error: string } {
  if (!input.trim()) return { error: `Enter the ${label}.` };
  let value: bigint;
  try {
    value = parseTokenAmount(input, decimals);
  } catch (err) {
    if (err instanceof InvalidTokenAmountError && /decimal places/.test(err.message)) {
      return {
        error:
          decimals === 0
            ? "This token has no decimal places. Use a whole number."
            : `This token supports at most ${decimals} decimal places.`,
      };
    }
    return { error: "Use a plain number such as 1000.50." };
  }
  if (value <= 0n) return { error: "The amount must be greater than zero." };
  if (value > MAX_I128) return { error: "That amount is larger than the contract can store." };
  return { value };
}

/** Validates the bond and penalty once the token's decimals are known. All arithmetic is bigint. */
export function validateAmounts(
  values: Pick<CreateSlaFormValues, "bondAmount" | "penaltyPerBreach">,
  decimals: number,
  symbol: string,
): AmountFieldsResult {
  const errors: CreateSlaFieldErrors = {};
  const bond = parsePositiveAmount(values.bondAmount, decimals, "bond amount");
  const penalty = parsePositiveAmount(values.penaltyPerBreach, decimals, "penalty per breach");

  if ("error" in bond) errors.bondAmount = bond.error;
  if ("error" in penalty) errors.penaltyPerBreach = penalty.error;

  if ("value" in bond && "value" in penalty && penalty.value > bond.value) {
    errors.penaltyPerBreach = `The penalty cannot exceed the bond (${formatTokenAmount(bond.value, decimals)} ${symbol}).`;
  }

  return {
    errors,
    bondAmount: "value" in bond ? bond.value : undefined,
    penaltyPerBreach: "value" in penalty ? penalty.value : undefined,
  };
}
