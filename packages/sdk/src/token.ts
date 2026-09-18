import { simulateReadCall } from "./client.js";

/** Reads a SEP-41 token contract's `decimals()`. */
export async function getTokenDecimals(tokenContractId: string): Promise<number> {
  const result = await simulateReadCall(tokenContractId, "decimals", []);
  if (typeof result !== "number") {
    throw new TypeError(`decimals() returned ${typeof result}, expected a number.`);
  }
  return result;
}

/** Reads a SEP-41 token contract's `symbol()`. */
export async function getTokenSymbol(tokenContractId: string): Promise<string> {
  const result = await simulateReadCall(tokenContractId, "symbol", []);
  if (typeof result !== "string") {
    throw new TypeError(`symbol() returned ${typeof result}, expected a string.`);
  }
  return result;
}
