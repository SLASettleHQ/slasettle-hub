import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.js";

const baseEnv = {
  WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
  SLA_VAULT_CONTRACT_ID: "CVAULT",
};

test("default port is 8787 when neither HTTP_PORT nor PORT is set", () => {
  const config = loadConfig({ ...baseEnv });
  assert.equal(config.HTTP_PORT, 8787);
});

test("HTTP_PORT is used when provided", () => {
  const config = loadConfig({ ...baseEnv, HTTP_PORT: "9000" });
  assert.equal(config.HTTP_PORT, 9000);
});

test("PORT is used as fallback when HTTP_PORT is not provided", () => {
  const config = loadConfig({ ...baseEnv, PORT: "10000" });
  assert.equal(config.HTTP_PORT, 10000);
});

test("explicit HTTP_PORT wins when both HTTP_PORT and PORT are provided", () => {
  const config = loadConfig({ ...baseEnv, HTTP_PORT: "7070", PORT: "9000" });
  assert.equal(config.HTTP_PORT, 7070);
});

test("rejects invalid port values", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, HTTP_PORT: "-1" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, HTTP_PORT: "0" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, HTTP_PORT: "80.5" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, HTTP_PORT: "not-a-number" }),
    /HTTP_PORT/,
  );

  assert.throws(
    () => loadConfig({ ...baseEnv, PORT: "-500" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, PORT: "0" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, PORT: "80.5" }),
    /HTTP_PORT/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, PORT: "abc" }),
    /HTTP_PORT/,
  );
});
