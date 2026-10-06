import { simulateReadCall } from "./client.js";
import { assertContractId } from "./validate.js";

/** Reads a SEP-41 token contract's `decimals()`. */
export async function getTokenDecimals(tokenContractId: string): Promise<number> {
  assertContractId(tokenContractId, "tokenContractId");
  const result = await simulateReadCall(tokenContractId, "decimals", []);
  if (typeof result !== "number") {
    throw new TypeError(`decimals() returned ${typeof result}, expected a number.`);
  }
  if (!Number.isInteger(result) || result < 0 || result > 38) {
    throw new RangeError(`decimals() returned ${result}, expected a whole number from 0 to 38.`);
  }
  return result;
}

/** Reads a SEP-41 token contract's `symbol()`. */
export async function getTokenSymbol(tokenContractId: string): Promise<string> {
  assertContractId(tokenContractId, "tokenContractId");
  const result = await simulateReadCall(tokenContractId, "symbol", []);
  if (typeof result !== "string") {
    throw new TypeError(`symbol() returned ${typeof result}, expected a string.`);
  }
  return result;
}
