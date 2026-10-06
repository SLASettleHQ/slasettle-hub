import { StrKey } from "@stellar/stellar-sdk";

/** Thrown when a caller passes a value the contract would reject, before any RPC call is made. */
export class InvalidSdkInputError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = "InvalidSdkInputError";
  }
}

export const MAX_I128 = (1n << 127n) - 1n;
export const MAX_U64 = (1n << 64n) - 1n;
export const MAX_U32 = 0xffff_ffff;
export const MAX_BPS = 10_000;

/** A Stellar account (G...) or contract (C...) address. */
export function assertAddress(value: string, field: string): void {
  if (!StrKey.isValidEd25519PublicKey(value) && !StrKey.isValidContract(value)) {
    throw new InvalidSdkInputError(field, "is not a valid Stellar address (expected G... or C...).");
  }
}

export function assertContractId(value: string, field: string): void {
  if (!StrKey.isValidContract(value)) {
    throw new InvalidSdkInputError(field, "is not a valid contract ID (expected C...).");
  }
}

/** A strictly positive token amount that fits Soroban's i128. */
export function assertPositiveAmount(value: bigint, field: string): void {
  if (typeof value !== "bigint") {
    throw new InvalidSdkInputError(field, "must be a bigint of base units.");
  }
  if (value <= 0n) {
    throw new InvalidSdkInputError(field, "must be greater than zero.");
  }
  if (value > MAX_I128) {
    throw new InvalidSdkInputError(field, "exceeds the maximum i128 value.");
  }
}

export function assertU64(value: bigint, field: string): void {
  if (typeof value !== "bigint" || value < 0n || value > MAX_U64) {
    throw new InvalidSdkInputError(field, "must be an integer between 0 and 2^64 - 1.");
  }
}

export function assertU32(value: number, field: string, min = 0, max = MAX_U32): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidSdkInputError(field, `must be a whole number between ${min} and ${max}.`);
  }
}
