import { rpc } from "@stellar/stellar-sdk";
import { IndexerD1 } from "../db/d1.js";
import { getLatestLedgerInfo } from "../api/ledgerInfo.js";
import { encodeCursor, decodeCursor } from "../api/pagination.js";
import { fetchQuorumThreshold } from "../rpc/liveReads.js";
import type { WorkerEnv } from "./types.js";
import { runIngestionStep } from "./ingest.js";

function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  corsHeaders: HeadersInit,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const d1 = new IndexerD1(env.DB);
  const server = new rpc.Server(env.RPC_URL);
  const roundLengthSeconds = Number(env.ROUND_LENGTH_SECONDS ?? 60);

  // GET /v1/health
  if (request.method === "GET" && path === "/v1/health") {
    const cp = await d1.getCheckpoint();
    return jsonResponse(
      { status: "ok", last_indexed_ledger: cp?.last_ledger ?? null },
      200,
      corsHeaders,
    );
  }

  // GET /v1/watchers
  if (request.method === "GET" && path === "/v1/watchers") {
    const rows = await d1.getEligibleWatchers();
    return jsonResponse(
      {
        data: rows.map((r) => ({ address: r.address, registered_at: r.registered_at })),
        next_cursor: null,
      },
      200,
      corsHeaders,
    );
  }

  // GET /v1/clock
  if (request.method === "GET" && path === "/v1/clock") {
    const ledger = await getLatestLedgerInfo(server);
    const roundId = Math.floor(ledger.closeTimeMs / 1000 / roundLengthSeconds);
    return jsonResponse(
      {
        ledger_sequence: ledger.sequence,
        ledger_close_time: new Date(ledger.closeTimeMs).toISOString(),
        current_round_id: roundId,
      },
      200,
      corsHeaders,
    );
  }

  // GET /v1/slas/:slaId/current-round
  const currentRoundMatch = path.match(/^\/v1\/slas\/([^/]+)\/current-round$/);
  if (request.method === "GET" && currentRoundMatch && currentRoundMatch[1]) {
    const slaId = currentRoundMatch[1];
    const ledger = await getLatestLedgerInfo(server);
    const roundId = Math.floor(ledger.closeTimeMs / 1000 / roundLengthSeconds);

    const watchers = await d1.getEligibleWatchers();
    const checkedIn = await d1.getCheckedInForRound(slaId, String(roundId));

    const checkedInAddresses = new Set(checkedIn.map((c) => c.watcher));
    const notYetCheckedIn = watchers.map((w) => w.address).filter((a) => !checkedInAddresses.has(a));

    return jsonResponse(
      {
        round_id: roundId,
        round_started_at: new Date(roundId * roundLengthSeconds * 1000).toISOString(),
        checked_in: checkedIn.map((c) => ({
          watcher: c.watcher,
          status: c.status,
          checked_at: c.checked_at,
        })),
        not_yet_checked_in: notYetCheckedIn,
      },
      200,
      corsHeaders,
    );
  }

  // GET /v1/slas/:slaId/settlements
  const settlementsMatch = path.match(/^\/v1\/slas\/([^/]+)\/settlements$/);
  if (request.method === "GET" && settlementsMatch && settlementsMatch[1]) {
    const slaId = settlementsMatch[1];
    const limitQuery = url.searchParams.get("limit");
    const requestedLimit = Number(limitQuery ?? 20);

    if (requestedLimit < 0) {
      return jsonResponse(
        { error: "invalid_limit", message: "limit must not be negative" },
        400,
        corsHeaders,
      );
    }
    if (Number.isFinite(requestedLimit) && !Number.isInteger(requestedLimit)) {
      return jsonResponse(
        { error: "invalid_limit", message: "limit must be an integer" },
        400,
        corsHeaders,
      );
    }

    const limit = Math.min(requestedLimit || 20, 100);
    const beforeParam = url.searchParams.get("before");
    const decodedBefore = beforeParam ? decodeCursor(beforeParam) : undefined;

    const { rows, hasMore } = await d1.getSettlementsPage(slaId, limit, decodedBefore);

    for (const row of rows) {
      if (row.quorum_threshold === null) {
        try {
          const threshold = await fetchQuorumThreshold({
            server,
            networkPassphrase: env.NETWORK_PASSPHRASE,
            slaVaultContractId: env.SLA_VAULT_CONTRACT_ID,
            slaId,
          });
          await d1.setSlaQuorumThreshold(slaId, threshold);
          row.quorum_threshold = threshold;
        } catch (err) {
          console.error("Failed to fetch quorum_threshold:", err);
        }
      }
    }

    const data = await Promise.all(
      rows.map(async (r) => {
        const votes = await d1.getVoteCounts(r.sla_id, r.round_id);
        return {
          round_id: Number(r.round_id),
          votes_up: votes.votes_up,
          votes_down: votes.votes_down,
          quorum_threshold: r.quorum_threshold,
          penalty_amount: r.penalty_amount,
          beneficiary: r.beneficiary,
          tx_hash: r.tx_hash,
          ledger_close_time: r.ledger_close_time,
          explorer_url: `https://stellar.expert/explorer/testnet/tx/${r.tx_hash}`,
        };
      }),
    );

    const last = rows[rows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ ledgerCloseTime: last.ledger_close_time, eventId: last.event_id })
        : null;

    return jsonResponse({ data, next_cursor: nextCursor }, 200, corsHeaders);
  }

  // GET /v1/providers/:address/slas
  const providerMatch = path.match(/^\/v1\/providers\/([^/]+)\/slas$/);
  if (request.method === "GET" && providerMatch && providerMatch[1]) {
    const address = providerMatch[1];
    const rows = await d1.getProviderSlas(address);
    return jsonResponse(
      {
        data: rows.map((r) => ({
          sla_id: Number(r.sla_id),
          token: r.token,
          bond_amount_at_creation: r.bond_amount_at_creation,
          beneficiary: r.beneficiary,
          created_at: r.created_at,
          tx_hash: r.tx_hash,
        })),
        next_cursor: null,
      },
      200,
      corsHeaders,
    );
  }

  // POST /v1/ingest (allows manual trigger / test verification)
  if (request.method === "POST" && path === "/v1/ingest") {
    const result = await runIngestionStep(env);
    return jsonResponse({ success: true, ...result }, 200, corsHeaders);
  }

  return jsonResponse({ error: "not_found" }, 404, corsHeaders);
}
