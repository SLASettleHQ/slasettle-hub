import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeCursor, decodeCursor } from "./pagination.js";

test("a cursor round-trips through encode and decode", () => {
  const original = { ledgerCloseTime: "2026-01-01T00:00:00Z", eventId: "0000000100-0" };
  const encoded = encodeCursor(original);
  const decoded = decodeCursor(encoded);
  assert.deepEqual(decoded, original);
});

test("decodeCursor returns undefined for garbage input instead of throwing", () => {
  assert.equal(decodeCursor("not-valid-base64-json"), undefined);
  assert.equal(decodeCursor(""), undefined);
});

test("decodeCursor rejects a decoded object missing required fields", () => {
  const malformed = Buffer.from(JSON.stringify({ somethingElse: true }), "utf-8").toString("base64url");
  assert.equal(decodeCursor(malformed), undefined);
});
