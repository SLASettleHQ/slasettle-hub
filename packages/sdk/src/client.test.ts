import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "NEXT_PUBLIC_SOROBAN_RPC_URL",
  "NEXT_PUBLIC_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID",
  "NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID",
] as const;

const VALID_ENV: Record<(typeof ENV_KEYS)[number], string> = {
  NEXT_PUBLIC_SOROBAN_RPC_URL: "https://rpc.example.test",
  NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID: "CVAULT",
  NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID: "CREGISTRY",
};

describe("getSdkConfig", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    vi.resetModules();
  });

  it("throws MissingSdkConfigError naming every missing variable", async () => {
    vi.resetModules();
    const { getSdkConfig, MissingSdkConfigError } = await import("./client.js");

    expect(() => getSdkConfig()).toThrow(MissingSdkConfigError);
    try {
      getSdkConfig();
      expect.fail("expected getSdkConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingSdkConfigError);
      expect((err as InstanceType<typeof MissingSdkConfigError>).missingKeys).toEqual(ENV_KEYS);
    }
  });

  it("returns the full config once every variable is set", async () => {
    vi.resetModules();
    Object.assign(process.env, VALID_ENV);
    const { getSdkConfig } = await import("./client.js");

    expect(getSdkConfig()).toEqual({
      sorobanRpcUrl: VALID_ENV.NEXT_PUBLIC_SOROBAN_RPC_URL,
      networkPassphrase: VALID_ENV.NEXT_PUBLIC_NETWORK_PASSPHRASE,
      slaVaultContractId: VALID_ENV.NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID,
      watcherRegistryContractId: VALID_ENV.NEXT_PUBLIC_WATCHER_REGISTRY_CONTRACT_ID,
    });
  });

  it("reports only the specific variables that are missing", async () => {
    vi.resetModules();
    Object.assign(process.env, VALID_ENV);
    delete process.env.NEXT_PUBLIC_INDEXER_API_URL;
    delete process.env.NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID;
    const { getSdkConfig, MissingSdkConfigError } = await import("./client.js");

    try {
      getSdkConfig();
      expect.fail("expected getSdkConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MissingSdkConfigError);
      expect((err as InstanceType<typeof MissingSdkConfigError>).missingKeys).toEqual([
        "NEXT_PUBLIC_SLA_VAULT_CONTRACT_ID",
      ]);
    }
  });
});
