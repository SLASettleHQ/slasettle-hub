import { Address, Keypair, scValToNative } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getSdkConfig: vi.fn(),
  simulateReadCall: vi.fn(),
  buildInvokeTx: vi.fn(),
}));

import { buildInvokeTx, getSdkConfig, simulateReadCall } from "./client.js";
import {
  buildCancelSlaTx,
  buildCreateSlaTx,
  buildTopUpBondTx,
  buildTriggerSettlementTx,
  buildWithdrawBondTx,
  getBondBalance,
  getSla,
  isRoundSettled,
} from "./sla-vault.js";

const simulateReadCallMock = vi.mocked(simulateReadCall);
const buildInvokeTxMock = vi.mocked(buildInvokeTx);
const getSdkConfigMock = vi.mocked(getSdkConfig);

// Real, validly-formatted strkey addresses — nativeToScVal({type: "address"})
// actually validates and encodes these, so fake placeholder strings like
// "GPROVIDER" would throw rather than exercise the real encoding path.
const PROVIDER = Keypair.random().publicKey();
const BENEFICIARY = Keypair.random().publicKey();
const CALLER = Keypair.random().publicKey();
const TOKEN = Address.contract(new Uint8Array(32).fill(1)).toString();
const VAULT_CONTRACT_ID = Address.contract(new Uint8Array(32).fill(2)).toString();

getSdkConfigMock.mockReturnValue({
  sorobanRpcUrl: "https://rpc.test",
  networkPassphrase: "Test SDF Network ; September 2015",
  slaVaultContractId: VAULT_CONTRACT_ID,
  watcherRegistryContractId: Address.contract(new Uint8Array(32).fill(3)).toString(),
});

const RAW_SLA_CONFIG = {
  provider: PROVIDER,
  token: TOKEN,
  bond_amount: 1_000_000_000n,
  uptime_target_bps: 9990,
  quorum_threshold: 3,
  penalty_per_breach: 50_000_000n,
  beneficiary: BENEFICIARY,
  status: ["Active"],
};

describe("getSla", () => {
  beforeEach(() => {
    simulateReadCallMock.mockReset();
  });

  it("decodes a struct-shaped result into camelCase SLAConfig", async () => {
    simulateReadCallMock.mockResolvedValue(RAW_SLA_CONFIG);

    const config = await getSla(7n);

    expect(config).toEqual({
      provider: PROVIDER,
      token: TOKEN,
      bondAmount: 1_000_000_000n,
      uptimeTargetBps: 9990,
      quorumThreshold: 3,
      penaltyPerBreach: 50_000_000n,
      beneficiary: BENEFICIARY,
      status: "Active",
    });
    expect(simulateReadCallMock).toHaveBeenCalledWith(VAULT_CONTRACT_ID, "get_sla", expect.any(Array));
  });

  it("decodes a Cancelled status", async () => {
    simulateReadCallMock.mockResolvedValue({ ...RAW_SLA_CONFIG, status: ["Cancelled"] });
    const config = await getSla(7n);
    expect(config.status).toBe("Cancelled");
  });

  it("throws a clear error when a field is missing", async () => {
    const { status: _status, ...withoutStatus } = RAW_SLA_CONFIG;
    simulateReadCallMock.mockResolvedValue(withoutStatus);
    await expect(getSla(7n)).rejects.toThrow(/missing expected field "status"/);
  });

  it("throws a clear error on an unrecognized status variant", async () => {
    simulateReadCallMock.mockResolvedValue({ ...RAW_SLA_CONFIG, status: ["Breached"] });
    await expect(getSla(7n)).rejects.toThrow(/expected one of Active, Cancelled/);
  });

  it("throws when the result isn't struct-shaped", async () => {
    simulateReadCallMock.mockResolvedValue(null);
    await expect(getSla(7n)).rejects.toThrow(/did not return a struct-shaped value/);
  });
});

