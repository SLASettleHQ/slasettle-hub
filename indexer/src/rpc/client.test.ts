import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { isTransientNetworkError, withNetworkRetry } from "./client.js";

const silentLogger = pino({ level: "silent" });

function networkError(): unknown {
  return { isAxiosError: true, message: "fetch failed", response: undefined };
}

function httpError(status: number): unknown {
  return { isAxiosError: true, message: `Request failed with status code ${status}`, response: { status } };
}

test("isTransientNetworkError is true only for an AxiosError with no response", () => {
  assert.equal(isTransientNetworkError(networkError()), true);
  assert.equal(isTransientNetworkError(httpError(500)), false);
  assert.equal(isTransientNetworkError(new Error("something else")), false);
  assert.equal(isTransientNetworkError(null), false);
});

test("withNetworkRetry retries a transient network error and returns the eventual success", async () => {
  let calls = 0;
  const result = await withNetworkRetry("test", silentLogger, async () => {
    calls++;
    if (calls < 3) throw networkError();
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withNetworkRetry gives up and rethrows after exhausting attempts", async () => {
  let calls = 0;
  await assert.rejects(
    withNetworkRetry("test", silentLogger, async () => {
      calls++;
      throw networkError();
    }),
    (err: unknown) => (err as { message?: string }).message === "fetch failed",
  );
  assert.equal(calls, 3);
});

test("withNetworkRetry does not retry a real HTTP error response", async () => {
  let calls = 0;
  await assert.rejects(
    withNetworkRetry("test", silentLogger, async () => {
      calls++;
      throw httpError(400);
    }),
  );
  assert.equal(calls, 1);
});
