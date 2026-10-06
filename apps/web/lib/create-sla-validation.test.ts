import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { validateAmounts, validateStaticFields, type CreateSlaFormValues } from "./create-sla-validation";

const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 3));
const BENEFICIARY = Keypair.random().publicKey();

const VALID: CreateSlaFormValues = {
  token: TOKEN,
  bondAmount: "1000",
  uptimeTargetPercent: "99.90",
  quorumThreshold: "3",
  penaltyPerBreach: "50",
  beneficiary: BENEFICIARY,
};

describe("validateStaticFields", () => {
  it("accepts a valid set and converts uptime to basis points without floats", () => {
    expect(validateStaticFields(VALID)).toEqual({
      errors: {},
      quorumThreshold: 3,
      uptimeTargetBps: 9990,
    });
    expect(validateStaticFields({ ...VALID, uptimeTargetPercent: "100" }).uptimeTargetBps).toBe(10000);
    expect(validateStaticFields({ ...VALID, uptimeTargetPercent: "0.07" }).uptimeTargetBps).toBe(7);
  });

  it("reports every empty field", () => {
    const { errors } = validateStaticFields({
      token: "",
      bondAmount: "",
      uptimeTargetPercent: "",
      quorumThreshold: "",
      penaltyPerBreach: "",
      beneficiary: "",
    });
    expect(Object.keys(errors).sort()).toEqual(["beneficiary", "quorumThreshold", "token", "uptimeTargetPercent"]);
  });

  it("rejects a token that is not a contract ID, including an account address", () => {
    expect(validateStaticFields({ ...VALID, token: "CABC" }).errors.token).toMatch(/valid token contract ID/);
    expect(validateStaticFields({ ...VALID, token: BENEFICIARY }).errors.token).toBeDefined();
  });

  it("accepts a contract address as beneficiary and rejects garbage", () => {
    expect(validateStaticFields({ ...VALID, beneficiary: TOKEN }).errors.beneficiary).toBeUndefined();
    expect(validateStaticFields({ ...VALID, beneficiary: "nobody" }).errors.beneficiary).toMatch(/valid Stellar address/);
  });

  it.each(["0", "-1", "1.5", "1e1", "three", "4294967296"])("rejects quorum %s", (quorum) => {
    expect(validateStaticFields({ ...VALID, quorumThreshold: quorum }).errors.quorumThreshold).toBeDefined();
  });

  it("accepts the largest u32 quorum", () => {
    expect(validateStaticFields({ ...VALID, quorumThreshold: "4294967295" }).quorumThreshold).toBe(4294967295);
  });

  it.each([
    ["100.01", /more than 100%/],
    ["99.999", /at most 2 decimal/],
    ["abc", /Use a number/],
    ["-5", /Use a number/],
  ])("rejects uptime %s", (uptime, message) => {
    expect(validateStaticFields({ ...VALID, uptimeTargetPercent: uptime }).errors.uptimeTargetPercent).toMatch(message);
  });

  it("does not silently coerce a blank uptime to zero", () => {
    const result = validateStaticFields({ ...VALID, uptimeTargetPercent: "  " });
    expect(result.errors.uptimeTargetPercent).toBeDefined();
    expect(result.uptimeTargetBps).toBeUndefined();
  });
});

describe("validateAmounts", () => {
  it("converts to base units exactly for a 7-decimal token", () => {
    expect(validateAmounts({ bondAmount: "1000.5", penaltyPerBreach: "50" }, 7, "USDC")).toEqual({
      errors: {},
      bondAmount: 10_005_000_000n,
      penaltyPerBreach: 500_000_000n,
    });
  });

  it("works for a zero-decimal token and rejects fractions there", () => {
    expect(validateAmounts({ bondAmount: "1000", penaltyPerBreach: "50" }, 0, "PTS").bondAmount).toBe(1000n);
    expect(validateAmounts({ bondAmount: "10.5", penaltyPerBreach: "5" }, 0, "PTS").errors.bondAmount).toMatch(
      /no decimal places/,
    );
  });

  it("rejects more decimals than the token supports, and names the limit", () => {
    expect(validateAmounts({ bondAmount: "1.123456789", penaltyPerBreach: "1" }, 7, "USDC").errors.bondAmount).toMatch(
      /at most 7 decimal/,
    );
  });

  it("rejects empty, zero and malformed amounts per field", () => {
    const { errors } = validateAmounts({ bondAmount: "", penaltyPerBreach: "0" }, 7, "USDC");
    expect(errors.bondAmount).toMatch(/Enter the bond amount/);
    expect(errors.penaltyPerBreach).toMatch(/greater than zero/);
    expect(validateAmounts({ bondAmount: "1,000", penaltyPerBreach: "1" }, 7, "X").errors.bondAmount).toMatch(
      /plain number/,
    );
  });

  it("rejects a penalty above the bond and states the bond", () => {
    const { errors } = validateAmounts({ bondAmount: "10", penaltyPerBreach: "50" }, 7, "USDC");
    expect(errors.penaltyPerBreach).toBe("The penalty cannot exceed the bond (10 USDC).");
  });

  it("allows a penalty equal to the bond", () => {
    expect(validateAmounts({ bondAmount: "10", penaltyPerBreach: "10" }, 7, "USDC").errors).toEqual({});
  });

  it("keeps full precision for amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const result = validateAmounts({ bondAmount: "123456789012345678", penaltyPerBreach: "1" }, 7, "X");
    expect(result.bondAmount).toBe(1_234_567_890_123_456_780_000_000n);
  });

  it("rejects an amount above the i128 maximum", () => {
    const tooBig = ((1n << 127n) / 10n ** 7n + 1n).toString();
    expect(validateAmounts({ bondAmount: tooBig, penaltyPerBreach: "1" }, 7, "X").errors.bondAmount).toMatch(
      /larger than the contract can store/,
    );
  });
});