describe("getBondBalance", () => {
  beforeEach(() => {
    simulateReadCallMock.mockReset();
  });

  it("returns the raw bigint", async () => {
    simulateReadCallMock.mockResolvedValue(123_456_789n);
    await expect(getBondBalance(1n)).resolves.toBe(123_456_789n);
  });

  it("rejects a non-bigint result instead of silently coercing it", async () => {
    simulateReadCallMock.mockResolvedValue(123);
    await expect(getBondBalance(1n)).rejects.toThrow(/expected a bigint/);
  });
});

describe("isRoundSettled", () => {
  beforeEach(() => {
    simulateReadCallMock.mockReset();
  });

  it("returns the raw boolean", async () => {
    simulateReadCallMock.mockResolvedValue(true);
    await expect(isRoundSettled(1n, 2n)).resolves.toBe(true);
  });

  it("rejects a non-boolean result", async () => {
    simulateReadCallMock.mockResolvedValue("true");
    await expect(isRoundSettled(1n, 2n)).rejects.toThrow(/expected a boolean/);
  });
});

describe("write transaction builders", () => {
  beforeEach(() => {
    buildInvokeTxMock.mockReset();
    buildInvokeTxMock.mockResolvedValue({} as never);
  });

  it("buildCreateSlaTx encodes every field and targets create_sla", async () => {
    await buildCreateSlaTx({
      provider: PROVIDER,
      token: TOKEN,
      bondAmount: 1_000_000_000n,
      uptimeTargetBps: 9990,
      quorumThreshold: 3,
      penaltyPerBreach: 50_000_000n,
      beneficiary: BENEFICIARY,
    });

    expect(buildInvokeTxMock).toHaveBeenCalledTimes(1);
    const [caller, contractId, method, args] = buildInvokeTxMock.mock.calls[0]!;
    expect(caller).toBe(PROVIDER);
    expect(contractId).toBe(VAULT_CONTRACT_ID);
    expect(method).toBe("create_sla");
    expect(args).toHaveLength(7);
    expect(args!.map((scVal) => scValToNative(scVal))).toEqual([
      PROVIDER,
      TOKEN,
      1_000_000_000n,
      9990,
      3,
      50_000_000n,
      BENEFICIARY,
    ]);
  });

  it("buildTopUpBondTx targets top_up_bond with (caller, sla_id, amount)", async () => {
    await buildTopUpBondTx({ caller: CALLER, slaId: 7n, amount: 10n });
    const [caller, contractId, method, args] = buildInvokeTxMock.mock.calls[0]!;
    expect([caller, contractId, method]).toEqual([CALLER, VAULT_CONTRACT_ID, "top_up_bond"]);
    expect(args!.map((scVal) => scValToNative(scVal))).toEqual([CALLER, 7n, 10n]);
  });

  it("buildTriggerSettlementTx builds with whichever caller invokes it", async () => {
    await buildTriggerSettlementTx({ caller: CALLER, slaId: 7n, roundId: 42n });
    const [caller, , method, args] = buildInvokeTxMock.mock.calls[0]!;
    expect(caller).toBe(CALLER);
    expect(method).toBe("trigger_settlement");
    expect(args!.map((scVal) => scValToNative(scVal))).toEqual([CALLER, 7n, 42n]);
  });

  it("buildCancelSlaTx targets cancel_sla with (caller, sla_id)", async () => {
    await buildCancelSlaTx({ caller: CALLER, slaId: 7n });
    const [, , method, args] = buildInvokeTxMock.mock.calls[0]!;
    expect(method).toBe("cancel_sla");
    expect(args!.map((scVal) => scValToNative(scVal))).toEqual([CALLER, 7n]);
  });

  it("buildWithdrawBondTx targets withdraw_remaining_bond with (caller, sla_id)", async () => {
    await buildWithdrawBondTx({ caller: CALLER, slaId: 7n });
    const [, , method, args] = buildInvokeTxMock.mock.calls[0]!;
    expect(method).toBe("withdraw_remaining_bond");
    expect(args!.map((scVal) => scValToNative(scVal))).toEqual([CALLER, 7n]);
  });
});
