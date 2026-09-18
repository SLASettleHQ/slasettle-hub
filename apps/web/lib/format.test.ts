import { describe, expect, it } from "vitest";
import { InvalidTokenAmountError, formatTokenAmount, parseTokenAmount, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("shortens a long address to head…tail", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV")).toBe(
      "GABC…STUV",
    );
  });

  it("leaves a short string untouched", () => {
    expect(truncateAddress("GABC")).toBe("GABC");
  });

  it("respects a custom visible length", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV", 6)).toBe(
      "GABCDE…QRSTUV",
    );
  });
});

describe("formatTokenAmount", () => {
  it("formats a whole number amount with grouping", () => {
    expect(formatTokenAmount(1_000_000_0000000n, 7)).toBe("1,000,000");
  });

  it("formats a fractional amount, trimming trailing zeros", () => {
    expect(formatTokenAmount(1_500_0000000n, 7)).toBe("1,500");
    expect(formatTokenAmount(15005000n, 7)).toBe("1.5005");
  });

  it("pads small fractional amounts with leading zeros", () => {
    expect(formatTokenAmount(1n, 7)).toBe("0.0000001");
  });

  it("formats zero decimals as a plain integer", () => {
    expect(formatTokenAmount(42n, 0)).toBe("42");
  });

  it("formats a negative amount with a leading minus", () => {
    expect(formatTokenAmount(-15005000n, 7)).toBe("-1.5005");
  });

  it("formats zero without a sign or fraction", () => {
    expect(formatTokenAmount(0n, 7)).toBe("0");
  });
});

describe("parseTokenAmount", () => {
  it("parses a whole number", () => {
    expect(parseTokenAmount("1000", 7)).toBe(10_000_000_000n);
  });

  it("parses a fractional amount, padding to the token's decimals", () => {
    expect(parseTokenAmount("1.5", 7)).toBe(15_000_000n);
  });

  it("parses an amount with no leading whole digit", () => {
    expect(parseTokenAmount(".5", 7)).toBe(5_000_000n);
  });

  it("round-trips through formatTokenAmount", () => {
    const raw = 123_456_7890123n;
    expect(parseTokenAmount(formatTokenAmount(raw, 7).replaceAll(",", ""), 7)).toBe(raw);
  });

  it("rejects more fractional digits than the token supports", () => {
    expect(() => parseTokenAmount("1.12345678", 7)).toThrow(InvalidTokenAmountError);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseTokenAmount("abc", 7)).toThrow(InvalidTokenAmountError);
    expect(() => parseTokenAmount("1.2.3", 7)).toThrow(InvalidTokenAmountError);
    expect(() => parseTokenAmount("", 7)).toThrow(InvalidTokenAmountError);
    expect(() => parseTokenAmount(".", 7)).toThrow(InvalidTokenAmountError);
  });

  it("never routes through parseFloat/Number for the integer result", () => {
    // A value with more significant digits than a float can represent
    // exactly — if this ever silently went through Number(), the result
    // would be corrupted.
    expect(parseTokenAmount("12345678901234567890.1234567", 7)).toBe(123456789012345678901234567n);
  });
});
