import { test } from "node:test";
import assert from "node:assert/strict";
import { amountToString } from "./decode.js";

test("amountToString passes a bigint through as a decimal string", () => {
  assert.equal(amountToString(4_300_000_000n), "4300000000");
});

test("amountToString passes an already-string value through unchanged", () => {
  assert.equal(amountToString("4300000000"), "4300000000");
});

test("amountToString rejects a plain number rather than silently losing precision", () => {
  assert.throws(() => amountToString(4_300_000_000), /JS number/);
});

test("amountToString rejects an unexpected type", () => {
  assert.throws(() => amountToString(null), /unexpected type/);
  assert.throws(() => amountToString({}), /unexpected type/);
});
