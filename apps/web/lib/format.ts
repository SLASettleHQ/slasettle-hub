/** Shortens a Stellar G.../C... address to e.g. "GABC…WXYZ" for display. */
export function truncateAddress(address: string, visible = 4): string {
  if (address.length <= visible * 2 + 1) {
    return address;
  }
  return `${address.slice(0, visible)}…${address.slice(-visible)}`;
}

/**
 * Formats a raw integer token amount (as returned by the contract, in the
 * token's smallest unit) for display, using only bigint/string arithmetic —
 * never `Number()` or floating point, which would risk precision loss on
 * large balances.
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;

  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;

  const wholeDigits = whole.toString();
  const groupedWhole = wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimals === 0) {
    return `${negative ? "-" : ""}${groupedWhole}`;
  }

  const fractionDigits = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  const fractionPart = fractionDigits.length > 0 ? `.${fractionDigits}` : "";

  return `${negative ? "-" : ""}${groupedWhole}${fractionPart}`;
}

export class InvalidTokenAmountError extends Error {}

/**
 * Parses a human-entered decimal string (e.g. "100.50") into the token's
 * smallest-unit integer amount, using only string/bigint arithmetic — never
 * `parseFloat`/`Number`, which would risk precision loss. Throws
 * {@link InvalidTokenAmountError} for anything that isn't a plain
 * non-negative decimal, or that specifies more fractional digits than the
 * token supports.
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new InvalidTokenAmountError(`"${input}" is not a valid amount.`);
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > decimals) {
    throw new InvalidTokenAmountError(
      `"${input}" has more decimal places than this token supports (${decimals}).`,
    );
  }

  const whole = BigInt(wholePart || "0");
  const fraction = BigInt(fractionPart.padEnd(decimals, "0") || "0");
  return whole * 10n ** BigInt(decimals) + fraction;
}
