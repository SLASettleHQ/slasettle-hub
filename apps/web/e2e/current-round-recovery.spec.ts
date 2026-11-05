import { expect, test } from "@playwright/test";
import { Address, nativeToScVal, TransactionBuilder } from "@stellar/stellar-sdk";

const INDEXER_ORIGIN = "https://indexer.invalid";
const SOROBAN_ORIGIN = "https://soroban.invalid";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const WATCHER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TOKEN = Address.contract(new Uint8Array(32).fill(3)).toString();
const ENDPOINT_HASH = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

const slaConfigXdr = nativeToScVal(
  {
    provider: WATCHER,
    token: TOKEN,
    endpoint_hash: ENDPOINT_HASH,
    bond_amount: 1_000_000_000n,
    uptime_target_bps: 9_900,
    quorum_threshold: 2,
    penalty_per_breach: 50_000_000n,
    beneficiary: WATCHER,
    status: ["Active"],
  },
  {
    type: {
      provider: ["symbol", "address"],
      token: ["symbol", "address"],
      endpoint_hash: ["symbol", "bytes"],
      bond_amount: ["symbol", "i128"],
      uptime_target_bps: ["symbol", "u32"],
      quorum_threshold: ["symbol", "u32"],
      penalty_per_breach: ["symbol", "i128"],
      beneficiary: ["symbol", "address"],
      status: ["symbol", "symbol"],
    },
  },
).toXDR("base64");

const tallyXdr = nativeToScVal(
  { votes_up: 0, votes_down: 0 },
  { type: { votes_up: ["symbol", "u32"], votes_down: ["symbol", "u32"] } },
).toXDR("base64");

function jsonHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json",
  };
}

test("current-round panel recovers after a mocked indexer 503", async ({ page }) => {
  await page.clock.install();

  let currentRoundRequests = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === "http://127.0.0.1:3000") {
      await route.continue();
      return;
    }

    if (url.origin === INDEXER_ORIGIN) {
      if (request.method() !== "GET") {
        await route.abort();
        return;
      }

      if (url.pathname === "/v1/clock") {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({
            ledger_sequence: 5_567_626,
            ledger_close_time: "2026-11-05T10:00:00.000Z",
            current_round_id: 100,
          }),
        });
        return;
      }

      if (url.pathname === "/v1/slas/1/current-round") {
        currentRoundRequests += 1;
        if (currentRoundRequests === 1) {
          await route.fulfill({
            status: 503,
            headers: {
              ...jsonHeaders(),
              "content-type": "text/html",
            },
            body: "<html>temporarily unavailable</html>",
          });
          return;
        }

        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({
            round_id: 100,
            round_started_at: "2026-11-05T10:00:00.000Z",
            checked_in: [],
            not_yet_checked_in: [WATCHER],
          }),
        });
        return;
      }

      if (url.pathname === "/v1/slas/1/settlements") {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({ data: [], next_cursor: null }),
        });
        return;
      }

      await route.fulfill({ status: 404, headers: jsonHeaders(), body: JSON.stringify({ error: "not_found" }) });
      return;
    }

    if (url.origin === SOROBAN_ORIGIN) {
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: jsonHeaders() });
        return;
      }
      if (request.method() !== "POST") {
        await route.abort();
        return;
      }

      const rpcRequest = request.postDataJSON() as {
        id: number | string;
        params: { transaction: string };
      };
      const transaction = TransactionBuilder.fromXDR(rpcRequest.params.transaction, TESTNET_PASSPHRASE);
      const operation = JSON.parse(JSON.stringify(transaction.operations[0])) as {
        func?: { invoke_contract?: { function_name?: string } };
      };
      const method = operation.func?.invoke_contract?.function_name;
      if (!method) throw new Error("mock RPC request was not an invoke-contract transaction");
      const xdrByMethod: Record<string, string> = {
        get_sla: slaConfigXdr,
        get_bond_balance: nativeToScVal(1_000_000_000n, { type: "i128" }).toXDR("base64"),
        decimals: nativeToScVal(7, { type: "u32" }).toXDR("base64"),
        symbol: nativeToScVal("USDC").toXDR("base64"),
        get_round_tally: tallyXdr,
        is_round_settled: nativeToScVal(false).toXDR("base64"),
      };
      const retval = xdrByMethod[method];

      if (!retval) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({ jsonrpc: "2.0", id: rpcRequest.id, error: { code: -32601, message: "unknown method" } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: rpcRequest.id,
          result: {
            id: String(rpcRequest.id),
            latestLedger: 5_567_626,
            events: [],
            minResourceFee: "0",
            results: [{ auth: [], xdr: retval }],
          },
        }),
      });
      return;
    }

    // The test deliberately blocks every other origin so no live service can be contacted.
    await route.abort();
  });

  await page.goto("/status/1");
  await expect(page.getByText("Round 100")).toBeVisible();
  await expect(page.getByText("Watcher check-ins unavailable")).toBeVisible();

  await page.clock.fastForward(10_000);

  await expect(page.getByText("0 of 1 watchers checked in")).toBeVisible();
  await expect(page.getByText("Watcher check-ins unavailable")).not.toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  expect(currentRoundRequests).toBe(2);
});
