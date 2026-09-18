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
